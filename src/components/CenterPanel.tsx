import { BOARD, squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { liquidValue } from "@/engine/selectors";
import { useGame } from "@/ui/GameContext";
import { useCountdown } from "@/ui/useCountdown";
import { LocalVideo } from "./VideoPanel";
import { Button } from "./Button";
import { Dice } from "./Dice";
import { seatColor } from "./Token";

/**
 * מרכז הלוח — הריבוע הפנימי 9×9.
 *
 * כאן יושבים הווידאו, הקוביות והפעולות. הן *לא* מתחת ללוח בכוונה: סרגל
 * תחתון גוזל גובה מהלוח, ובמסך רגיל זה בדיוק המימד שחסר. כאן זה שטח
 * שממילא פנוי, וזה גם המקום שהעין נמצאת בו.
 */
export function CenterPanel({ videoTiles, onTrade }: {
  videoTiles?: React.ReactNode;
  onTrade?: () => void;
}) {
  const { state } = useGame();
  return (
    // הריפוד מפנה את טבעת הלבד שבה יושבים החיילים (ראה geometry.INWARD_PCT).
    // בלעדיו החייל היה נוחת על פני מישהו.
    <div dir="rtl"
         className="relative h-full w-full rounded-md bg-felt-dark/45 p-[6.5%]
                    text-center ring-1 ring-white/10">
      <div className="h-full w-full">
        {videoTiles ?? <LocalVideo />}
      </div>

      {/* הפקדים יושבים על התפר בין ארבעת החלונות, על חשבונם — שם העין
          ממילא נמצאת, ושם הם לא גוזלים גובה מהלוח. */}
      <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2
                      flex-col items-center gap-1.5 rounded-xl bg-neutral-950/85 px-3 py-2
                      shadow-xl ring-1 ring-white/15 backdrop-blur-sm">
        <Dice dice={state.dice} size={40} />
        <TurnBar />
        <Actions onTrade={onTrade} />
      </div>
    </div>
  );
}

function TurnBar() {
  const { state } = useGame();
  const seconds = useCountdown(state.turnDeadline);
  const p = state.players[state.currentSeat]!;
  const urgent = seconds !== null && seconds <= 5;

  const label = state.phase === "finished" ? "המשחק נגמר"
    : state.debt ? `גיוס כספים — ${state.players[state.debt.debtorSeat]!.name}`
    : `התור של ${p.name}`;

  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-sm font-bold"
            style={{ color: state.debt ? "#fca5a5" : seatColor(state.currentSeat) }}>
        {label}
      </span>
      {seconds !== null && state.phase !== "finished" && (
        <span className={`tabular-nums text-[0.7rem] ${urgent ? "text-red-300" : "text-parchment/40"}`}>
          <bdi>{seconds}</bdi>ש׳
        </span>
      )}
    </div>
  );
}

function Actions({ onTrade }: { onTrade?: () => void }) {
  const { state, dispatch, canControl, mySeat } = useGame();
  const p = state.players[state.currentSeat]!;
  const mine = canControl(state.currentSeat);
  const sq = squareAt(p.pos);
  const price = "price" in sq ? sq.price : 0;

  if (state.debt) return <DebtActions />;

  // סחר מותר בכל עת חוץ ממכרז וגיוס כספים — כולל כשזה לא תורך.
  const proposer = mySeat ?? state.currentSeat;
  const canTrade = onTrade && state.phase !== "auction" && state.phase !== "finished"
    && !state.trade && state.players.filter((q) => !q.bankrupt).length > 1
    && !state.players[proposer]!.bankrupt;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {state.phase === "awaiting_roll" && (
        <>
          {p.inJail && (
            <>
              <Button disabled={!mine || p.cash < BOARD.meta.jailFine}
                      onClick={() => dispatch({ type: "pay_jail_fine" })}>
                ערובה <bdi>{shekel(BOARD.meta.jailFine)}</bdi>
              </Button>
              {p.getOutCards > 0 && (
                <Button disabled={!mine} onClick={() => dispatch({ type: "use_jail_card" })}>
                  כרטיס יציאה
                </Button>
              )}
            </>
          )}
          <Button variant="primary" disabled={!mine} onClick={() => dispatch({ type: "roll" })}>
            {p.inJail ? "נסה כפולים" : "גלגל קוביות"}
          </Button>
        </>
      )}

      {state.phase === "awaiting_buy" && (
        <>
          <Button variant="primary" disabled={!mine || p.cash < price}
                  onClick={() => dispatch({ type: "buy_property" })}>
            קנה {sq.name} · <bdi>{shekel(price)}</bdi>
          </Button>
          <Button disabled={!mine} onClick={() => dispatch({ type: "decline_property" })}>
            {state.settings.auctions ? "ויתור ← מכרז" : "ויתור"}
          </Button>
        </>
      )}

      {state.phase === "awaiting_end" && (
        <Button variant="primary" disabled={!mine} onClick={() => dispatch({ type: "end_turn" })}>
          {state.dice && state.dice[0] === state.dice[1] && !p.inJail && state.doublesCount > 0
            ? "גלגל שוב" : "סיים תור"}
        </Button>
      )}

      {canTrade && <Button onClick={onTrade}>הצע עסקה</Button>}
    </div>
  );
}

function DebtActions() {
  const { state, dispatch, canControl } = useGame();
  const debt = state.debt!;
  const canPay = liquidValue(state, debt.debtorSeat) >= debt.amount;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[0.72rem] text-red-200">
        חייב <bdi>{shekel(debt.amount)}</bdi>
        {debt.creditorSeat !== null && ` ל${state.players[debt.creditorSeat]!.name}`}
      </span>
      <span className="max-w-[16rem] text-[0.66rem] leading-snug text-parchment/45">
        {canPay
          ? <>מכרו או משכנו נכסים — יש <bdi>{shekel(liquidValue(state, debt.debtorSeat))}</bdi> לממש</>
          : "אין די נכסים לכסות את החוב"}
      </span>
      <Button variant="danger"
              disabled={!canControl(debt.debtorSeat) || canPay}
              title={canPay ? "יש נכסים לכסות את החוב" : undefined}
              onClick={() => dispatch({ type: "declare_bankruptcy" }, debt.debtorSeat)}>
        הכרז פשיטת רגל
      </Button>
    </div>
  );
}
