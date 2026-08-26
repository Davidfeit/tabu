import { BOARD, SQUARES } from "@/lib/board";
import { GRID } from "@/lib/geometry";
import { Tile } from "./Tile";
import { VideoStage } from "./VideoStage";

/**
 * הלוח, ברשת 11×11.
 *
 * הרשת מוגדרת direction: ltr במכוון (ראה geometry.ts) — זו מערכת קואורדינטות
 * יציבה. רק הטקסט בתוך המשבצות הוא RTL. הליבה 9×9 נשארת פנויה לווידאו.
 */
export function Board() {
  return (
    <div className="board relative aspect-square w-full select-none rounded-lg
                    bg-felt p-[6px] shadow-2xl ring-1 ring-black/40"
         style={{ direction: "ltr", unicodeBidi: "isolate" } as React.CSSProperties}>
      <div className="grid h-full w-full gap-[3px]"
           role="grid"
           aria-label={`לוח ${BOARD.meta.name} — ${SQUARES.length} משבצות`}
           style={{
             gridTemplateColumns: `1.5fr repeat(${GRID - 2}, 1fr) 1.5fr`,
             gridTemplateRows: `1.5fr repeat(${GRID - 2}, 1fr) 1.5fr`,
           }}>
        {SQUARES.map((sq) => <Tile key={sq.pos} square={sq} />)}

        <div style={{ gridRow: `2 / ${GRID}`, gridColumn: `2 / ${GRID}` }}
             className="relative flex items-center justify-center">
          <VideoStage />
        </div>
      </div>
    </div>
  );
}
