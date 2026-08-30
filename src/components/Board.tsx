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
    // הריבועיות נקבעת בהורה (aspectRatio), והלוח פשוט ממלא אותו. הגדרת
    // aspect-square גם כאן מול הורה שכבר ריבועי יצרה תלות מעגלית.
    // הלוח עצמו לא משתנה — רק יושב על הנוף כמו לוח על שולחן: פינות
    // מעוגלות מעט יותר, מסגרת בהירה וצל רך מתחת.
    <div className="board relative h-full w-full select-none rounded-2xl
                    bg-felt p-[6px] ring-4 ring-white/85
                    shadow-[0_18px_40px_-18px_rgba(30,20,70,0.75)]"
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
