import { group } from "@/lib/board";
import { shekelShort } from "@/lib/format";
import { cellFor, colorBarEdge, contentInset, labelRotation, type Side } from "@/lib/geometry";
import type { Square } from "@/lib/types";
import type { DeedState, GameState } from "@/engine/types";
import { GroupIcon, SquareIcon } from "./GroupIcon";
import { seatColor, Token } from "./Token";

/** פס הצבע, על הצלע הפונה למרכז הלוח. */
const BAR_CLASS = {
  top: "top-0 inset-x-0 h-[18%] border-b",
  bottom: "bottom-0 inset-x-0 h-[18%] border-t",
  left: "left-0 inset-y-0 w-[18%] border-r",
  right: "right-0 inset-y-0 w-[18%] border-l",
} as const;

/** תיאור המשבצת לקוראי מסך — אמירה אחת, לא רסיסים. */
function ariaLabel(sq: Square, s: GameState | null, occupants: string[]): string {
  const parts: string[] = [];
  switch (sq.type) {
    case "property":
      parts.push(`${sq.name}, ${group(sq.group).name}, מחיר ${shekelShort(sq.price)}`);
      break;
    case "transport":
    case "utility":
      parts.push(`${sq.name}, מחיר ${shekelShort(sq.price)}`);
      break;
    case "tax":
      parts.push(`${sq.name}, שלם ${shekelShort(sq.amount)}`);
      break;
    case "card":
      parts.push(`משבצת קלף: ${sq.name}`);
      break;
    case "corner":
      parts.push(sq.subtitle ? `${sq.name} — ${sq.subtitle}` : sq.name);
      break;
  }
  const d = s?.deeds[sq.pos];
  if (d?.owner != null) {
    parts.push(`בבעלות ${s!.players[d.owner]!.name}`);
    if (d.mortgaged) parts.push("משוכן");
    else if (d.hotel) parts.push("עם מלון");
    else if (d.houses > 0) parts.push(`עם ${d.houses} בתים`);
  }
  if (occupants.length) parts.push(`כאן: ${occupants.join(", ")}`);
  return parts.join(", ");
}

/**
 * גוש התווית.
 *
 * הממדים ביחידות container query של אזור התוכן: אחרי סיבוב ב-±90° הרוחב
 * והגובה מתחלפים, ולכן 100cqh/100cqw נותנים התאמה מדויקת למשבצת.
 */
function Label({ side, children }: { side: Side; children: React.ReactNode }) {
  const rotation = labelRotation(side);
  const cls = "absolute flex flex-col items-center justify-center gap-[1px] p-[2px] text-center";
  if (!rotation) return <div className={`${cls} inset-0`}>{children}</div>;
  return (
    <div className={`${cls} left-1/2 top-1/2`}
         style={{
           width: "100cqh", height: "100cqw",
           transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
         }}>
      {children}
    </div>
  );
}

/** סימני בנייה: עד ארבעה ריבועים קטנים, או מלון אחד רחב. */
function Buildings({ deed, edge }: { deed: DeedState; edge: keyof typeof BAR_CLASS }) {
  if (!deed.hotel && deed.houses === 0) return null;
  const horizontal = edge === "top" || edge === "bottom";
  return (
    <div className={`absolute z-10 flex items-center justify-center gap-[1px]
                     ${horizontal ? "inset-x-0" : "inset-y-0"}
                     ${edge === "top" ? "top-[19%]" : edge === "bottom" ? "bottom-[19%]"
                       : edge === "left" ? "left-[19%]" : "right-[19%]"}`}
         style={{ flexDirection: horizontal ? "row" : "column" }}
         aria-hidden="true">
      {deed.hotel ? (
        <span className="rounded-[1px] bg-red-600 shadow"
              style={{ width: horizontal ? 12 : 6, height: horizontal ? 6 : 12 }} />
      ) : (
        Array.from({ length: deed.houses }, (_, i) => (
          <span key={i} className="rounded-[1px] bg-green-600 shadow"
                style={{ width: 4, height: 4 }} />
        ))
      )}
    </div>
  );
}

export function Tile({ square, state }: { square: Square; state: GameState | null }) {
  const { row, col, side, isCorner } = cellFor(square.pos);
  const style = { gridRow: row, gridColumn: col };
  const here = state?.players.filter((p) => p.pos === square.pos && !p.bankrupt) ?? [];
  const deed = state?.deeds[square.pos] ?? null;
  const edge = colorBarEdge(side);

  const tokens = here.length > 0 && (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-wrap
                    items-center justify-center gap-[2px] p-[2px]">
      {here.map((p) => (
        <Token key={p.seat} token={p.token} seat={p.seat}
               size={here.length > 3 ? 12 : 15} dimmed={p.inJail && square.pos === 10} />
      ))}
    </div>
  );

  if (isCorner && square.type === "corner") {
    return (
      <div style={style} role="gridcell" aria-label={ariaLabel(square, state, here.map((p) => p.name))}
           className="relative flex flex-col items-center justify-center gap-1 rounded-sm
                      border border-black/25 bg-parchment p-1 text-center shadow-inner">
        <SquareIcon kind={square.key} className="h-6 w-6 text-felt/70" />
        <div className="font-display text-[0.72rem] font-bold leading-tight text-neutral-900">
          {square.name}
        </div>
        {square.subtitle && (
          <div className="text-[0.5rem] leading-tight text-neutral-500">{square.subtitle}</div>
        )}
        {tokens}
      </div>
    );
  }

  const g = square.type === "property" ? group(square.group) : null;
  const amount = "price" in square ? square.price
                 : square.type === "tax" ? square.amount : null;
  const owner = deed?.owner ?? null;

  return (
    <div style={style} role="gridcell" aria-label={ariaLabel(square, state, here.map((p) => p.name))}
         className={`relative overflow-hidden rounded-sm border shadow-inner
                     ${deed?.mortgaged ? "border-black/25 bg-neutral-300" : "border-black/25 bg-parchment"}`}>
      {g && (
        <div className={`absolute ${BAR_CLASS[edge]} flex items-center justify-center border-black/30`}
             style={{ backgroundColor: g.color, color: g.textOn }}>
          <GroupIcon icon={g.icon} className="h-2.5 w-2.5 opacity-80" />
        </div>
      )}

      {/* סרגל בעלות בצלע החיצונית — לא מתחרה בפס הצבע שפונה למרכז */}
      {owner !== null && (
        <div className="absolute z-10"
             style={{
               backgroundColor: seatColor(owner),
               ...(edge === "top" ? { bottom: 0, left: 0, right: 0, height: "8%" }
                 : edge === "bottom" ? { top: 0, left: 0, right: 0, height: "8%" }
                 : edge === "left" ? { right: 0, top: 0, bottom: 0, width: "8%" }
                 : { left: 0, top: 0, bottom: 0, width: "8%" }),
             }}
             aria-hidden="true" />
      )}

      {deed && <Buildings deed={deed} edge={edge} />}

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
              {deed?.mortgaged ? "משוכן" : shekelShort(amount)}
            </div>
          )}
        </Label>
      </div>

      {tokens}
    </div>
  );
}
