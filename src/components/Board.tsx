import { BOARD, SQUARES } from "@/lib/board";
import { GRID } from "@/lib/geometry";
import type { GameState } from "@/engine/types";
import { Tile } from "./Tile";
import { TokenLayer } from "./TokenLayer";

/**
 * הלוח, ברשת 11×11.
 *
 * הרשת מוגדרת direction: ltr במכוון (ראה geometry.ts) — זו מערכת קואורדינטות
 * יציבה. רק הטקסט בתוך המשבצות הוא RTL. הליבה 9×9 שמורה לווידאו ולפעולות.
 */
export function Board({ state, center }: {
  state: GameState | null;
  center: React.ReactNode;
}) {
  return (
    // h-full בלבד, בלי w-full: הרוחב נגזר מהגובה דרך aspect-square. שניהם
    // יחד יוצרים תלות מעגלית מול עמודת auto, והלוח גולש מהמסך.
    <div className="board relative aspect-square h-full max-w-full select-none rounded-lg
                    bg-felt p-[6px] shadow-2xl ring-1 ring-black/40"
         style={{ direction: "ltr", unicodeBidi: "isolate" } as React.CSSProperties}>
      <div className="grid h-full w-full gap-[3px]"
           role="grid"
           aria-label={`לוח ${BOARD.meta.name} — ${SQUARES.length} משבצות`}
           style={{
             gridTemplateColumns: `1.5fr repeat(${GRID - 2}, 1fr) 1.5fr`,
             gridTemplateRows: `1.5fr repeat(${GRID - 2}, 1fr) 1.5fr`,
           }}>
        {SQUARES.map((sq) => <Tile key={sq.pos} square={sq} state={state} />)}

        <div style={{ gridRow: `2 / ${GRID}`, gridColumn: `2 / ${GRID}` }}
             className="relative min-h-0 min-w-0">
          {center}
        </div>
      </div>

      {/* שכבת החיילים ממוקמת בדיוק על הרשת ולא על המסגרת החיצונית,
          אחרת ריפוד הלוח היה מסיט את כל האחוזים. */}
      {state && (
        <div className="pointer-events-none absolute inset-[6px]">
          <TokenLayer state={state} />
        </div>
      )}
    </div>
  );
}
