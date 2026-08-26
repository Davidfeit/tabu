import { BOARD } from "@/lib/board";
import { bid, maybeSettle, openAuction, pass } from "./auction";
import { buildHouse, mortgage, sellHouse, unmortgage } from "./build";
import { bankrupt, charge, checkVictory, credit, emit, finishOnTime } from "./economy";
import { applyCard, moveTo, resolveLanding, sendToJail } from "./moves";
import {
  BOARD_SIZE, activePlayers, buildingUnits, deedAt, houseCost, liquidValue, player,
} from "./selectors";
import { DEED_POSITIONS } from "./setup";
import type {
  Action, Ctx, ErrorCode, GameEvent, GameState, Result, TradeOffer,
} from "./types";
import type { Phase } from "./types";

const TRADE_TTL_MS = 60_000;

/**
 * קריאת השלב בלי שהטיפוס יצומצם.
 *
 * פונקציות העזר (charge, resolveLanding, bankrupt) משנות את s.phase, אבל
 * TypeScript לא רואה מוטציה דרך קריאת פונקציה ולכן מצמצם את הטיפוס אחרי כל
 * בדיקה — ואז מסמן השוואות תקינות כבלתי אפשריות. קריאה דרך פונקציה מבטלת
 * את הצמצום בלי לוותר על בדיקת הטיפוסים.
 */
function phaseOf(s: GameState): Phase {
  return s.phase;
}

// ── ניהול תור ─────────────────────────────────────────────────────────────

function setDeadline(s: GameState, now: number): void {
  s.turnDeadline = now + s.settings.turnSeconds * 1000;
}

/** האם חלף הזמן הקצוב למשחק. */
function timeExpired(s: GameState, now: number): boolean {
  const limit = s.settings.hardLimitMinutes;
  return limit !== null && now - s.startedAt >= limit * 60_000;
}

function nextTurn(s: GameState, events: GameEvent[], now: number): void {
  if (checkVictory(s, events)) return;
  if (timeExpired(s, now)) { finishOnTime(s, events, now); return; }

  s.dice = null;
  s.doublesCount = 0;
  s.drawnCard = null;
  s.trade = null;

  const seats = s.players.map((p) => p.seat);
  let seat = s.currentSeat;
  for (let i = 0; i < seats.length * 2; i++) {
    seat = (seat + 1) % seats.length;
    const p = player(s, seat);
    if (p.bankrupt) continue;
    if (p.skipNextTurn) {
      p.skipNextTurn = false;
      emit(s, events, "turn_skipped", seat, {});
      continue;
    }
    break;
  }
  s.currentSeat = seat;
  s.phase = "awaiting_roll";
  setDeadline(s, now);
  emit(s, events, "turn_started", seat, {});
}

// ── חוב ───────────────────────────────────────────────────────────────────

/** חוב נסגר מעצמו ברגע שיש מזומן. אין פעולת "שלם" נפרדת. */
function settleDebtIfPossible(s: GameState, events: GameEvent[]): void {
  const debt = s.debt;
  if (!debt) return;
  const p = player(s, debt.debtorSeat);
  if (p.cash < debt.amount) return;

  p.cash -= debt.amount;
  if (debt.creditorSeat !== null) credit(s, debt.creditorSeat, debt.amount);
  else if (s.settings.eilatJackpot) s.pot += debt.amount;
  emit(s, events, "debt_settled", debt.debtorSeat,
       { amount: debt.amount, to: debt.creditorSeat });
  s.debt = null;
  resumeAfterDebt(s, events);
}

function resumeAfterDebt(s: GameState, events: GameEvent[]): void {
  if (phaseOf(s) === "finished") return;
  const pending = s.pendingMove;
  if (pending !== null) {
    s.pendingMove = null;
    const p = player(s, s.currentSeat);
    p.inJail = false;
    p.jailTurns = 0;
    moveTo(s, events, s.currentSeat, (p.pos + pending) % BOARD_SIZE, true);
    resolveLanding(s, events, s.currentSeat, pending);
    if (phaseOf(s) === "debt" || phaseOf(s) === "finished") return;
  }
  s.phase = s.auction ? "auction" : "awaiting_end";
}

/**
 * חיסול אוטומטי — "מכור והמשך".
 * מוכר בתים ואז ממשכן, בסדר ערך עולה, עד לכיסוי החוב. מפחית נטישות זעם.
 */
function autoLiquidate(s: GameState, events: GameEvent[], seat: number, target: number): void {
  const byValue = DEED_POSITIONS
    .filter((pos) => s.deeds[pos]!.owner === seat)
    .sort((a, b) => deedAt(a).price - deedAt(b).price);

  for (const pos of byValue) {
    while (player(s, seat).cash < target && buildingUnits(s, s.deeds[pos]!) > 0) {
      if (sellHouse(s, events, seat, pos) !== null) break;
    }
  }
  for (const pos of byValue) {
    if (player(s, seat).cash >= target) break;
    if (!s.deeds[pos]!.mortgaged) mortgage(s, events, seat, pos);
  }
}

// ── עסקאות ────────────────────────────────────────────────────────────────

function tradeSideValid(
  s: GameState, seat: number, side: TradeOffer["give"],
): ErrorCode | null {
  if (side.cash < 0 || !Number.isInteger(side.cash)) return "INVALID_TRADE";
  const p = player(s, seat);
  if (p.cash < side.cash) return "INSUFFICIENT_FUNDS";
  if (side.jailCards < 0 || side.jailCards > p.getOutCards) return "INVALID_TRADE";
  for (const pos of side.deeds) {
    const d = s.deeds[pos];
    if (!d) return "NOT_A_DEED";
    if (d.owner !== seat) return "NOT_OWNER";
    // חוק חד-משמעי: שטר אינו סחיר כל עוד יש בנייה כלשהי בקבוצת הצבע שלו.
    const sq = deedAt(pos);
    if (sq.type === "property") {
      const built = DEED_POSITIONS.some((q) => {
        const qs = deedAt(q);
        return qs.type === "property" && qs.group === sq.group
          && buildingUnits(s, s.deeds[q]!) > 0;
      });
      if (built) return "HAS_BUILDINGS";
    }
  }
  return null;
}

function executeTrade(s: GameState, events: GameEvent[], offer: TradeOffer): void {
  const a = player(s, offer.fromSeat);
  const b = player(s, offer.toSeat);

  a.cash -= offer.give.cash;      b.cash += offer.give.cash;
  b.cash -= offer.receive.cash;   a.cash += offer.receive.cash;
  a.getOutCards -= offer.give.jailCards;    b.getOutCards += offer.give.jailCards;
  b.getOutCards -= offer.receive.jailCards; a.getOutCards += offer.receive.jailCards;

  const fee = BOARD.meta.unmortgageInterest;
  for (const pos of offer.give.deeds) {
    s.deeds[pos]!.owner = offer.toSeat;
    if (s.deeds[pos]!.mortgaged) {
      charge(s, events, offer.toSeat, Math.round(deedAt(pos).mortgage * fee), null,
             "mortgage_transfer_fee");
    }
  }
  for (const pos of offer.receive.deeds) {
    s.deeds[pos]!.owner = offer.fromSeat;
    if (s.deeds[pos]!.mortgaged) {
      charge(s, events, offer.fromSeat, Math.round(deedAt(pos).mortgage * fee), null,
             "mortgage_transfer_fee");
    }
  }
  emit(s, events, "trade_executed", offer.fromSeat, { with: offer.toSeat });
}

// ── הרדוקר ────────────────────────────────────────────────────────────────

const err = (error: ErrorCode): Result => ({ ok: false, error });

/**
 * הפונקציה היחידה שמשנה מצב משחק.
 *
 * טהורה: מקבלת מצב ומחזירה מצב חדש. לא נוגעת בשעון, ברשת או ברנדום —
 * `ctx.now` ו-`ctx.seed` נכנסים מבחוץ. לכן אותו קלט תמיד נותן אותו פלט,
 * וכל משחק ניתן לשחזור מלא מהזרע ומיומן הפעולות.
 */
export function reduce(state: GameState, action: Action, ctx: Ctx): Result {
  const s: GameState = structuredClone(state);
  const events: GameEvent[] = [];
  const { seat, now } = ctx;

  if (s.phase === "finished") return err("GAME_OVER");
  // claim_timeout היא פעולת תיקון, לא מהלך משחק: היא חייבת להיות זמינה גם
  // לשחקן שפשט רגל, אחרת חדר יכול להיתקע כשמי שנפל היה בתורו.
  if (action.type !== "claim_timeout" && s.players[seat]?.bankrupt) {
    return err("PLAYER_BANKRUPT");
  }

  // אכיפה עצלה: אם התור פג, מחילים את הטיימאאוט לפני הפעולה הנכנסת.
  // הפעולה הבאה של מישהו מתקנת את החדר — אין צורך במתזמן לנכונות.
  if (action.type !== "claim_timeout" && s.turnDeadline !== null && now > s.turnDeadline) {
    applyTimeout(s, events, now, ctx.seed);
    if (phaseOf(s) === "finished") return { ok: true, state: s, events };
  }

  const isCurrent = seat === s.currentSeat;

  switch (action.type) {
    case "roll": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      doRoll(s, events, ctx);
      break;
    }

    case "buy_property": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_buy") return err("WRONG_PHASE");
      const p = player(s, seat);
      const d = s.deeds[p.pos];
      if (!d) return err("NOT_A_DEED");
      if (d.owner !== null) return err("ALREADY_OWNED");
      const price = deedAt(p.pos).price;
      if (p.cash < price) return err("INSUFFICIENT_FUNDS");
      p.cash -= price;
      d.owner = seat;
      emit(s, events, "bought", seat, { pos: p.pos, price });
      s.phase = "awaiting_end";
      break;
    }

    case "decline_property": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_buy") return err("WRONG_PHASE");
      const pos = player(s, seat).pos;
      if (s.settings.auctions) openAuction(s, events, pos, seat, [], now);
      else { emit(s, events, "declined", seat, { pos }); s.phase = "awaiting_end"; }
      break;
    }

    case "auction_bid": {
      if (!s.auction) return err("NO_AUCTION");
      const bad = bid(s, events, seat, action.amount, now);
      if (bad) return err(bad);
      break;
    }

    case "auction_pass": {
      if (!s.auction) return err("NO_AUCTION");
      const bad = pass(s, events, seat, now);
      if (bad) return err(bad);
      break;
    }

    // בנייה, מכירה ומשכון מותרים בכל עת — נדרש לגיוס חירום.
    case "build_house": {
      const bad = buildHouse(s, events, seat, action.pos);
      if (bad) return err(bad);
      break;
    }
    case "sell_house": {
      const bad = sellHouse(s, events, seat, action.pos);
      if (bad) return err(bad);
      settleDebtIfPossible(s, events);
      break;
    }
    case "mortgage": {
      const bad = mortgage(s, events, seat, action.pos);
      if (bad) return err(bad);
      settleDebtIfPossible(s, events);
      break;
    }
    case "unmortgage": {
      const bad = unmortgage(s, events, seat, action.pos);
      if (bad) return err(bad);
      break;
    }

    case "pay_jail_fine": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      const p = player(s, seat);
      if (!p.inJail) return err("NOT_IN_JAIL");
      if (p.cash < BOARD.meta.jailFine) return err("INSUFFICIENT_FUNDS");
      p.cash -= BOARD.meta.jailFine;
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, events, "jail_paid", seat, { amount: BOARD.meta.jailFine });
      break;
    }

    case "use_jail_card": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      const p = player(s, seat);
      if (!p.inJail) return err("NOT_IN_JAIL");
      if (p.getOutCards < 1) return err("NO_JAIL_CARD");
      p.getOutCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      // הכרטיס חוזר לתחתית החפיסה שממנה נמשך.
      const deck = (BOARD.decks.yad_hagoral as { id: string; effect: { type: string } }[])
        .find((c) => c.effect.type === "keep_out_of_jail");
      if (deck && !s.decks.yad_hagoral.includes(deck.id)) s.decks.yad_hagoral.push(deck.id);
      emit(s, events, "jail_card_used", seat, {});
      break;
    }

    case "acknowledge_card": {
      if (!s.drawnCard) return err("WRONG_PHASE");
      applyCard(s, events, s.currentSeat);
      break;
    }

    case "propose_trade": {
      const o = action.offer;
      if (o.fromSeat !== seat) return err("NOT_YOUR_TURN");
      if (o.toSeat === seat) return err("INVALID_TRADE");
      if (!s.players[o.toSeat] || s.players[o.toSeat]!.bankrupt) return err("INVALID_TRADE");
      if (s.phase === "auction" || s.phase === "debt") return err("WRONG_PHASE");
      const badGive = tradeSideValid(s, o.fromSeat, o.give);
      if (badGive) return err(badGive);
      const badGet = tradeSideValid(s, o.toSeat, o.receive);
      if (badGet) return err(badGet);
      s.trade = { ...o, expiresAt: now + TRADE_TTL_MS };
      emit(s, events, "trade_proposed", seat, { to: o.toSeat });
      break;
    }

    case "accept_trade": {
      const o = s.trade;
      if (!o) return err("NO_TRADE");
      if (o.toSeat !== seat) return err("NOT_TRADE_TARGET");
      if (now > o.expiresAt) { s.trade = null; return err("NO_TRADE"); }
      // אימות חוזר: המצב יכול היה להשתנות בין ההצעה לאישור.
      if (tradeSideValid(s, o.fromSeat, o.give) || tradeSideValid(s, o.toSeat, o.receive)) {
        s.trade = null;
        return err("INVALID_TRADE");
      }
      executeTrade(s, events, o);
      s.trade = null;
      break;
    }

    case "reject_trade": {
      const o = s.trade;
      if (!o) return err("NO_TRADE");
      if (o.toSeat !== seat && o.fromSeat !== seat) return err("NOT_TRADE_TARGET");
      s.trade = null;
      emit(s, events, "trade_rejected", seat, {});
      break;
    }

    case "end_turn": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_end") return err("WRONG_PHASE");
      // כפולים מזכים בגלגול נוסף — אבל לא כשהם הוציאו אותך מהכלא.
      if (s.dice && s.dice[0] === s.dice[1] && !player(s, seat).inJail && s.doublesCount > 0) {
        s.phase = "awaiting_roll";
        setDeadline(s, now);
        emit(s, events, "extra_roll", seat, {});
        break;
      }
      nextTurn(s, events, now);
      break;
    }

    case "declare_bankruptcy": {
      if (!s.debt || s.debt.debtorSeat !== seat) return err("NO_DEBT");
      const owed = s.debt.amount;
      if (liquidValue(s, seat) >= owed && player(s, seat).cash < owed) {
        // יש נכסים לכסות את החוב — לא ניתן לוותר כדי להימלט ממנו.
        return err("CAN_PAY");
      }
      const creditor = s.debt.creditorSeat;
      s.debt = null;
      s.pendingMove = null;
      bankrupt(s, events, seat, creditor);
      if (phaseOf(s) !== "finished" && phaseOf(s) !== "auction") nextTurn(s, events, now);
      break;
    }

    case "claim_timeout": {
      if (s.turnDeadline === null || now <= s.turnDeadline) {
        if (!s.auction || s.auction.deadline === null || now <= s.auction.deadline) {
          return err("DEADLINE_NOT_REACHED");
        }
      }
      applyTimeout(s, events, now, ctx.seed);
      break;
    }

    /* c8 ignore next 2 */
    default:
      return err("UNKNOWN_ACTION");
  }

  normalize(s, events, now);
  return { ok: true, state: s, events };
}

/**
 * תיאום אחרי כל פעולה. שתי בעיות נפרדות, ושתיהן נפתרות בנקודה אחת ולא
 * בכל מסלול שיכול לגרום להן.
 *
 * 1. **התור נתקע על שחקן שפשט רגל.** שחקן יכול לפשוט רגל *בתורו שלו* — נחת
 *    על שכר דירה שאין לו כיסוי אליו כלל. אז הוא מסומן bankrupt אבל
 *    currentSeat עדיין מצביע עליו, והרדוקר דוחה כל פעולה משחקן שפשט רגל.
 *
 * 2. **phase ו-debt יוצאים מסנכרון.** פשיטת רגל לשחקן גוררת עמלת 10% על כל
 *    שטר משוכן שעובר לנושה — ואם לנושה אין מזומן, נפתח *חוב שני* באמצע
 *    תהליך פשיטת הרגל הראשון. מסלולי הסיום השונים לא כולם יודעים על כך,
 *    ואפשר להגיע ל-phase "debt" בלי חוב, או לחוב פתוח עם phase אחר.
 *
 * הכלל: **חוב פתוח גובר על הכול.** המשחק ממתין לו, בדיוק כמו על השולחן.
 */
function normalize(s: GameState, events: GameEvent[], now: number): void {
  if (phaseOf(s) === "finished") return;

  // חוב של מי שכבר פשט רגל אינו קיים.
  if (s.debt && player(s, s.debt.debtorSeat).bankrupt) {
    s.debt = null;
    s.pendingMove = null;
  }

  if (s.debt) { s.phase = "debt"; return; }
  if (phaseOf(s) === "debt") s.phase = s.auction ? "auction" : "awaiting_end";
  if (phaseOf(s) === "auction") return;

  if (player(s, s.currentSeat).bankrupt) nextTurn(s, events, now);
}

// ── גלגול ─────────────────────────────────────────────────────────────────

function doRoll(s: GameState, events: GameEvent[], ctx: Ctx): void {
  const { seed } = ctx;
  const seat = s.currentSeat;
  const p = player(s, seat);
  const [d1, d2] = rollFor(seed, s.seq);
  s.dice = [d1, d2];
  const sum = d1 + d2;
  const isDouble = d1 === d2;
  emit(s, events, "rolled", seat, { d1, d2, double: isDouble });

  if (p.inJail) {
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, events, "jail_escaped", seat, { d1, d2 });
      moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
      resolveLanding(s, events, seat, sum);
      // כפולים שהוציאו מהכלא אינם מזכים בגלגול נוסף.
      s.doublesCount = 0;
      return;
    }
    p.jailTurns += 1;
    if (p.jailTurns < BOARD.meta.maxJailTurns) {
      emit(s, events, "jail_attempt_failed", seat, { attempt: p.jailTurns });
      s.phase = "awaiting_end";
      return;
    }
    // ניסיון שלישי שנכשל: חובה לשלם ואז לזוז.
    emit(s, events, "jail_term_ended", seat, {});
    s.pendingMove = sum;
    charge(s, events, seat, BOARD.meta.jailFine, null, "jail_fine");
    if (phaseOf(s) === "debt" || phaseOf(s) === "finished") return;   // התנועה תמתין
    s.pendingMove = null;
    p.inJail = false;
    p.jailTurns = 0;
    moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
    resolveLanding(s, events, seat, sum);
    s.doublesCount = 0;
    return;
  }

  if (isDouble) {
    s.doublesCount += 1;
    if (s.doublesCount >= 3) {
      // לא זזים, לא פותרים את המשבצת, לא עוברים בזינוק.
      emit(s, events, "three_doubles", seat, {});
      sendToJail(s, events, seat);
      s.phase = "awaiting_end";
      return;
    }
  }

  moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
  resolveLanding(s, events, seat, sum);
}

// מיובא כאן ולא בראש הקובץ כדי לשמור על גבול ברור בין הרדוקר ל-RNG.
import { rollDice as rollFor } from "./rng";

// ── טיימאאוט ──────────────────────────────────────────────────────────────

/**
 * הזמן הוא נתון, לא מתזמן. כל פעולה בודקת קודם אם התור פג ומחילה את
 * הטיימאאוט; לכן אין צורך בתהליך חי כדי שהמשחק יתקדם נכון.
 */
function applyTimeout(s: GameState, events: GameEvent[], now: number, seed: string): void {
  if (s.auction && s.auction.deadline !== null && now >= s.auction.deadline) {
    maybeSettle(s, events, now, true);
    if (phaseOf(s) !== "auction") setDeadline(s, now);
    return;
  }

  if (s.trade && now > s.trade.expiresAt) s.trade = null;

  switch (s.phase) {
    case "awaiting_roll":
      emit(s, events, "auto_roll", s.currentSeat, {});
      doRoll(s, events, { seat: s.currentSeat, now, seed });
      if (phaseOf(s) === "awaiting_end") nextTurn(s, events, now);
      break;
    case "awaiting_buy":
      emit(s, events, "auto_decline", s.currentSeat, {});
      if (s.settings.auctions) openAuction(s, events, player(s, s.currentSeat).pos,
                                           s.currentSeat, [], now);
      else nextTurn(s, events, now);
      break;
    case "awaiting_end":
      nextTurn(s, events, now);
      break;
    case "debt": {
      const debt = s.debt;
      // normalize() מיישר phase מול debt, אבל applyTimeout רץ גם מנתיב
      // האכיפה העצלה בראש הרדוקר — לפני שהיישור הזה הספיק לרוץ.
      if (!debt) { s.phase = s.auction ? "auction" : "awaiting_end"; break; }
      const { debtorSeat, amount, creditorSeat } = debt;
      if (liquidValue(s, debtorSeat) >= amount) {
        emit(s, events, "auto_liquidate", debtorSeat, { amount });
        autoLiquidate(s, events, debtorSeat, amount);
        settleDebtIfPossible(s, events);
        if (phaseOf(s) === "awaiting_end") nextTurn(s, events, now);
      } else {
        s.debt = null;
        s.pendingMove = null;
        bankrupt(s, events, debtorSeat, creditorSeat);
        if (phaseOf(s) !== "finished" && phaseOf(s) !== "auction") nextTurn(s, events, now);
      }
      break;
    }
    /* c8 ignore next 2 */
    default:
      break;
  }
}

export { activePlayers, houseCost };
