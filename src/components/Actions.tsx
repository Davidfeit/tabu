import { BOARD, squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { liquidValue } from "@/engine/selectors";
import { useGame } from "@/ui/GameContext";
import { useCountdown } from "@/ui/useCountdown";
import { Button } from "./Button";
import { seatColor } from "./Token";

/**
 * שורת התור והפעולות.
 *
 * מופרד מ-CenterPanel כי גם הטלפון מציג אותו: מי שיושב מול המסך המשותף
 * מגלגל ומחליט מהטלפון שלו. שני עותקים של הכפתורים היו נפרדים ביום שבו
 * מישהו משנה אחד מהם.
 */
export function TurnBar() {
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

export function Actions() {
  const { state, dispatch, canControl } = useGame();
  const p = state.players[state.currentSeat]!;
  const mine = canControl(state.currentSeat);
  const sq = squareAt(p.pos);
  const price = "price" in sq ? sq.price : 0;

  if (state.debt) return <DebtActions />;


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
