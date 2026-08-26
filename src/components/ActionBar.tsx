import { BOARD, squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { liquidValue } from "@/engine/selectors";
import { useGame } from "@/ui/GameContext";
import { useCountdown } from "@/ui/useCountdown";
import { Button } from "./Button";
import { Dice } from "./Dice";

export function ActionBar() {
  const { state, dispatch, canControl } = useGame();
  const seconds = useCountdown(state.turnDeadline);
  const p = state.players[state.currentSeat]!;
  const mine = canControl(state.currentSeat);
  const sq = squareAt(p.pos);
  const price = "price" in sq ? sq.price : 0;

  const urgent = seconds !== null && seconds <= 5;

  return (
    <div dir="rtl" className="flex flex-wrap items-center gap-2 rounded-lg bg-black/35 p-3
                              ring-1 ring-white/10">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Dice dice={state.dice} />
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-bold text-parchment">
            {state.phase === "finished"
              ? "המשחק נגמר"
              : state.debt
                ? `גיוס כספים — ${state.players[state.debt.debtorSeat]!.name}`
                : `התור של ${p.name}`}
          </div>
          {seconds !== null && state.phase !== "finished" && (
            <div className={`tabular-nums text-[0.7rem] ${urgent ? "text-red-300" : "text-parchment/45"}`}>
              נותרו <bdi>{seconds}</bdi> שניות
            </div>
          )}
        </div>
      </div>

      {state.phase === "awaiting_roll" && (
        <>
          {p.inJail && (
            <>
              <Button disabled={!mine || p.cash < BOARD.meta.jailFine}
                      onClick={() => dispatch({ type: "pay_jail_fine" })}>
                שלם ערובה <bdi>{shekel(BOARD.meta.jailFine)}</bdi>
              </Button>
              {p.getOutCards > 0 && (
                <Button onClick={() => dispatch({ type: "use_jail_card" })} disabled={!mine}>
                  מימוש כרטיס יציאה
                </Button>
              )}
            </>
          )}
          <Button variant="primary" disabled={!mine}
                  onClick={() => dispatch({ type: "roll" })}>
            {p.inJail ? "נסה כפולים" : "גלגל קוביות"}
          </Button>
        </>
      )}

      {state.phase === "awaiting_buy" && (
        <>
          <Button variant="primary" disabled={!mine || p.cash < price}
                  onClick={() => dispatch({ type: "buy_property" })}>
            קנה את {sq.name} — <bdi>{shekel(price)}</bdi>
          </Button>
          <Button disabled={!mine} onClick={() => dispatch({ type: "decline_property" })}>
            {state.settings.auctions ? "ויתור והוצאה למכרז" : "ויתור"}
          </Button>
        </>
      )}

      {state.phase === "awaiting_end" && (
        <Button variant="primary" disabled={!mine}
                onClick={() => dispatch({ type: "end_turn" })}>
          {state.dice && state.dice[0] === state.dice[1] && !p.inJail && state.doublesCount > 0
            ? "גלגל שוב"
            : "סיים תור"}
        </Button>
      )}

      {state.debt && (
        <DebtActions />
      )}
    </div>
  );
}

function DebtActions() {
  const { state, dispatch, canControl } = useGame();
  const debt = state.debt!;
  const debtor = state.players[debt.debtorSeat]!;
  const canPay = liquidValue(state, debt.debtorSeat) >= debt.amount;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.72rem] text-red-200">
        חייב <bdi>{shekel(debt.amount)}</bdi>
        {debt.creditorSeat !== null && ` ל${state.players[debt.creditorSeat]!.name}`}
      </span>
      <Button variant="danger"
              disabled={!canControl(debt.debtorSeat) || canPay}
              title={canPay ? "יש לך נכסים לכסות את החוב" : undefined}
              onClick={() => dispatch({ type: "declare_bankruptcy" }, debt.debtorSeat)}>
        הכרז פשיטת רגל
      </Button>
      <span className="text-[0.66rem] text-parchment/45">
        {canPay
          ? `מכור או משכן נכסים — יש לך ${shekel(liquidValue(state, debt.debtorSeat))} לממש`
          : "אין די נכסים לכסות את החוב"}
      </span>
      {debtor.bankrupt && null}
    </div>
  );
}
