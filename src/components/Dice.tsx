import { useEffect, useRef, useState } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

const TUMBLE_MS = 480;

/**
 * כמה זמן הגלגול נמשך על המסך, כולל ההשהיה של הקובייה השנייה.
 *
 * מיוצא כי התזוזה של החייל מחכה לו: חייל שיוצא לדרך בזמן שהקוביות עוד
 * מתגלגלות מספר את התוצאה לפני שהיא נקראה.
 */
export const DICE_MS = TUMBLE_MS + 90;

function Die({ value, size, rolling, delay }: {
  value: number; size: number; rolling: boolean; delay: number;
}) {
  // בזמן הגלגול מוצגות פאות מתחלפות. הערך האמיתי כבר נקבע במנוע —
  // זו הנפשה בלבד, ולא מקור ההגרלה.
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) { setFace(value); return; }
    let n = 0;
    const id = setInterval(() => setFace(((n++ * 3) % 6) + 1), 70);
    const stop = setTimeout(() => { clearInterval(id); setFace(value); },
                            TUMBLE_MS + delay);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [rolling, value, delay]);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img"
         aria-label={`קוביה: ${value}`} className="tabu-die"
         data-rolling={rolling ? "true" : undefined}
         style={{ animationDelay: `${delay}ms` }}>
      <rect x="4" y="4" width="92" height="92" rx="18"
            fill="#f5f0e4" stroke="rgba(0,0,0,.35)" strokeWidth="4" />
      {PIPS[face]?.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1a1a1a" />
      ))}
    </svg>
  );
}

export function Dice({ dice, size = 34 }: {
  dice: [number, number] | null; size?: number;
}) {
  const [rolling, setRolling] = useState(false);
  // undefined = טרם הורכב. מבדיל בין הרכבה ראשונה, שבה אין להנפיש מצב
  // שנטען מהשרת, לבין הגלגול הראשון האמיתי — שכן צריך להיות מונפש.
  const previous = useRef<string | null | undefined>(undefined);

  const key = dice ? `${dice[0]}-${dice[1]}` : null;
  useEffect(() => {
    if (previous.current === undefined) { previous.current = key; return; }
    if (key === previous.current) return;
    previous.current = key;
    if (key === null) return;
    setRolling(true);
    const id = setTimeout(() => setRolling(false), DICE_MS);
    return () => clearTimeout(id);
  }, [key]);

  if (!dice) return null;
  const [a, b] = dice;

  return (
    <div className="flex items-center gap-1.5" style={{ direction: "ltr" }}>
      <Die value={a} size={size} rolling={rolling} delay={0} />
      <Die value={b} size={size} rolling={rolling} delay={90} />
      {a === b && !rolling && (
        <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[0.65rem]
                         font-semibold text-amber-200">
          כפולים
        </span>
      )}
    </div>
  );
}
