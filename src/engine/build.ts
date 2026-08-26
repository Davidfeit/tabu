import { BOARD, squareAt } from "@/lib/board";
import {
  buildingUnits, deedAt, groupPositions, groupUnmortgaged, houseCost, ownsGroup, player,
} from "./selectors";
import { credit, emit } from "./economy";
import type { ErrorCode, GameEvent, GameState } from "./types";

/** רמת הבנייה לצורך חוק הבנייה השווה. מלון = הסף ועוד אחת. */
function level(s: GameState, pos: number): number {
  return buildingUnits(s, s.deeds[pos]!);
}

function groupOf(pos: number) {
  const sq = squareAt(pos);
  return sq.type === "property" ? sq.group : null;
}

/**
 * בדיקות משותפות לבנייה ולמכירה.
 * הקבוצה חייבת להיות שלמה, בבעלות המבקש, ולא משוכנת.
 */
function checkGroup(s: GameState, seat: number, pos: number): ErrorCode | null {
  const key = groupOf(pos);
  if (key === null) return "NOT_A_DEED";
  const d = s.deeds[pos];
  if (!d || d.owner !== seat) return "NOT_OWNER";
  if (!ownsGroup(s, seat, key)) return "GROUP_INCOMPLETE";
  if (!groupUnmortgaged(s, key)) return "GROUP_INCOMPLETE";
  return null;
}

export function buildHouse(
  s: GameState, events: GameEvent[], seat: number, pos: number,
): ErrorCode | null {
  const bad = checkGroup(s, seat, pos);
  if (bad) return bad;

  const key = groupOf(pos)!;
  const d = s.deeds[pos]!;
  if (d.hotel) return "MAX_DEVELOPED";

  const threshold = s.settings.hotelThreshold;
  const upgradingToHotel = d.houses === threshold;

  // חוק הבנייה השווה: מותר לבנות רק על הנמוך בקבוצה.
  const levels = groupPositions(key).map((p) => level(s, p));
  if (level(s, pos) !== Math.min(...levels)) return "UNEVEN_BUILD";

  if (upgradingToHotel) {
    if (s.bank.hotels < 1) return "NO_HOTELS_LEFT";
  } else if (s.bank.houses < 1) {
    return "NO_HOUSES_LEFT";
  }

  const cost = houseCost(pos);
  const p = player(s, seat);
  if (p.cash < cost) return "INSUFFICIENT_FUNDS";

  p.cash -= cost;
  if (upgradingToHotel) {
    // הבתים חוזרים למלאי — זה מה שמאפשר את אסטרטגיית הרעבת הבתים.
    s.bank.houses += threshold;
    s.bank.hotels -= 1;
    d.houses = 0;
    d.hotel = true;
    emit(s, events, "hotel_built", seat, { pos, cost });
  } else {
    s.bank.houses -= 1;
    d.houses += 1;
    emit(s, events, "house_built", seat, { pos, cost, houses: d.houses });
  }
  return null;
}

export function sellHouse(
  s: GameState, events: GameEvent[], seat: number, pos: number,
): ErrorCode | null {
  const key = groupOf(pos);
  if (key === null) return "NOT_A_DEED";
  const d = s.deeds[pos];
  if (!d || d.owner !== seat) return "NOT_OWNER";
  if (buildingUnits(s, d) === 0) return "NO_BUILDINGS";

  // מכירה שווה: מותר למכור רק מהגבוה בקבוצה.
  const levels = groupPositions(key).map((p) => level(s, p));
  if (level(s, pos) !== Math.max(...levels)) return "UNEVEN_BUILD";

  const threshold = s.settings.hotelThreshold;
  const refund = houseCost(pos) / 2;

  if (d.hotel) {
    // פירוק מלון דורש שהבנק יספק בתים חזרה. אם אין — אי אפשר.
    if (s.bank.houses < threshold) return "NO_HOUSES_LEFT";
    s.bank.hotels += 1;
    s.bank.houses -= threshold;
    d.hotel = false;
    d.houses = threshold;
    credit(s, seat, refund);
    emit(s, events, "hotel_sold", seat, { pos, refund });
  } else {
    s.bank.houses += 1;
    d.houses -= 1;
    credit(s, seat, refund);
    emit(s, events, "house_sold", seat, { pos, refund, houses: d.houses });
  }
  return null;
}

export function mortgage(
  s: GameState, events: GameEvent[], seat: number, pos: number,
): ErrorCode | null {
  const d = s.deeds[pos];
  if (!d) return "NOT_A_DEED";
  if (d.owner !== seat) return "NOT_OWNER";
  if (d.mortgaged) return "ALREADY_MORTGAGED";

  // אי אפשר למשכן כל עוד יש בנייה כלשהי בקבוצה.
  const key = groupOf(pos);
  if (key !== null && groupPositions(key).some((p) => buildingUnits(s, s.deeds[p]!) > 0)) {
    return "HAS_BUILDINGS";
  }

  d.mortgaged = true;
  const amount = deedAt(pos).mortgage;
  credit(s, seat, amount);
  emit(s, events, "mortgaged", seat, { pos, amount });
  return null;
}

export function unmortgage(
  s: GameState, events: GameEvent[], seat: number, pos: number,
): ErrorCode | null {
  const d = s.deeds[pos];
  if (!d) return "NOT_A_DEED";
  if (d.owner !== seat) return "NOT_OWNER";
  if (!d.mortgaged) return "NOT_MORTGAGED";

  const cost = Math.round(deedAt(pos).mortgage * (1 + BOARD.meta.unmortgageInterest));
  const p = player(s, seat);
  if (p.cash < cost) return "INSUFFICIENT_FUNDS";

  p.cash -= cost;
  d.mortgaged = false;
  emit(s, events, "unmortgaged", seat, { pos, cost });
  return null;
}
