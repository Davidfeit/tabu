import { shekel } from "@/lib/format";
import { netWorth } from "@/engine/selectors";
import { DEED_POSITIONS } from "@/engine/setup";
import { useGame } from "@/ui/GameContext";
import { Actions, TurnBar } from "./Actions";
import { Dice } from "./Dice";
import { ManagePanel } from "./ManagePanel";
import { seatColor, Token } from "./Token";

/**
 * הטלפון כשלט.
 *
 * הלוח נמצא על המסך המשותף שכולם רואים; אין טעם לדחוס אותו גם לטלפון,
 * ובוודאי לא את הווידאו — כולם באותו חדר. מה שהטלפון כן צריך הוא מה
 * שאי אפשר לעשות מרחוק: לגלגל, להחליט, ולראות את המצב האישי.
 *
 * הכפתורים הם בדיוק אותם כפתורים של המסך הגדול (components/Actions),
 * ולא עותק — שני עותקים היו מתפצלים ביום שבו אחד מהם משתנה.
 */
export function PhoneController({ onLeave }: { onLeave: () => void }) {
  const { state, mySeat } = useGame();
  const seat = mySeat ?? state.currentSeat;
  const me = state.players[seat];
  if (!me) return null;

  const mine = DEED_POSITIONS.filter((p) => state.deeds[p]!.owner === seat);
  const myTurn = state.currentSeat === seat && !me.bankrupt;

  return (
    <div dir="rtl" className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 p-3">
      <header className="flex items-center gap-2.5 rounded-lg bg-black/30 p-3
                         ring-1 ring-white/10">
        <Token token={me.token} seat={seat} size={34} dimmed={me.bankrupt} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-bold"
               style={{ color: seatColor(seat) }}>{me.name}</div>
          <div className="tabular-nums font-display text-xl font-bold text-parchment">
            <bdi>{shekel(me.cash)}</bdi>
          </div>
        </div>
        <div className="text-left text-[0.7rem] leading-tight text-parchment/45">
          שווי נקי
          <div className="tabular-nums text-parchment/70">
            <bdi>{shekel(netWorth(state, seat))}</bdi>
          </div>
        </div>
      </header>

      {/* התור והפעולות — הלב של המסך הזה, ולכן למעלה ובגדול. */}
      <section className={`flex flex-col items-center gap-3 rounded-lg p-4 ring-1
                           ${myTurn ? "bg-amber-400/10 ring-amber-400/50"
                                    : "bg-black/25 ring-white/10"}`}>
        <TurnBar />
        <Dice dice={state.dice} size={46} />
        <div className="w-full [&_button]:!px-4 [&_button]:!py-3 [&_button]:!text-base">
          <Actions />
        </div>
        {!myTurn && state.phase !== "finished" && !state.debt && (
          <p className="text-[0.75rem] text-parchment/40">ממתינים לתורכם</p>
        )}
      </section>

      {mine.length === 0 && (
        <p className="rounded-lg bg-black/20 p-3 text-center text-[0.8rem] text-parchment/35">
          עדיין אין נכסים
        </p>
      )}

      {/* משכון ובנייה — ההחלטות שאפשר לקבל גם כשזה לא תורך. */}
      <ManagePanel seat={seat} />

      {/* מי שנכנס מהטלפון כדי *לשחק* מרחוק, ולא כדי לשבת מול המסך
          המשותף, מקבל כאן מסך בלי וידאו ולא מבין למה. שורה אחת חוסכת
          את זה, ומצביעה על הדרך החוצה. */}
      <p className="rounded-lg bg-black/20 p-2.5 text-center text-[0.7rem]
                    leading-relaxed text-parchment/35">
        מצב שלט — הלוח והווידאו על המסך המשותף.
        <br />
        לשחק מהטלפון עם לוח ווידאו: הוסיפו <code>?controller=0</code> לכתובת.
      </p>

      <button onClick={onLeave}
              className="mt-auto py-3 text-[0.8rem] text-parchment/35 underline-offset-4">
        יציאה מהמשחק
      </button>
    </div>
  );
}
