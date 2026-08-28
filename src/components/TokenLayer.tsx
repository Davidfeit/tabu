import { cellCenter, crowdOffset, crowdScale, inwardOffset, TOKEN_PCT } from "@/lib/geometry";
import { useTokenMotion } from "@/ui/useTokenMotion";
import type { GameState } from "@/engine/types";
import { Token } from "./Token";

/**
 * החיילים, בשכבה מוחלטת מעל הלוח.
 *
 * הם לא יושבים בתוך אלמנטי המשבצות בכוונה: אלמנט שעובר מהורה אחד לאחר
 * קופץ במקום לזוז, ולכן אי אפשר להנפיש תנועה בלי שכבה משותפת.
 */
export function TokenLayer({ state }: { state: GameState }) {
  const motion = useTokenMotion(state);
  const active = state.players.filter((p) => !p.bankrupt);

  // כמה חיילים על כל משבצת, כדי לפזר אותם ולא להסתיר זה את זה.
  const perCell = new Map<number, number[]>();
  for (const p of active) {
    const pos = motion.get(p.seat)?.pos ?? p.pos;
    const list = perCell.get(pos) ?? [];
    list.push(p.seat);
    perCell.set(pos, list);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20"
         style={{ containerType: "inline-size" }} aria-hidden="true">
      {active.map((p) => {
        const m = motion.get(p.seat);
        const pos = m?.pos ?? p.pos;
        const crowd = perCell.get(pos) ?? [p.seat];
        const off = crowdOffset(crowd.indexOf(p.seat), crowd.length);
        // הרוחב ביחידות מכולה של הלוח — חייל בגודל פיקסלים קבוע נראה
        // זעיר במסך גדול ומגושם במסך קטן.
        const width = `${TOKEN_PCT * crowdScale(crowd.length)}cqw`;
        const { xPct, yPct } = cellCenter(pos);
        // דחיפה אל טבעת הלבד שמחוץ למשבצת — ראה inwardOffset.
        const inward = inwardOffset(pos);
        const isTurn = p.seat === state.currentSeat;

        return (
          <div key={p.seat}
               className="tabu-token absolute"
               data-walking={m?.walking ? "true" : undefined}
               style={{
                 left: `${xPct + inward.xPct + off.xPct}%`,
                 top: `${yPct + inward.yPct + off.yPct}%`,
                 // ההעברה על left/top ולא על transform, כדי ש-transform
                 // יישאר פנוי לקפיצה האנכית של ההליכה.
                 transitionDuration: m?.walking ? "100ms" : "260ms",
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
