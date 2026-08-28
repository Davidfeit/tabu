/**
 * עיצוב מספרים וכסף.
 *
 * ₪ (U+20AA) הוא European Terminator ב-bidi, ולכן הוא מצטרף לרצף הספרות הסמוך
 * והסדר הלוגי קובע את המיקום החזותי. האקדמיה ללשון ממליצה על ₪ משמאל למספר,
 * בלי רווח — כלומר יש לכתוב אותו *לפני* הספרות.
 */

/** U+200E‎ U+200F‏ U+061C؜ U+00A0 — תווי כיווניות ורווח קשיח בלתי נראים. */
const BIDI_CONTROLS = /[‎‏؜ ]/g;

/**
 * Intl בלוקאל he-IL מזריק תווי כיווניות בלתי נראים — LRM לפני מספר שלילי,
 * ו-RLM + NBSP סביב סימן המטבע ב-style:"currency". התווים האלה משבשים מדידות
 * רוחב, חישובי text-overflow ו-snapshots בטסטים, והם מיותרים כאן: אנחנו קובעים
 * את המיקום בעצמנו דרך הסדר הלוגי. מסירים אותם.
 */
function clean(s: string): string {
  return s.replace(BIDI_CONTROLS, "");
}

const whole = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

export function shekel(n: number): string {
  return "₪" + clean(whole.format(n));
}

/**
 * קיצור למשבצות צרות.
 *
 * בקנה המידה של הלוח (60–420 למשבצת, 1,500 מזומן פתיחה) אין מה לקצר, וקיצור
 * דווקא הזיק: ₪1,500 היה מוצג "₪2 א׳". נשמר כשם נפרד כי הכוונה בקריאה שונה —
 * "כאן אין מקום" — ואם יתווסף אי פעם מצב עם סכומים גדולים, זה המקום היחיד
 * שצריך לגעת בו.
 */
export function shekelShort(n: number): string {
  return shekel(n);
}
