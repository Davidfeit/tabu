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
const oneDecimal = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });

export function shekel(n: number): string {
  return "₪" + clean(whole.format(n));
}

/** קיצור למשבצות צרות. גרש (U+05F3), לא אפוסטרוף. */
export function shekelShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "₪" + clean(oneDecimal.format(n / 1_000_000)) + " מ׳";
  if (Math.abs(n) >= 1_000) return "₪" + clean(whole.format(n / 1_000)) + " א׳";
  return shekel(n);
}
