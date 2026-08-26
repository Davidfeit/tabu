const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value, size = 34 }: { value: number; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img"
         aria-label={`קוביה: ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18"
            fill="#f5f0e4" stroke="rgba(0,0,0,.35)" strokeWidth="4" />
      {PIPS[value]?.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1a1a1a" />
      ))}
    </svg>
  );
}

export function Dice({ dice, size }: { dice: [number, number] | null; size?: number }) {
  if (!dice) return null;
  const [a, b] = dice;
  return (
    <div className="flex items-center gap-1.5" style={{ direction: "ltr" }}>
      <Die value={a} size={size} />
      <Die value={b} size={size} />
      {a === b && (
        <span className="mr-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[0.65rem]
                         font-semibold text-amber-200">
          כפולים
        </span>
      )}
    </div>
  );
}
