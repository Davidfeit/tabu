import { darken, lighten } from "@/lib/shade";

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

/** צבע קבוע לכל מושב. משמש בחייל, בסרגל הבעלות ובפאנל השחקנים. */
export function seatColor(seat: number): string {
  return COLORS[seat % COLORS.length]!;
}

/** סמל החייל, מצויר בתוך ראש הכלי. */
const GLYPHS: Record<string, string> = {
  camel: "🐪", scooter: "🛵", tank: "🚰", pack: "🎒",
  boat: "⛵", tractor: "🚜", jerrican: "⛽", hat: "🧢",
};

/**
 * חייל משחק, בנפח.
 *
 * צללית של כלי לוח קלאסי — ראש כדורי, גוף מתחדד ובסיס רחב — מצוירת
 * ב-SVG עם שלושה גוונים שנגזרים מצבע המושב: מואר בצד אחד, מוצל בשני,
 * והדגש נקודתי על הראש. אליפסת צל מתחתיו מקבעת אותו על הלוח.
 *
 * גוונים נגזרים ולא נבחרים ביד — כך כל שישה המושבים נראים כחלק מאותה
 * ערכה, וצבע חדש לא דורש כוונון נוסף.
 */
export function Token({ token, seat, size = 22, dimmed = false }: {
  token: string; seat: number;
  /** מספר = פיקסלים. מחרוזת = כל אורך CSS, למשל "3.4cqw" — כך החייל גדל
   *  יחד עם הלוח במקום להישאר קבוע ולהיראות זעיר במסך גדול. */
  size?: number | string;
  dimmed?: boolean;
}) {
  const base = seatColor(seat);
  const light = lighten(base, 0.45);
  const dark = darken(base, 0.4);
  const deep = darken(base, 0.62);
  const id = `pawn-${seat}`;
  // הכלי גבוה מרוחבו ביחס 40:53; הצל יושב בבסיס.
  const w = typeof size === "number" ? `${size}px` : size;

  return (
    <span className="tabu-pawn relative inline-block align-middle"
          style={{ width: w, aspectRatio: "40 / 53", opacity: dimmed ? 0.42 : 1,
                   containerType: "inline-size" }}>
      <svg viewBox="0 0 40 53" width="100%" height="100%" aria-hidden="true"
           style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={light} />
            <stop offset="42%"  stopColor={base} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
          <radialGradient id={`${id}-head`} cx="0.34" cy="0.3" r="0.78">
            <stop offset="0%"   stopColor={lighten(base, 0.75)} />
            <stop offset="45%"  stopColor={base} />
            <stop offset="100%" stopColor={deep} />
          </radialGradient>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={base} />
            <stop offset="55%"  stopColor={dark} />
            <stop offset="100%" stopColor={deep} />
          </linearGradient>
        </defs>

        {/* צל על הלוח — מה שמקבע את הכלי במקום ולא מרחף */}
        <ellipse cx="20" cy="49.5" rx="13" ry="3.4" fill="rgb(0 0 0 / 0.42)" />

        {/* בסיס */}
        <ellipse cx="20" cy="46" rx="12.5" ry="4" fill={`url(#${id}-base)`} />
        <path d="M9 44c1-4 4-6 11-6s10 2 11 6z" fill={`url(#${id}-base)`} />

        {/* גוף מתחדד */}
        <path d="M13.5 41c-1.5-7 2-11 2.5-15h8c.5 4 4 8 2.5 15z"
              fill={`url(#${id}-body)`} />
        {/* טבעת הצוואר */}
        <ellipse cx="20" cy="25.5" rx="5.4" ry="1.7" fill={deep} opacity="0.75" />

        {/* ראש */}
        <circle cx="20" cy="16.5" r="11" fill={`url(#${id}-head)`} />
        <circle cx="20" cy="16.5" r="11" fill="none"
                stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.9" />
        {/* הדגש הספקולרי */}
        <ellipse cx="15.5" cy="11.5" rx="4.2" ry="2.9"
                 fill="rgb(255 255 255 / 0.42)" transform="rotate(-28 15.5 11.5)" />
      </svg>

      {/* הסמל על הראש. הגודל ביחידות מכולה, כדי שיגדל יחד עם הכלי. */}
      <span className="pointer-events-none absolute flex items-center justify-center"
            style={{ left: "10%", right: "10%", top: "8%", height: "42%",
                     fontSize: "50cqw", lineHeight: 1,
                     filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.5))" }}
            aria-hidden="true">
        {GLYPHS[token] ?? ""}
      </span>
    </span>
  );
}
