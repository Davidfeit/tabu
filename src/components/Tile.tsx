import { group } from "@/lib/board";
import { shekelShort } from "@/lib/format";
import { cellFor, colorBarEdge, contentInset, labelRotation, type Side } from "@/lib/geometry";
import type { Square } from "@/lib/types";
import { GroupIcon, SquareIcon } from "./GroupIcon";

/** פס הצבע, על הצלע הפונה למרכז הלוח. */
const BAR_CLASS = {
  top: "top-0 inset-x-0 h-[18%] border-b",
  bottom: "bottom-0 inset-x-0 h-[18%] border-t",
  left: "left-0 inset-y-0 w-[18%] border-r",
  right: "right-0 inset-y-0 w-[18%] border-l",
} as const;

/** תיאור המשבצת לקוראי מסך — אמירה אחת, לא רסיסים. */
function ariaLabel(sq: Square): string {
  switch (sq.type) {
    case "property":
      return `${sq.name}, ${group(sq.group).name}, מחיר ${shekelShort(sq.price)}`;
    case "transport":
    case "utility":
      return `${sq.name}, מחיר ${shekelShort(sq.price)}`;
    case "tax":
      return `${sq.name}, שלם ${shekelShort(sq.amount)}`;
    case "card":
      return `משבצת קלף: ${sq.name}`;
    case "corner":
      return sq.subtitle ? `${sq.name} — ${sq.subtitle}` : sq.name;
  }
}

/**
 * גוש התווית.
 *
 * הממדים ביחידות container query של אזור התוכן: אחרי סיבוב ב-±90° הרוחב והגובה
 * מתחלפים, ולכן `width: 100cqh` ו-`height: 100cqw` נותנים התאמה מדויקת למשבצת.
 * גרסה קודמת השתמשה כאן במספרי rem קבועים והתוויות הארוכות גלשו החוצה, כי
 * המשבצות נמדדות ביחידות fr של הרשת ולא בגודל ידוע מראש.
 */
function Label({ side, children }: { side: Side; children: React.ReactNode }) {
  const rotation = labelRotation(side);
  if (!rotation) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center
                      gap-[1px] p-[2px] text-center">
        {children}
      </div>
    );
  }
  return (
    <div className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center
                    gap-[1px] p-[2px] text-center"
         style={{
           width: "100cqh",
           height: "100cqw",
           transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
         }}>
      {children}
    </div>
  );
}

export function Tile({ square }: { square: Square }) {
  const { row, col, side, isCorner } = cellFor(square.pos);
  const style = { gridRow: row, gridColumn: col };

  if (isCorner && square.type === "corner") {
    return (
      <div style={style} role="gridcell" aria-label={ariaLabel(square)}
           className="relative flex flex-col items-center justify-center gap-1 rounded-sm
                      border border-black/25 bg-parchment p-1 text-center shadow-inner">
        <SquareIcon kind={square.key} className="h-6 w-6 text-felt/70" />
        <div className="font-display text-[0.72rem] font-bold leading-tight text-neutral-900">
          {square.name}
        </div>
        {square.subtitle && (
          <div className="text-[0.5rem] leading-tight text-neutral-500">{square.subtitle}</div>
        )}
      </div>
    );
  }

  const g = square.type === "property" ? group(square.group) : null;
  const edge = colorBarEdge(side);
  const amount =
    "price" in square ? square.price : square.type === "tax" ? square.amount : null;

  return (
    <div style={style} role="gridcell" aria-label={ariaLabel(square)}
         className="relative overflow-hidden rounded-sm border border-black/25
                    bg-parchment shadow-inner">
      {g && (
        <div className={`absolute ${BAR_CLASS[edge]} flex items-center justify-center border-black/30`}
             style={{ backgroundColor: g.color, color: g.textOn }}>
          <GroupIcon icon={g.icon} className="h-2.5 w-2.5 opacity-80" />
        </div>
      )}

      <div className="absolute"
           style={{
             containerType: "size",
             ...(g
               ? Object.fromEntries(
                   Object.entries(contentInset(edge)).map(([k, v]) => [k, `${v}%`]),
                 )
               : { inset: 0 }),
           } as React.CSSProperties}>
        <Label side={side}>
          {(square.type === "transport" || square.type === "utility" ||
            square.type === "tax" || square.type === "card") && (
            <SquareIcon kind={square.type} className="h-4 w-4 shrink-0 text-felt/60" />
          )}
          <div className="w-full px-[1px] font-display text-[0.58rem] font-semibold
                          leading-[1.1] text-neutral-900">
            {square.name}
          </div>
          {amount !== null && (
            <div className="tabular-nums text-[0.53rem] font-medium leading-none text-neutral-600">
              {shekelShort(amount)}
            </div>
          )}
        </Label>
      </div>
    </div>
  );
}
