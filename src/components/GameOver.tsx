import { shekel } from "@/lib/format";
import { netWorth } from "@/engine/selectors";
import { useGame } from "@/ui/GameContext";
import { seatColor, Token } from "./Token";

export function GameOver({ onRestart }: { onRestart: () => void }) {
  const { state } = useGame();
  if (state.phase !== "finished") return null;

  const ranked = [...state.players]
    .map((p) => ({ p, worth: p.bankrupt ? 0 : netWorth(state, p.seat) }))
    .sort((a, b) => b.worth - a.worth || a.p.seat - b.p.seat);

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="סיום המשחק"
         className="toy-overlay absolute inset-0 z-50 flex items-center justify-center p-6">
      <div className="tabu-pop toy-modal w-full max-w-md space-y-4 p-6 text-center">
        <div className="toy-title font-logo text-4xl">
          {state.winnerSeat !== null ? `ניצחון ל${state.players[state.winnerSeat]!.name}` : "תיקו"}
        </div>

        <ol className="space-y-1.5 text-right">
          {ranked.map(({ p, worth }, i) => (
            <li key={p.seat}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5
                            ${i === 0 ? "bg-toy-sun/35 ring-2 ring-toy-sun" : "bg-toy-grape/10"}`}>
              <span className="w-4 tabular-nums text-[0.72rem] text-ink/50">{i + 1}</span>
              <Token token={p.token} seat={p.seat} size={18} dimmed={p.bankrupt} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium"
                    style={{ color: seatColor(p.seat) }}>
                {p.name}
              </span>
              <span className="tabular-nums text-[0.78rem] text-ink/75">
                {p.bankrupt ? "פשט רגל" : <bdi>{shekel(worth)}</bdi>}
              </span>
            </li>
          ))}
        </ol>

        <button onClick={onRestart} className="toy-btn toy-btn--primary !px-6 !py-2.5 !text-base">
          משחק חדש
        </button>
      </div>
    </div>
  );
}
