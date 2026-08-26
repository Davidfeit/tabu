import { BOARD, squareAt } from "@/lib/board";
import type { DeckKey } from "@/lib/types";
import { charge, collectFromEach, credit, emit } from "./economy";
import {
  BOARD_SIZE, JAIL_POS, buildingUnits, deedAt, isDeedPos, player, rentFor,
} from "./selectors";
import { DEED_POSITIONS, passStartBonus } from "./setup";
import type { GameEvent, GameState } from "./types";

type Forced = "transport_double" | "utility_max" | undefined;

interface CardDef {
  id: string;
  text: string;
  effect: Record<string, unknown> & { type: string };
}

function cardDef(deck: DeckKey, id: string): CardDef {
  const c = (BOARD.decks[deck] as CardDef[]).find((x) => x.id === id);
  if (!c) throw new Error(`קלף לא מוכר: ${deck}/${id}`);
  return c;
}

/** העברת שחקן למיקום, עם בונוס מעבר בזינוק אם רלוונטי. */
export function moveTo(
  s: GameState, events: GameEvent[], seat: number, pos: number, collectStart: boolean,
): void {
  const p = player(s, seat);
  const passed = pos < p.pos;
  p.pos = pos;
  if (collectStart && passed) {
    const bonus = passStartBonus(s.settings);
    credit(s, seat, bonus);
    emit(s, events, "pass_start", seat, { amount: bonus });
  }
}

export function sendToJail(s: GameState, events: GameEvent[], seat: number): void {
  const p = player(s, seat);
  p.pos = JAIL_POS;
  p.inJail = true;
  p.jailTurns = 0;
  s.doublesCount = 0;
  emit(s, events, "jailed", seat, {});
}

/** המשבצת הקרובה מסוג נתון, קדימה מהמיקום הנוכחי. */
function nearest(from: number, type: "transport" | "utility"): number {
  for (let i = 1; i <= BOARD_SIZE; i++) {
    const pos = (from + i) % BOARD_SIZE;
    if (squareAt(pos).type === type) return pos;
  }
  /* c8 ignore next */
  throw new Error(`אין משבצת מסוג ${type} על הלוח`);
}

/**
 * פתרון הנחיתה על משבצת.
 *
 * מחזיר את השלב הבא: "awaiting_buy" אם השטר פנוי וניתן לרכישה, אחרת
 * "awaiting_end" — אלא אם נפתח חוב או מכרז, שקובעים שלב בעצמם.
 */
export function resolveLanding(
  s: GameState, events: GameEvent[], seat: number, diceSum: number, forced?: Forced,
): void {
  const p = player(s, seat);
  const sq = squareAt(p.pos);
  emit(s, events, "landed", seat, { pos: p.pos, name: sq.name });

  if (isDeedPos(p.pos)) {
    const d = s.deeds[p.pos]!;
    if (d.owner === null) {
      s.phase = "awaiting_buy";
      return;
    }
    if (d.owner === seat || d.mortgaged) { s.phase = "awaiting_end"; return; }
    const rent = rentFor(s, p.pos, diceSum, forced);
    if (rent > 0) {
      emit(s, events, "rent_due", seat, { pos: p.pos, amount: rent, to: d.owner });
      charge(s, events, seat, rent, d.owner, "rent");
    }
    if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
    return;
  }

  switch (sq.type) {
    case "tax":
      charge(s, events, seat, sq.amount, null, "tax");
      break;
    case "card":
      drawCard(s, events, seat, sq.deck);
      return;   // drawCard קובע את השלב
    case "corner":
      if (sq.key === "goto_jail") { sendToJail(s, events, seat); s.phase = "awaiting_end"; return; }
      if (sq.key === "rest" && s.settings.eilatJackpot && s.pot > 0) {
        credit(s, seat, s.pot);
        emit(s, events, "pot_collected", seat, { amount: s.pot });
        s.pot = 0;
      }
      if (sq.key === "start" && s.settings.doubleOnStart) {
        const bonus = passStartBonus(s.settings);
        credit(s, seat, bonus);
        emit(s, events, "start_landing_bonus", seat, { amount: bonus });
      }
      break;
  }
  if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
}

/** משיכת קלף. הקלף מוצג ומחכה לאישור, כדי שהשחקן יספיק לקרוא אותו. */
export function drawCard(
  s: GameState, events: GameEvent[], seat: number, deck: DeckKey,
): void {
  const id = s.decks[deck].shift();
  /* c8 ignore next */
  if (!id) { s.phase = "awaiting_end"; return; }
  s.drawnCard = { deck, id };
  emit(s, events, "card_drawn", seat, { deck, id, text: cardDef(deck, id).text });
  // כרטיס היציאה עוזב את החפיסה עד שימומש; כל השאר חוזר לתחתית.
  if (cardDef(deck, id).effect.type !== "keep_out_of_jail") s.decks[deck].push(id);
}

/** החלת אפקט הקלף שהוצג. נקראת ב-acknowledge_card. */
export function applyCard(s: GameState, events: GameEvent[], seat: number): void {
  const drawn = s.drawnCard;
  /* c8 ignore next */
  if (!drawn) return;
  s.drawnCard = null;
  const { effect } = cardDef(drawn.deck, drawn.id);
  const p = player(s, seat);
  const e = effect as unknown as Record<string, number | boolean>;

  switch (effect.type) {
    case "cash": {
      const amount = Number(e.amount);
      if (amount >= 0) { credit(s, seat, amount); emit(s, events, "card_cash", seat, { amount }); }
      else charge(s, events, seat, -amount, null, "card");
      break;
    }
    case "collect_from_each":
      collectFromEach(s, events, seat, Number(e.amount), "card");
      break;
    case "per_building": {
      let total = 0;
      for (const pos of DEED_POSITIONS) {
        const d = s.deeds[pos]!;
        if (d.owner !== seat) continue;
        if (d.hotel) total += Math.abs(Number(e.perHotel));
        else total += d.houses * Math.abs(Number(e.perHouse));
      }
      if (total > 0) charge(s, events, seat, total, null, "card_repairs");
      break;
    }
    case "keep_out_of_jail":
      p.getOutCards += 1;
      emit(s, events, "jail_card_received", seat, {});
      break;
    case "skip_next_turn":
      p.skipNextTurn = true;
      emit(s, events, "skip_queued", seat, {});
      break;
    case "goto_jail":
      sendToJail(s, events, seat);
      break;
    case "move_to":
      moveTo(s, events, seat, Number(e.pos), Boolean(e.collectStart));
      resolveLanding(s, events, seat, s.dice ? s.dice[0] + s.dice[1] : 0);
      return;
    case "move_relative": {
      const target = (p.pos + Number(e.delta) + BOARD_SIZE) % BOARD_SIZE;
      // תנועה אחורה לעולם לא מזכה בבונוס זינוק.
      p.pos = target;
      resolveLanding(s, events, seat, s.dice ? s.dice[0] + s.dice[1] : 0);
      return;
    }
    case "nearest_transport": {
      moveTo(s, events, seat, nearest(p.pos, "transport"), true);
      resolveLanding(s, events, seat, 0, "transport_double");
      return;
    }
    case "nearest_utility": {
      moveTo(s, events, seat, nearest(p.pos, "utility"), true);
      // הקלף מורה לגלגל קוביות מחדש ולשלם פי 12 ללא קשר לכמות שבבעלות.
      const sum = s.dice ? s.dice[0] + s.dice[1] : 0;
      resolveLanding(s, events, seat, sum, "utility_max");
      return;
    }
  }
  if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
}

/** מכירת שטר לבנק אינה קיימת — רק משכון. עוזר לחישובי חיסול. */
export function hasBuildings(s: GameState, seat: number): boolean {
  return DEED_POSITIONS.some((pos) => {
    const d = s.deeds[pos]!;
    return d.owner === seat && buildingUnits(s, d) > 0;
  });
}

export { deedAt };
