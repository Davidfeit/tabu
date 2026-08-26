import { BOARD } from "@/lib/board";
import type { DeckKey } from "@/lib/types";
import {
  activePlayers, buildingUnits, deedAt, houseCost, liquidValue, netWorth, player,
} from "./selectors";
import { DEED_POSITIONS } from "./setup";
import type { GameEvent, GameState } from "./types";

export function emit(
  s: GameState, events: GameEvent[], type: string,
  seat: number | null, payload: Record<string, unknown> = {},
): void {
  events.push({ seq: ++s.seq, type, seat, payload });
}

export function credit(s: GameState, seat: number, amount: number): void {
  player(s, seat).cash += amount;
}

/**
 * חיוב שחקן.
 *
 * שלוש תוצאות אפשריות:
 *   יש מזומן            → משלם מיד
 *   אין מזומן אבל יש נכסים → נכנס למצב "גיוס כספים"; הפעולה הנוכחית מוקפאת
 *   אין מספיק בכלל      → פשיטת רגל מיידית
 *
 * החוב אינו נגבה חלקית: השחקן חייב לגייס את מלוא הסכום. לכן המזומן נשאר
 * בידיו עד לפתרון, אחרת "כמה נשאר לי לגייס" היה משתנה תוך כדי.
 */
export function charge(
  s: GameState, events: GameEvent[], seat: number, amount: number,
  creditorSeat: number | null, reason: string,
): void {
  if (amount <= 0) return;
  const p = player(s, seat);

  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditorSeat !== null) credit(s, creditorSeat, amount);
    else if (s.settings.eilatJackpot) s.pot += amount;
    emit(s, events, "pay", seat, { amount, to: creditorSeat, reason });
    return;
  }

  if (liquidValue(s, seat) < amount) {
    emit(s, events, "cannot_pay", seat, { amount, to: creditorSeat, reason });
    bankrupt(s, events, seat, creditorSeat);
    return;
  }

  s.debt = {
    debtorSeat: seat, creditorSeat, amount,
    deadline: s.turnDeadline === null ? null : s.turnDeadline + 60_000,
  };
  s.phase = "debt";
  emit(s, events, "debt_opened", seat, { amount, to: creditorSeat, reason });
}

/** גבייה מכל שחקן פעיל אחר (קלף החתונה). */
export function collectFromEach(
  s: GameState, events: GameEvent[], seat: number, amount: number, reason: string,
): void {
  for (const other of activePlayers(s)) {
    if (other.seat === seat) continue;
    charge(s, events, other.seat, amount, seat, reason);
  }
}

function returnCardsToDecks(s: GameState, seat: number): void {
  const p = player(s, seat);
  // הכרטיסים חוזרים לתחתית החפיסות. חלוקה שרירותית בין השתיים כשיש שניים.
  const decks: DeckKey[] = ["kupat_gemel", "yad_hagoral"];
  for (let i = 0; i < p.getOutCards; i++) {
    const key = decks[i % decks.length]!;
    const id = (BOARD.decks[key] as { id: string; effect: { type: string } }[])
      .find((c) => c.effect.type === "keep_out_of_jail")?.id;
    if (id && !s.decks[key].includes(id)) s.decks[key].push(id);
  }
  p.getOutCards = 0;
}

/**
 * פשיטת רגל.
 *
 * לשחקן: המזומן, השטרות (עם סטטוס המשכון) והכרטיסים עוברים לנושה, שמשלם
 * מיד 10% ריבית על כל שטר משוכן שקיבל. אם אין לו — פשיטת רגל מדורגת,
 * וזה חוקי.
 *
 * לבנק: הבתים חוזרים למלאי ללא תשלום, והשטרות יוצאים למכרז אחד-אחד בסדר
 * מיקום עולה — כולל המשוכנים.
 *
 * בשני המקרים הבתים נמכרים/חוזרים ולעולם לא עוברים בין שחקנים.
 */
export function bankrupt(
  s: GameState, events: GameEvent[], seat: number, creditorSeat: number | null,
): void {
  const p = player(s, seat);
  if (p.bankrupt) return;

  const owned = DEED_POSITIONS.filter((pos) => s.deeds[pos]!.owner === seat);

  // הבתים תמיד מפורקים תחילה. אף פעם לא עוברים בין שחקנים.
  let buildingRefund = 0;
  for (const pos of owned) {
    const d = s.deeds[pos]!;
    const units = buildingUnits(s, d);
    if (units === 0) continue;
    buildingRefund += (houseCost(pos) * units) / 2;
    if (d.hotel) s.bank.hotels += 1;
    s.bank.houses += d.hotel ? 0 : d.houses;
    d.hotel = false;
    d.houses = 0;
  }

  if (creditorSeat !== null) {
    credit(s, creditorSeat, p.cash + buildingRefund);
    for (const pos of owned) {
      s.deeds[pos]!.owner = creditorSeat;
      // הנושה משלם מיד 10% ריבית על כל שטר משוכן שקיבל.
      if (s.deeds[pos]!.mortgaged) {
        const fee = Math.round(deedAt(pos).mortgage * BOARD.meta.unmortgageInterest);
        charge(s, events, creditorSeat, fee, null, "mortgage_transfer_fee");
      }
    }
    player(s, creditorSeat).getOutCards += p.getOutCards;
    p.getOutCards = 0;
  } else {
    for (const pos of owned) s.deeds[pos]!.owner = null;
    returnCardsToDecks(s, seat);
    if (s.settings.auctions && owned.length > 0) {
      s.auction = {
        pos: owned[0]!, bid: null, bidderSeat: null, passed: [], declinedBy: null,
        queue: owned.slice(1),
        deadline: s.turnDeadline === null ? null : s.turnDeadline + 12_000,
      };
      s.phase = "auction";
    }
  }

  p.cash = 0;
  p.bankrupt = true;
  emit(s, events, "bankrupt", seat, { to: creditorSeat, deeds: owned.length });

  checkVictory(s, events);
}

/** המנצח הוא השחקן האחרון שלא פשט רגל. */
export function checkVictory(s: GameState, events: GameEvent[]): boolean {
  const alive = activePlayers(s);
  if (alive.length > 1) return false;
  s.phase = "finished";
  s.finishedAt = s.turnDeadline ?? s.startedAt;
  s.winnerSeat = alive[0]?.seat ?? null;
  s.turnDeadline = null;
  s.auction = null;
  s.debt = null;
  emit(s, events, "game_over", s.winnerSeat, { reason: "last_standing" });
  return true;
}

/**
 * סיום מתוזמן: המנצח לפי שווי נקי.
 * תיקו נשבר לפי מזומן, ואז לפי מספר קבוצות צבע שלמות.
 */
export function finishOnTime(s: GameState, events: GameEvent[], now: number): void {
  const ranked = activePlayers(s)
    .map((p) => ({ seat: p.seat, worth: netWorth(s, p.seat), cash: p.cash }))
    .sort((a, b) => b.worth - a.worth || b.cash - a.cash || a.seat - b.seat);
  s.phase = "finished";
  s.finishedAt = now;
  s.winnerSeat = ranked[0]?.seat ?? null;
  s.turnDeadline = null;
  emit(s, events, "game_over", s.winnerSeat, { reason: "time_limit", ranked });
}
