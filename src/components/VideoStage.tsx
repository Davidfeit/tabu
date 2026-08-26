import { useGame } from "@/ui/GameContext";
import { Dice } from "./Dice";
import { seatColor, Token } from "./Token";

/**
 * מרכז הלוח — כאן יושבות משבצות הווידאו.
 *
 * הריבוע הזה הוא הסיבה שה-mesh הישיר עובד: כל המשבצות קטנות ובאותו גודל,
 * ולכן אין צורך ב-simulcast — מה שבדרך כלל הורג mesh. ראה docs/spec.md §3.5.
 */
export function VideoStage({ tiles }: { tiles?: React.ReactNode }) {
  const { state } = useGame();
  const active = state.players.filter((p) => !p.bankrupt);

  return (
    <div dir="rtl" className="flex h-full w-full flex-col items-center justify-center gap-3
                              rounded-md bg-felt-dark/50 p-4 text-center ring-1 ring-white/10">
      <div className="font-logo text-3xl tracking-tight text-parchment/90 drop-shadow">
        טאבו
      </div>

      {tiles ?? (
        <div className="grid gap-2"
             style={{ gridTemplateColumns: `repeat(${Math.min(active.length, 3)}, minmax(0,1fr))` }}>
          {active.map((p) => (
            <div key={p.seat}
                 className={`flex aspect-[4/3] w-[6.5rem] flex-col items-center justify-center
                             gap-1 rounded border bg-black/25
                             ${p.seat === state.currentSeat
                               ? "border-amber-400/70" : "border-dashed border-parchment/20"}`}>
              <Token token={p.token} seat={p.seat} size={26} />
              <span className="max-w-full truncate px-1 text-[0.62rem]"
                    style={{ color: seatColor(p.seat) }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {state.dice && (
        <div className="mt-1">
          <Dice dice={state.dice} size={30} />
        </div>
      )}
    </div>
  );
}
