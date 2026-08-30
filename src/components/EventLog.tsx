import { eventText, QUIET_EVENTS } from "@/lib/messages";
import type { GameEvent, GameState } from "@/engine/types";
import { seatColor } from "./Token";

export function EventLog({ events, state }: { events: GameEvent[]; state: GameState }) {
  const shown = events.filter((e) => !QUIET_EVENTS.has(e.type)).slice(0, 40);
  const nameOf = (seat: number) => state.players[seat]?.name ?? "";

  return (
    <section dir="rtl" aria-label="יומן המשחק" aria-live="polite"
             className="toy-card toy-card--flat flex max-h-64 flex-col gap-1
                        overflow-y-auto p-2.5 text-[0.72rem] leading-relaxed">
      {shown.length === 0 && (
        <div className="text-ink/40">המשחק מתחיל…</div>
      )}
      {shown.map((e) => (
        <div key={e.seq} className="tabu-log-in flex gap-1.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: e.seat === null ? "#666" : seatColor(e.seat) }}
                aria-hidden="true" />
          <span className="text-ink/80">{eventText(e, nameOf)}</span>
        </div>
      ))}
    </section>
  );
}
