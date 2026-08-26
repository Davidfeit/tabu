import { BOARD, squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { liquidValue } from "@/engine/selectors";
import { useGame } from "@/ui/GameContext";
import { useCountdown } from "@/ui/useCountdown";
import { Button } from "./Button";
import { Dice } from "./Dice";
import { seatColor, Token } from "./Token";

/**
 * מרכז הלוח — הריבוע הפנימי 9×9.
 *
 * כאן יושבים הווידאו, הקוביות והפעולות. הן *לא* מתחת ללוח בכוונה: סרגל
 * תחתון גוזל גובה מהלוח, ובמסך רגיל זה בדיוק המימד שחסר. כאן זה שטח
 * שממילא פנוי, וזה גם המקום שהעין נמצאת בו.
 */
export function CenterPanel({ videoTiles }: { videoTiles?: React.ReactNode }) {
  const { state } = useGame();
  const active = state.players.filter((p) => !p.bankrupt);

  return (
    <div dir="rtl"
         className="relative flex h-full w-full flex-col items-center justify-center gap-5
                    rounded-md bg-felt-dark/45 p-[3%] text-center ring-1 ring-white/10">
      <div className="flex min-h-0 w-full items-center justify-center overflow-hidden">
        {videoTiles ?? <LocalSeats />}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <Dice dice={state.dice} size={38} />
        <TurnBar />
        <Actions />
      </div>

      {/* עוגן הבנק לשטרות המעופפים — מסים, קניות ובנייה נעים לכאן */}
      {/* עוגן הבנק לשטרות המעופפים — מסים, קניות ובנייה נעים לכאן */}
      <div data-money="bank"
           className="absolute bottom-[3%] text-[0.6rem] text-parchment/25">
        <bdi>{active.length}</bdi> שחקנים · בבנק <bdi>{state.bank.houses}</bdi> בתים
        · <bdi>{state.bank.hotels}</bdi> מלונות
      </div>
    </div>
  );
}

/**
 * משחק מקומי: אין וידאו, אבל המשבצות מצוירות באותה צורה ובאותו גודל.
 *
 * זה לא קישוט — זה בדיוק השטח שבו יישבו המשתתפים במשחק מקוון, וכך רואים
 * מראש כמה מקום זה תופס. וזו גם הסיבה שה-mesh הישיר עובד: כל המשבצות
 * קטנות ובאותו גודל, ולכן אין צורך ב-simulcast.
 */
function LocalSeats() {
  const { state } = useGame();
  const active = state.players.filter((p) => !p.bankrupt);
  const cols = Math.min(active.length, 3);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="font-logo text-3xl tracking-tight text-parchment/80 drop-shadow">
        טאבו
      </div>
      <div className="grid gap-2"
           style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {active.map((p) => (
          <div key={p.seat}
               className={`relative flex aspect-[4/3] w-[7.5rem] flex-col items-center
                           justify-center gap-1.5 rounded-md border bg-black/25
                           transition-colors
                           ${p.seat === state.currentSeat
                             ? "border-amber-400/75 ring-1 ring-amber-400/35"
                             : "border-dashed border-white/12"}`}>
            <Token token={p.token} seat={p.seat} size={30} />
            <span className="max-w-full truncate px-1 text-[0.66rem] font-medium"
                  style={{ color: seatColor(p.seat), unicodeBidi: "plaintext" }}>
              {p.name}
            </span>
          </div>
        ))}
      </div>
      <p className="max-w-[20rem] text-[0.62rem] leading-snug text-parchment/25">
        במשחק מקוון, כאן רואים זה את זה בווידאו — ישירות בין המחשבים,
        בלי שרת באמצע.
      </p>
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

function Actions() {
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
