import { BOARD, GROUPS, SQUARES } from "@/lib/board";
import { shekel } from "@/lib/format";
import { Board } from "@/components/Board";
import { GroupIcon } from "@/components/GroupIcon";
import type { PropertySquare } from "@/lib/types";

function Legend() {
  return (
    <aside dir="rtl" className="w-full max-w-xs shrink-0 space-y-3">
      <h2 className="font-display text-lg font-bold text-parchment">קבוצות הצבע</h2>
      <ul className="space-y-1.5">
        {GROUPS.map((g) => {
          const members = SQUARES.filter(
            (s): s is PropertySquare => s.type === "property" && s.group === g.key,
          );
          return (
            <li key={g.key}
                className="flex items-center gap-2.5 rounded-md bg-black/20 px-2.5 py-1.5
                           ring-1 ring-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: g.color, color: g.textOn }}>
                <GroupIcon icon={g.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-semibold text-parchment">
                  {g.name}
                </span>
                <span className="block truncate text-[0.68rem] text-parchment/50">
                  {members.map((m) => m.name).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-[0.68rem] text-parchment/60">
                בית {shekel(g.houseCost)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="rounded-md bg-black/20 p-3 text-[0.72rem] leading-relaxed
                      text-parchment/70 ring-1 ring-white/10">
        <div className="mb-1.5 font-display text-sm font-bold text-parchment">כללי פתיחה</div>
        <dl className="space-y-1">
          {[
            ["הון פתיחה", shekel(BOARD.meta.startingCash)],
            ["מעבר בזינוק", shekel(BOARD.meta.passStartBonus)],
            ["ערובה למעצר בית", shekel(BOARD.meta.jailFine)],
            ["מלאי הבנק", `${BOARD.meta.houseSupply} בתים · ${BOARD.meta.hotelSupply} מלונות`],
            ["שחקנים", `${BOARD.meta.minPlayers}–${BOARD.meta.maxPlayers}`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="text-parchment/50">{k}</dt>
              <dd className="tabular-nums font-medium text-parchment/90">
                <bdi>{v}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <div dir="rtl" className="min-h-screen bg-neutral-900 bg-gradient-to-br
                              from-neutral-900 via-neutral-900 to-neutral-950 py-8">
      <main className="mx-auto flex w-full max-w-[1400px] items-start justify-center gap-8 px-8">
        <div className="w-[min(78vh,1000px)] min-w-[720px]">
          <Board />
        </div>
        <Legend />
      </main>
    </div>
  );
}
