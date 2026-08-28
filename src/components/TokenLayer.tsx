import { standFor, tokenSize } from "@/lib/geometry";
import { useMotion } from "@/ui/MotionContext";
import { STEP_MS } from "@/ui/useTokenMotion";
import type { GameState } from "@/engine/types";
import { Token } from "./Token";

/**
 * החיילים, בשכבה מוחלטת מעל הלוח.
 *
 * הם לא יושבים בתוך אלמנטי המשבצות בכוונה: אלמנט שעובר מהורה אחד לאחר
 * קופץ במקום לזוז, ולכן אי אפשר להנפיש תנועה בלי שכבה משותפת.
 */
export function TokenLayer({ state }: { state: GameState }) {
  const { bySeat } = useMotion();
  const active = state.players.filter((p) => !p.bankrupt);

  // כמה חיילים על כל משבצת, כדי לפזר אותם ולא להסתיר זה את זה.
  const perCell = new Map<number, number[]>();
  for (const p of active) {
    const pos = bySeat.get(p.seat)?.pos ?? p.pos;
    const list = perCell.get(pos) ?? [];
    list.push(p.seat);
    perCell.set(pos, list);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20"
         style={{ containerType: "inline-size" }} aria-hidden="true">
      {active.map((p) => {
        const m = bySeat.get(p.seat);
        const pos = m?.pos ?? p.pos;
        const crowd = perCell.get(pos) ?? [p.seat];
        // הרוחב ביחידות מכולה של הלוח — חייל בגודל פיקסלים קבוע נראה
        // זעיר במסך גדול ומגושם במסך קטן.
        const width = `${tokenSize(crowd.length).w}cqw`;
        // הנקודה היא כפות הרגליים, לא המרכז — ראה standFor.
        const { xPct, yPct } = standFor(pos, crowd.indexOf(p.seat), crowd.length);
        const isTurn = p.seat === state.currentSeat;

        return (
          <div key={p.seat}
               className="tabu-token absolute"
               data-walking={m?.walking ? "true" : undefined}
               style={{
                 left: `${xPct}%`,
                 top: `${yPct}%`,
                 // ההעברה על left/top ולא על transform, כדי ש-transform
                 // יישאר פנוי לקפיצה האנכית של ההליכה.
                 // בדיוק אורך הצעד: מרווח בין המעברים מייצר עצירה זעירה
                 // בכל משבצת, וזה מה שנקרא קופצני.
                 transitionDuration: m?.walking ? `${STEP_MS}ms` : "260ms",
                 zIndex: isTurn ? 3 : 2,
               }}>
            <span className="tabu-token__inner block">
              <Token token={p.token} seat={p.seat} size={width}
                     dimmed={p.inJail && pos === 10} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
