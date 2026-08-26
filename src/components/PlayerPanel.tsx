import { useEffect, useRef, useState } from "react";
import { squareAt } from "@/lib/board";
import { shekel, shekelShort } from "@/lib/format";
import { netWorth } from "@/engine/selectors";
import { DEED_POSITIONS } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { seatColor, Token } from "./Token";

function Holdings({ state, seat }: { state: GameState; seat: number }) {
  const owned = DEED_POSITIONS.filter((p) => state.deeds[p]!.owner === seat);
  if (owned.length === 0) {
    return <div className="text-[0.68rem] text-parchment/35">אין נכסים</div>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {owned.map((pos) => {
        const d = state.deeds[pos]!;
        const sq = squareAt(pos);
        const mark = d.hotel ? "🏨" : d.houses > 0 ? "🏠".repeat(d.houses) : "";
        return (
          <span key={pos}
                title={`${sq.name} — ${shekelShort("price" in sq ? sq.price : 0)}`}
                className={`rounded px-1 py-0.5 text-[0.62rem] leading-tight ring-1
                            ${d.mortgaged
                              ? "bg-neutral-700/50 text-parchment/40 line-through ring-white/5"
                              : "bg-black/25 text-parchment/85 ring-white/10"}`}>
            {sq.name}{mark && <span className="mr-0.5 text-[0.55rem]">{mark}</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * מהבהב את היתרה כשהיא משתנה — ירוק לזכות, אדום לחובה.
 *
 * המספר לבדו משתנה בשקט, ובמשחק שכולו כסף זה בדיוק מה שצריך להיקלט מיד.
 * ההבהוב משלים את השטר המעופף: השטר מראה *לאן* הכסף עבר, וההבהוב מראה
 * *למי* זה קרה בטבלה.
 */
function useCashFlash(seat: number, cash: number): "up" | "down" | null {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const previous = useRef<number | undefined>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = cash;
    if (before === undefined || before === cash) return;
    setFlash(cash > before ? "up" : "down");
    const id = setTimeout(() => setFlash(null), 720);
    return () => clearTimeout(id);
  }, [cash, seat]);

  return flash;
}

function CashLine({ seat, cash }: { seat: number; cash: number }) {
  const flash = useCashFlash(seat, cash);
  return (
    <span className={`tabular-nums font-display text-base font-bold text-parchment
                      ${flash === "up" ? "tabu-cash-up" : flash === "down" ? "tabu-cash-down" : ""}`}>
      <bdi>{shekel(cash)}</bdi>
    </span>
  );
}

export function PlayerPanel({ state, showWorth }: { state: GameState; showWorth: boolean }) {
  return (
    <section dir="rtl" className="space-y-2" aria-label="שחקנים">
      {state.players.map((p) => {
        const active = p.seat === state.currentSeat && !p.bankrupt;
        return (
          <article key={p.seat}
                   data-money={`seat-${p.seat}`}
                   className={`rounded-lg p-2.5 ring-1 transition-colors
                     ${p.bankrupt ? "bg-black/30 opacity-45 ring-white/5"
                       : active ? "bg-black/40 ring-2 ring-amber-400/70"
                       : "bg-black/25 ring-white/10"}`}>
            <header className="flex items-center gap-2">
              <Token token={p.token} seat={p.seat} size={22} dimmed={p.bankrupt} />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold"
                    style={{ color: p.bankrupt ? undefined : seatColor(p.seat) }}>
                {p.name}
              </span>
              {p.inJail && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[0.6rem]
                                 font-medium text-red-200">
                  מעצר בית {p.jailTurns > 0 && `(${p.jailTurns}/3)`}
                </span>
              )}
              {p.getOutCards > 0 && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[0.6rem]
                                 text-emerald-200" title="כרטיס יציאה ממעצר בית">
                  🔑{p.getOutCards > 1 && p.getOutCards}
                </span>
              )}
              {p.bankrupt && (
                <span className="text-[0.62rem] text-parchment/50">פשט רגל</span>
              )}
            </header>

            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <CashLine seat={p.seat} cash={p.cash} />
              {showWorth && (
                <span className="tabular-nums text-[0.68rem] text-parchment/50">
                  שווי נקי <bdi>{shekelShort(netWorth(state, p.seat))}</bdi>
                </span>
              )}
            </div>

            <div className="mt-1.5">
              <Holdings state={state} seat={p.seat} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
