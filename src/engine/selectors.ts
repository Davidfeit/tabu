import { BOARD, group, squareAt } from "@/lib/board";
import { isDeed, type Deed, type GroupKey } from "@/lib/types";
import { DEED_POSITIONS } from "./setup";
import type { DeedState, GameState, Player } from "./types";

export function player(s: GameState, seat: number): Player {
  const p = s.players[seat];
  if (!p) throw new RangeError(`אין שחקן במושב ${seat}`);
  return p;
}

export function deedAt(pos: number): Deed {
  const sq = squareAt(pos);
  if (!isDeed(sq)) throw new TypeError(`המשבצת ${pos} אינה שטר`);
  return sq;
}

export function isDeedPos(pos: number): boolean {
  return DEED_POSITIONS.includes(pos);
}

/** כל מיקומי הנכסים בקבוצת צבע. */
export function groupPositions(key: GroupKey): number[] {
  return DEED_POSITIONS.filter((p) => {
    const sq = squareAt(p);
    return sq.type === "property" && sq.group === key;
  });
}

/** האם השחקן מחזיק בכל קבוצת הצבע. */
export function ownsGroup(s: GameState, seat: number, key: GroupKey): boolean {
  return groupPositions(key).every((p) => s.deeds[p]?.owner === seat);
}

/** האם קבוצת הצבע כולה לא משוכנת. תנאי לבונוס ×2 ולבנייה. */
export function groupUnmortgaged(s: GameState, key: GroupKey): boolean {
  return groupPositions(key).every((p) => !s.deeds[p]?.mortgaged);
}

function countOwned(s: GameState, seat: number, type: "transport" | "utility"): number {
  return DEED_POSITIONS.filter((p) => {
    const d = s.deeds[p];
    return d?.owner === seat && !d.mortgaged && squareAt(p).type === type;
  }).length;
}

/**
 * שכר הדירה על נחיתה במיקום.
 *
 * `diceSum` נדרש לתשתיות. `forced` מבטא הגעה דרך קלף:
 *   - "transport_double" — קלף צומת התחבורה: כפול מהשכ"ד הרגיל
 *   - "utility_max"      — קלף התשתית: תמיד ×12,000, ללא קשר לכמות שבבעלות
 */
export function rentFor(
  s: GameState,
  pos: number,
  diceSum: number,
  forced?: "transport_double" | "utility_max",
): number {
  const d = s.deeds[pos];
  if (!d || d.owner === null || d.mortgaged) return 0;

  const sq = deedAt(pos);
  let rent: number;

  if (sq.type === "property") {
    if (d.hotel) {
      rent = sq.rent[5];
    } else if (d.houses > 0) {
      rent = sq.rent[d.houses as 1 | 2 | 3 | 4];
    } else if (ownsGroup(s, d.owner, sq.group) && groupUnmortgaged(s, sq.group)) {
      // המונופול: שכ"ד כפול על קבוצה שלמה בלתי מבונה, ורק אם אף שטר לא משוכן.
      rent = sq.rent[0] * 2;
    } else {
      rent = sq.rent[0];
    }
  } else if (sq.type === "transport") {
    const owned = countOwned(s, d.owner, "transport");
    rent = owned === 0 ? 0 : sq.rent[owned - 1]!;
    if (forced === "transport_double") rent *= 2;
  } else {
    if (forced === "utility_max") {
      rent = diceSum * sq.multipliers[1];
    } else {
      const owned = countOwned(s, d.owner, "utility");
      rent = owned === 0 ? 0 : diceSum * sq.multipliers[owned === 1 ? 0 : 1];
    }
  }

  return Math.round(rent * rentSurge(s));
}

/** מכפיל שכ"ד מוגדל בסוף משחק מתוזמן. מנוף נגד תקיעות — ראה spec §5.13. */
export function rentSurge(s: GameState): number {
  const after = s.settings.rentSurgeAfterMinutes;
  if (after === null || s.finishedAt !== null) return 1;
  const elapsed = (s.turnDeadline ?? s.startedAt) - s.startedAt;
  return elapsed >= after * 60_000 ? s.settings.rentSurgeMultiplier : 1;
}

/** עלות בית בקבוצה של המיקום. */
export function houseCost(pos: number): number {
  const sq = squareAt(pos);
  if (sq.type !== "property") throw new TypeError(`אי אפשר לבנות על ${pos}`);
  return group(sq.group).houseCost;
}

/** כמו houseCost אבל 0 למשבצות שאי אפשר לבנות עליהן, לחישובי שווי. */
function houseCost0(pos: number): number {
  const sq = squareAt(pos);
  return sq.type === "property" ? group(sq.group).houseCost : 0;
}

/**
 * יחידות הבנייה על שטר — כלומר כמה פעמים שולם houseCost עליו.
 * מלון הוא הסף ועוד אחת: במצב מלא 5, במצב מהיר 4.
 */
export function buildingUnits(s: GameState, d: DeedState): number {
  return d.hotel ? s.settings.hotelThreshold + 1 : d.houses;
}

/**
 * שווי נקי — קובע את המנצח בסיום מתוזמן.
 * מלון נספר כחמש יחידות בנייה, בדיוק כמו בחוק הבנייה השווה.
 */
export function netWorth(s: GameState, seat: number): number {
  let total = player(s, seat).cash;
  for (const pos of DEED_POSITIONS) {
    const d = s.deeds[pos]!;
    if (d.owner !== seat) continue;
    const sq = deedAt(pos);
    total += d.mortgaged ? sq.mortgage : sq.price;
    total += houseCost0(pos) * buildingUnits(s, d);
  }
  return total;
}

/** כל מה שהשחקן יכול לממש כדי לכסות חוב, בלי לסחור. */
export function liquidValue(s: GameState, seat: number): number {
  let total = player(s, seat).cash;
  for (const pos of DEED_POSITIONS) {
    const d = s.deeds[pos]!;
    if (d.owner !== seat) continue;
    const sq = deedAt(pos);
    total += (houseCost0(pos) * buildingUnits(s, d)) / 2;
    if (!d.mortgaged) total += sq.mortgage;
  }
  return total;
}

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt);
}

/** מלאי הבתים הפנוי, כולל בתים שחזרו מבניית מלונות. */
export function bankHouses(s: GameState): number {
  return s.bank.houses;
}

export const START_BONUS_POS = 0;
export const JAIL_POS = 10;
export const GOTO_JAIL_POS = 30;
export const BOARD_SIZE = BOARD.board.length;

/**
 * המושב של משתמש, לפי המצב עצמו.
 *
 * שני מספורים חיים במקביל: המושב בטבלת החדר, והאינדקס במערך השחקנים
 * שנבנה ממנה. הם מסכימים רק כל עוד המושבים רצופים מאפס — ורגע שהם
 * מתפצלים, הלקוח משחק בשם שחקן אחר ורואה את הווידאו של עצמו במשבצת שלו.
 * מזהה המשתמש הוא היחיד שאינו תלוי במספור, ולכן הוא הקובע.
 */
export function seatOf(
  players: readonly { userId: string; seat: number }[], userId: string,
): number | null {
  const me = players.find((p) => p.userId === userId);
  return me ? me.seat : null;
}
