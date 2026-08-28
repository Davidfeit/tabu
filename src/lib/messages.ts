import { squareAt } from "./board";
import { shekel } from "./format";
import type { ErrorCode, GameEvent, GameState } from "@/engine/types";

/**
 * לוקליזציה.
 *
 * ── למה סגנון טיקר ולא משפטים ──
 * פעלים בעברית ממוגדרים ("גלגל" מול "גלגלה"), ואנחנו לא יודעים את המגדר של
 * אף שחקן ואין סיבה לשאול. ניסוח שמי — "דנה — קוביות 6+3", "תל אביב → יואב" —
 * נמנע מהבעיה לגמרי, וממילא קריא יותר ביומן משחק מהיר.
 *
 * המנוע מחזיר קודים מכונתיים בלבד — הניסוח העברי חי כאן. זה מה שמאפשר
 * לבדוק את המנוע בלי מחרוזות, ולשנות נוסח בלי לגעת בחוקים.
 *
 * המשפטים נבנים מתבניות ולא בשרשור. שרשור רסיסים הוא המקום שבו נולדים
 * באגי bidi, במיוחד כשמספר יושב באמצע משפט עברי.
 */

const ERRORS: Record<ErrorCode, string> = {
  NOT_YOUR_TURN: "לא תורך",
  WRONG_PHASE: "אי אפשר לעשות את זה עכשיו",
  INSUFFICIENT_FUNDS: "אין מספיק מזומן",
  NOT_OWNER: "הנכס לא שלך",
  NOT_FOR_SALE: "הנכס לא למכירה",
  ALREADY_OWNED: "לנכס כבר יש בעלים",
  NOT_A_DEED: "אי אפשר להחזיק את המשבצת הזו",
  GROUP_INCOMPLETE: "צריך להחזיק את כל קבוצת הצבע, ואף שטר בה לא משוכן",
  UNEVEN_BUILD: "חוק הבנייה השווה — צריך לבנות ולמכור אחיד בכל הקבוצה",
  NO_HOUSES_LEFT: "נגמרו הבתים בבנק",
  NO_HOTELS_LEFT: "נגמרו המלונות בבנק",
  HAS_BUILDINGS: "יש בנייה בקבוצה — צריך למכור אותה קודם",
  ALREADY_MORTGAGED: "הנכס כבר משוכן",
  NOT_MORTGAGED: "הנכס אינו משוכן",
  MAX_DEVELOPED: "אין מה לבנות מעבר למלון",
  NO_BUILDINGS: "אין כאן בנייה למכירה",
  NOT_IN_JAIL: "לא במעצר בית",
  NO_JAIL_CARD: "אין לך כרטיס יציאה",
  BID_TOO_LOW: "ההצעה נמוכה מדי",
  ALREADY_PASSED: "כבר פסחת על המכרז הזה",
  NO_AUCTION: "אין מכרז פעיל",
  NO_TRADE: "אין הצעת עסקה פתוחה",
  NOT_TRADE_TARGET: "ההצעה לא מיועדת לך",
  INVALID_TRADE: "ההצעה אינה חוקית",
  GAME_OVER: "המשחק נגמר",
  PLAYER_BANKRUPT: "השחקן פשט את הרגל",
  DEADLINE_NOT_REACHED: "התור עוד לא נגמר",
  NO_DEBT: "אין חוב פתוח",
  CAN_PAY: "יש לך נכסים לכסות את החוב — אי אפשר לוותר",
  UNKNOWN_ACTION: "פעולה לא מוכרת",
  ROOM_FULL: "החדר מלא",
  ALREADY_IN_GAME: "כבר במשחק",
};

/**
 * WRONG_PHASE לפי מה שבאמת חוסם.
 *
 * "אי אפשר לעשות את זה עכשיו" נכון תמיד ולא עוזר לעולם: המשחק יודע
 * בדיוק מה הוא מחכה לו, ולכן הוא יכול לומר את זה. השאלה "למה אי אפשר?"
 * לא צריכה להישאל.
 */
function phaseBlock(s: Pick<GameState, "phase" | "drawnCard">): string {
  if (s.drawnCard) return "יש כרטיס פתוח — סגרו אותו קודם";
  switch (s.phase) {
    case "awaiting_roll": return "צריך לגלגל קוביות קודם";
    case "awaiting_buy":  return "קודם להחליט על הנכס — קנייה או ויתור";
    case "awaiting_end":  return "המשבצת כבר נפתרה — אפשר לבנות, או לסיים תור";
    case "debt":          return "יש חוב פתוח — צריך לגייס כסף או להיכנע";
    case "auction":       return "יש מכרז פעיל";
    case "finished":      return "המשחק נגמר";
    default:              return ERRORS.WRONG_PHASE;
  }
}

export function errorText(
  code: ErrorCode, state?: Pick<GameState, "phase" | "drawnCard">,
): string {
  if (code === "WRONG_PHASE" && state) return phaseBlock(state);
  return ERRORS[code] ?? "משהו השתבש";
}

const name = (pos: unknown): string =>
  typeof pos === "number" ? squareAt(pos).name : "";

const money = (v: unknown): string => shekel(Number(v ?? 0));

type Fmt = (p: Record<string, unknown>, who: string,
            nameOf: (seat: number) => string) => string;


const EVENTS: Record<string, Fmt> = {
  turn_started:      (_p, w) => `התור של ${w}`,
  turn_skipped:      (_p, w) => `${w} — דילוג על התור`,
  rolled:            (p, w) => `${w} — קוביות ${p.d1}+${p.d2}${p.double ? ", כפולים" : ""}`,
  auto_roll:         (_p, w) => `${w} — נגמר הזמן, גלגול אוטומטי`,
  extra_roll:        (_p, w) => `${w} — גלגול נוסף`,
  landed:            (p, w) => `${w} → ${p.name}`,
  pass_start:        (p, w) => `${w} — מעבר בזינוק, ${money(p.amount)}`,
  start_landing_bonus: (p, w) => `${w} — נחיתה על הזינוק, בונוס ${money(p.amount)}`,
  bought:            (p, w) => `${name(p.pos)} → ${w}, ${money(p.price)}`,
  declined:          (p, w) => `${w} — ויתור על ${name(p.pos)}`,
  rent_due:          (p, w) => `${w} — שכר דירה ${money(p.amount)} על ${name(p.pos)}`,
  pay:               (p, w) => `${w} — תשלום ${money(p.amount)}`,
  debt_opened:       (p, w) => `${w} — חוב ${money(p.amount)} ללא כיסוי במזומן, גיוס כספים`,
  debt_settled:      (_p, w) => `${w} — החוב כוסה`,
  auto_liquidate:    (_p, w) => `${w} — חיסול נכסים אוטומטי`,
  cannot_pay:        (p, w) => `${w} — אין כיסוי ל${money(p.amount)}`,
  bankrupt:          (_p, w) => `${w} — פשיטת רגל`,
  jailed:            (_p, w) => `${w} → מעצר בית`,
  three_doubles:     (_p, w) => `${w} — שלושה כפולים ברצף`,
  jail_escaped:      (_p, w) => `${w} — יציאה ממעצר בכפולים`,
  jail_attempt_failed: (p, w) => `${w} — ניסיון ${p.attempt} מתוך 3 נכשל`,
  jail_term_ended:   (_p, w) => `${w} — שלושת הניסיונות תמו, ערובה חובה`,
  jail_paid:         (p, w) => `${w} — ערובה ${money(p.amount)}`,
  jail_card_used:    (_p, w) => `${w} — מימוש כרטיס יציאה`,
  jail_card_received:(_p, w) => `${w} — כרטיס יציאה ממעצר בית`,
  card_drawn:        (p, w) => `${w} — קלף: ${p.text}`,
  card_cash:         (p, w) => `${w} — זיכוי ${money(p.amount)}`,
  skip_queued:       (_p, w) => `${w} — יפסיד את התור הבא`,
  house_built:       (p, w) => `בית ב${name(p.pos)} — ${w}`,
  hotel_built:       (p, w) => `מלון ב${name(p.pos)} — ${w}`,
  house_sold:        (p, w) => `${w} — מכירת בית ב${name(p.pos)}`,
  hotel_sold:        (p, w) => `${w} — פירוק מלון ב${name(p.pos)}`,
  mortgaged:         (p, w) => `${w} — משכון ${name(p.pos)}, ${money(p.amount)}`,
  unmortgaged:       (p, w) => `${w} — פדיון המשכון על ${name(p.pos)}`,
  auction_opened:    (p, _w) => `${name(p.pos)} — יוצא למכרז`,
  player_joined:     (_p, w) => `${w} — הצטרף למשחק`,
  auction_bid:       (p, w) => `${w} — הצעה ${money(p.amount)}`,
  auction_pass:      (_p, w) => `${w} — פאס`,
  auction_won:       (p, w) => `${name(p.pos)} → ${w} במכרז, ${money(p.amount)}`,
  auction_unsold:    (p, _w) => `${name(p.pos)} — אין הצעות, חוזר לבנק`,
  auto_decline:      (_p, w) => `${w} — נגמר הזמן, ויתור אוטומטי`,
  trade_proposed:    (p, w, n) => `${w} — הצעת עסקה ל${n(Number(p.to))}`,
  trade_executed:    (p, w, n) => `עסקה בוצעה — ${w} ו${n(Number(p.with))}`,
  trade_rejected:    (_p, w) => `${w} — דחיית העסקה`,
  pot_collected:     (p, w) => `${w} — הקופה, ${money(p.amount)}`,
  game_over:         (p, w) => p.reason === "time_limit"
                        ? `נגמר הזמן — ניצחון ל${w} בשווי נקי`
                        : `ניצחון ל${w}`,
};

export function eventText(e: GameEvent, playerName: (seat: number) => string): string {
  const who = e.seat === null ? "" : playerName(e.seat);
  const fmt = EVENTS[e.type];
  return fmt ? fmt(e.payload, who, playerName) : e.type;
}

/** אירועים שאין טעם להציג ביומן — רעש. */
export const QUIET_EVENTS = new Set(["landed", "pay", "turn_started"]);
