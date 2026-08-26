import { squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { AUCTION_INCREMENT, AUCTION_OPENING } from "@/engine/auction";
import { useGame } from "@/ui/GameContext";
import { useCountdown } from "@/ui/useCountdown";
import { Button } from "./Button";
import { seatColor } from "./Token";

export function AuctionPanel() {
  const { state, dispatch, canControl } = useGame();
  const a = state.auction;
  const seconds = useCountdown(a?.deadline ?? null);
  if (!a) return null;

  const sq = squareAt(a.pos);
  const minimum = a.bid === null ? AUCTION_OPENING : a.bid + AUCTION_INCREMENT;
  const contenders = state.players.filter((p) => !p.bankrupt && !a.passed.includes(p.seat));

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label={`מכרז על ${sq.name}`}
         className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
      <div className="tabu-pop w-full max-w-md space-y-4 rounded-xl bg-neutral-900 p-5
                      ring-1 ring-white/15">
        <header className="text-center">
          <div className="font-logo text-2xl text-parchment">מכרז</div>
          <div className="mt-1 font-display text-lg font-bold text-amber-300">{sq.name}</div>
          <div className="mt-0.5 text-[0.72rem] text-parchment/45">
            מחיר מחירון <bdi>{shekel("price" in sq ? sq.price : 0)}</bdi>
            {seconds !== null && <> · נותרו <bdi>{seconds}</bdi> שניות</>}
          </div>
        </header>

        <div className="rounded-lg bg-black/40 p-3 text-center">
          {a.bid === null ? (
            <div className="text-parchment/50">עוד לא הוצעה הצעה</div>
          ) : (
            <>
              <div className="tabular-nums font-display text-2xl font-bold text-parchment">
                <bdi>{shekel(a.bid)}</bdi>
              </div>
              <div className="mt-0.5 text-[0.72rem]"
                   style={{ color: seatColor(a.bidderSeat!) }}>
                {state.players[a.bidderSeat!]!.name}
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          {contenders.map((p) => (
            <div key={p.seat} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium"
                    style={{ color: seatColor(p.seat) }}>
                {p.name}
                <span className="mr-1.5 tabular-nums text-[0.68rem] text-parchment/40">
                  <bdi>{shekel(p.cash)}</bdi>
                </span>
              </span>
              <Button variant="primary"
                      disabled={!canControl(p.seat) || p.cash < minimum}
                      onClick={() => dispatch({ type: "auction_bid", amount: minimum }, p.seat)}>
                הצע <bdi>{shekel(minimum)}</bdi>
              </Button>
              <Button disabled={!canControl(p.seat)}
                      onClick={() => dispatch({ type: "auction_pass" }, p.seat)}>
                פאס
              </Button>
            </div>
          ))}
          {a.passed.length > 0 && (
            <div className="pt-1 text-[0.68rem] text-parchment/35">
              פסחו: {a.passed.map((s) => state.players[s]!.name).join(" · ")}
            </div>
          )}
        </div>

        {a.queue.length > 0 && (
          <div className="text-center text-[0.68rem] text-parchment/40">
            עוד <bdi>{a.queue.length}</bdi> נכסים בתור למכרז
          </div>
        )}
      </div>
    </div>
  );
}
