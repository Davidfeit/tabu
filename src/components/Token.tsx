const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

/** צבע קבוע לכל מושב. משמש בחייל, בסרגל הבעלות ובפאנל השחקנים. */
export function seatColor(seat: number): string {
  return COLORS[seat % COLORS.length]!;
}

const GLYPHS: Record<string, string> = {
  camel: "🐪", scooter: "🛵", tank: "🚰", pack: "🎒",
  boat: "⛵", tractor: "🚜", jerrican: "⛽", hat: "🧢",
};

export function Token({ token, seat, size = 18, dimmed = false }: {
  token: string; seat: number; size?: number; dimmed?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full
                 ring-2 ring-white/80 shadow"
      style={{
        width: size, height: size, fontSize: size * 0.62,
        backgroundColor: seatColor(seat),
        opacity: dimmed ? 0.35 : 1,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {GLYPHS[token] ?? "●"}
    </span>
  );
}
