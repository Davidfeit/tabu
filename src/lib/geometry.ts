/**
 * גיאומטריית הלוח: מיפוי מיקום 0–39 לתא ברשת 11×11.
 *
 * ── למה הלוח לא מתהפך ב-RTL ──
 * כיוון התנועה הוא מרחב-משחק, לא כיוון טקסט. אלגוריתם ה-bidi חל על רצפי טקסט
 * ואין לו מה לומר על מסלול של חייל; שיקוף לוח משחק הוא טעות קטגוריה, בדיוק
 * כמו שיקוף לוח שחמט. חוץ מזה הכיוון הקלאסי ממילא ידידותי ל-RTL: זינוק בפינה
 * הימנית-תחתונה, והשורה הראשונה נעה שמאלה — בדיוק כמו קריאה בעברית.
 *
 * לכן הרשת עצמה מוגדרת ב-`direction: ltr` (ראה index.css). זו מערכת קואורדינטות
 * יציבה; בלעדיה שורש RTL היה הופך בשקט את חישובי grid-column, ומשבצת 1 הייתה
 * מרונדרת במקום 39.
 *
 * המסלול, עם כיוון השעון:
 *   0        פינה ימנית-תחתונה (זינוק)
 *   1–9      שורה תחתונה, נעה שמאלה
 *   10       פינה שמאלית-תחתונה (מעצר בית)
 *   11–19    עמודה שמאלית, נעה למעלה
 *   20       פינה שמאלית-עליונה (חופשה באילת)
 *   21–29    שורה עליונה, נעה ימינה
 *   30       פינה ימנית-עליונה (הוצאה לפועל)
 *   31–39    עמודה ימנית, נעה למטה
 */

export const GRID = 11;
export const SQUARE_COUNT = 40;

/** באיזו צלע יושבת המשבצת. קובע היכן פס הצבע ואיך מסובבת התווית. */
export type Side = "bottom" | "left" | "top" | "right";

export interface Cell {
  /** שורה ברשת, 1-indexed (1 = עליונה) */
  row: number;
  /** עמודה ברשת, 1-indexed (1 = שמאלית) */
  col: number;
  side: Side;
  isCorner: boolean;
}

export function cellFor(pos: number): Cell {
  if (!Number.isInteger(pos) || pos < 0 || pos >= SQUARE_COUNT) {
    throw new RangeError(`מיקום מחוץ לתחום: ${pos}`);
  }
  if (pos === 0) return { row: GRID, col: GRID, side: "bottom", isCorner: true };
  if (pos < 10) return { row: GRID, col: GRID - pos, side: "bottom", isCorner: false };
  if (pos === 10) return { row: GRID, col: 1, side: "left", isCorner: true };
  if (pos < 20) return { row: GRID + 10 - pos, col: 1, side: "left", isCorner: false };
  if (pos === 20) return { row: 1, col: 1, side: "top", isCorner: true };
  if (pos < 30) return { row: 1, col: pos - 19, side: "top", isCorner: false };
  if (pos === 30) return { row: 1, col: GRID, side: "right", isCorner: true };
  return { row: pos - 29, col: GRID, side: "right", isCorner: false };
}

/**
 * סיבוב תווית המשבצת, במעלות.
 *
 * לעברית אין צורה טיפוגרפית אנכית, ולכן אסור להשתמש ב-writing-mode: vertical-rl —
 * הוא מייצר גליפים מסובבים עם סידור שגוי. במקום זה מסובבים גוש טקסט אופקי שלם,
 * כך שהעברית נשארת בצורתה הרגילה, רק פנתה.
 *
 * ── הסיבובים הפוכים ממה שהאינטואיציה הלטינית אומרת ──
 * טקסט עברי זורם בכיוון ‎-x‎ (ימין לשמאל). סיבוב נגד כיוון השעון (‎-90°‎) ממפה
 * את ‎-x‎ ל-‎+y‎, כלומר כלפי מטה. לכן כדי שהעמודה השמאלית תיקרא מלמטה למעלה
 * דרוש דווקא ‎+90°‎ — ההפך מלטינית, שבה הזרימה היא ‎+x‎.
 *
 * שמאל נקראת מלמטה למעלה, ימין מלמעלה למטה — כלומר כל אחת פונה הרחק ממרכז
 * הלוח. השורה העליונה נשארת זקופה למען קריאוּת, בשונה מהלוח הפיזי שבו היא
 * הפוכה ב-180°.
 */
export function labelRotation(side: Side): number {
  switch (side) {
    case "left": return 90;
    case "right": return -90;
    default: return 0;
  }
}

/** באיזו צלע של המשבצת יושב פס הצבע — תמיד זו שפונה למרכז הלוח. */
export function colorBarEdge(side: Side): "top" | "bottom" | "left" | "right" {
  switch (side) {
    case "bottom": return "top";
    case "top": return "bottom";
    case "left": return "right";
    case "right": return "left";
  }
}

/**
 * כיוון החץ המציין את מהלך התור, במעלות סיבוב של SVG שמצביע ימינה כברירת מחדל.
 *
 * זהו הבאג מספר 1 במשחקי לוח RTL: תו חץ ← שגיליון סגנון RTL הפך ל-→ וכעת סותר
 * את תנועת החייל. הסיבוב כאן נגזר מגיאומטריית הלוח, ולעולם לא מתו טקסט.
 */
export function travelArrowRotation(side: Side): number {
  switch (side) {
    case "bottom": return 180; // נע שמאלה
    case "left": return 270;   // נע למעלה
    case "top": return 0;      // נע ימינה
    case "right": return 90;   // נע למטה
  }
}

/** רוחב פס הצבע, באחוזים מהמשבצת. */
export const BAR_PERCENT = 18;

export type Edge = "top" | "bottom" | "left" | "right";
export interface Inset { top: number; right: number; bottom: number; left: number }

/**
 * אזור התוכן של המשבצת: הכל פחות פס הצבע.
 *
 * נגזר מהצלע שעליה יושב הפס, ולא נכתב ביד. גרסה קודמת החזיקה מפה ידנית של
 * מחלקות CSS ושני מפתחות בה הוחלפו — משבצת עם פס בימין קיבלה תוכן שנמנע
 * מהחלק העליון, והטקסט בעמודות הצד ישב מוסט.
 */
export function contentInset(barEdge: Edge): Inset {
  const inset: Inset = { top: 0, right: 0, bottom: 0, left: 0 };
  inset[barEdge] = BAR_PERCENT;
  return inset;
}

/**
 * ── קואורדינטות לשכבת החיילים ──
 *
 * החיילים לא יושבים *בתוך* המשבצות אלא בשכבה מוחלטת מעל הלוח, כי אחרת
 * אי אפשר להנפיש תנועה: אלמנט שעובר מהורה אחד לאחר קופץ ולא זז.
 *
 * הרשת היא `1.5fr repeat(9,1fr) 1.5fr` — הפינות רחבות פי 1.5 מהמשבצות
 * הרגילות. סך הכל 12 יחידות לכל ציר.
 */
export const CORNER_UNITS = 1.5;
export const TOTAL_UNITS = CORNER_UNITS * 2 + (GRID - 2);

/** רוחב עמודה (או גובה שורה) ביחידות רשת. */
function trackSize(index: number): number {
  return index === 1 || index === GRID ? CORNER_UNITS : 1;
}

/** קצה המסלול, ביחידות, מתחילת הציר. */
function trackStart(index: number): number {
  let sum = 0;
  for (let i = 1; i < index; i++) sum += trackSize(i);
  return sum;
}

export interface Point { xPct: number; yPct: number }

/** מרכז המשבצת באחוזים מרוחב וגובה הלוח. */
export function cellCenter(pos: number): Point {
  const { row, col } = cellFor(pos);
  return {
    xPct: ((trackStart(col) + trackSize(col) / 2) / TOTAL_UNITS) * 100,
    yPct: ((trackStart(row) + trackSize(row) / 2) / TOTAL_UNITS) * 100,
  };
}

/** חצי משבצת רגילה, באחוזים. זהו הגבול שחייל לא אמור לחרוג ממנו. */
export const HALF_CELL_PCT = 100 / TOTAL_UNITS / 2;

/** רוחב חייל בודד, באחוזים מרוחב הלוח. */
export const TOKEN_PCT = 4.2;

/** יחס גובה-רוחב של החייל, כמו ב-Token.tsx. */
export const TOKEN_ASPECT = 53 / 40;

/**
 * הקטנת חיילים כשהם צפופים על משבצת אחת.
 *
 * בלי זה, ארבעה חיילים כתף אל כתף חורגים הרבה מעבר לרוחב המשבצת.
 */
export function crowdScale(total: number): number {
  if (total <= 2) return 1;
  if (total <= 4) return 0.84;
  return 0.72;
}

/** מידות חייל בודד באחוזים מהלוח, אחרי הקטנת צפיפות. */
export function tokenSize(total: number): { w: number; h: number } {
  const w = TOKEN_PCT * crowdScale(total);
  return { w, h: w * TOKEN_ASPECT };
}

/** חצי משבצת בכל ציר. פינה רחבה מחצי משבצת רגילה. */
function halfCell(pos: number): Point {
  const { row, col } = cellFor(pos);
  return {
    xPct: (trackSize(col) / 2 / TOTAL_UNITS) * 100,
    yPct: (trackSize(row) / 2 / TOTAL_UNITS) * 100,
  };
}

/**
 * איפה החייל *עומד* — נקודת כפות הרגליים, לא מרכז הגוף.
 *
 * שתי בעיות נפתרות כאן יחד. חייל שמצויר על המשבצת מסתיר בדיוק את מה
 * שצריך לקרוא — שם העיר והמחיר — ודווקא מטשטש את המיקום שהוא אמור
 * להבליט; ופיזור צפיפות במעגל סביב נקודה גרם לארבעה חיילים להיערם זה על
 * זה ולהיראות שוכבים.
 *
 * לכן: כפות הרגליים על קו אחד בטבעת הלבד שמחוץ למשבצת, והצפופים נפרשים
 * כתף אל כתף לאורך הקו במקום להצטופף סביב נקודה.
 */
export function standFor(pos: number, indexInCell: number, total: number): Point {
  const c = cellCenter(pos);
  const { row, col } = cellFor(pos);
  const { w } = tokenSize(total);
  const half = halfCell(pos);
  const spread = (indexInCell - (total - 1) / 2) * w * 0.75;

  // פינה: שתי הצלעות שכנות לה, ודחיפה בציר אחד בלבד הייתה מעלה את החייל
  // על המשבצת של הצלע השנייה. לכן דחיפה אלכסונית, אל תוך הלבד.
  const vertical = row === 1 || row === GRID;
  const horizontal = col === 1 || col === GRID;
  if (vertical && horizontal) {
    const sx = col === GRID ? -1 : 1;
    const sy = row === GRID ? -1 : 1;
    return {
      xPct: c.xPct + sx * (half.xPct + w / 2) + spread,
      yPct: c.yPct + sy * half.yPct,
    };
  }

  // כפות הרגליים תמיד על הצלע הפנימית של המשבצת עצמה. הכיוון שאליו הגוף
  // יוצא נקבע בסיבוב (standRotation), ולא בהיסט — כך התחתית נשענת על
  // המשבצת בכל ארבע הצלעות.
  if (row === 1) return { xPct: c.xPct + spread, yPct: c.yPct + half.yPct };
  if (row === GRID) return { xPct: c.xPct + spread, yPct: c.yPct - half.yPct };

  // עמודות: כפות הרגליים על הצלע הפנימית עצמה. הגוף יוצא ממנה פנימה
  // בזכות הסיבוב (ראה standRotation), בדיוק כמו בשורה התחתונה.
  const dir = col === 1 ? 1 : -1;
  return { xPct: c.xPct + dir * half.xPct, yPct: c.yPct + spread };
}

/**
 * סיבוב החייל, במעלות.
 *
 * הכלל אחד: תחתית החייל נשענת על המשבצת שלו, והגוף יוצא ממנה החוצה אל
 * טבעת הלבד. לכן הסיבוב נגזר מהצלע שעליה המשבצת יושבת — בשורה העליונה
 * החייל הפוך, כי שם "החוצה" הוא כלפי מטה.
 */
export function standRotation(pos: number): number {
  const { row, col } = cellFor(pos);
  if (row === GRID) return 0;      // שורה תחתונה ופינותיה — הגוף כלפי מעלה
  if (row === 1) return 180;       // שורה עליונה ופינותיה — הגוף כלפי מטה
  return col === 1 ? 90 : -90;     // עמודות — הגוף פנימה
}

/**
 * מסלול התנועה בין שתי משבצות, כולל את שתיהן.
 *
 * תמיד קדימה עם כיוון השעון וגולש סביב הלוח — כך שמעבר מ-38 ל-2 עובר דרך
 * הזינוק ונראה נכון, במקום לחתוך אחורה על פני חצי לוח.
 */
export function pathBetween(from: number, to: number): number[] {
  const steps: number[] = [from];
  let cur = from;
  for (let guard = 0; guard < SQUARE_COUNT && cur !== to; guard++) {
    cur = (cur + 1) % SQUARE_COUNT;
    steps.push(cur);
  }
  return steps;
}
