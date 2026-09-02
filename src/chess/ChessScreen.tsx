import { useState } from "react";
import { Toast } from "@/components/Toast";
import { seatColor, Token } from "@/components/Token";
import { ViewControls } from "@/components/ViewControls";
import { ChessBoard } from "./ChessBoard";
import { useChess } from "./ChessContext";
import { ENDINGS } from "./messages";
import { captured } from "./reduce";
import type { ChessColor, ChessState } from "./types";

const GLYPH: Record<string, string> = {
  q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function ChessToast() {
  const { error, clearError } = useChess();
  return <Toast error={error} onClear={clearError} />;
}

/** כרטיס שחקן: שם, צבע, מה הוא הכה. */
function PlayerCard({ state, seat }: { state: ChessState; seat: number }) {
  const p = state.players.find((x) => x.seat === seat);
  if (!p) return null;
  const turn = state.phase === "playing" && state.currentSeat === seat;
  const other: ChessColor = p.color === "w" ? "b" : "w";
  const taken = captured(state)[other];   // מה שחסר ליריב — זה מה שהוא הכה
  return (
    <div className={`toy-card flex items-center gap-2.5 px-3 py-2 ${turn ? "toy-card--turn" : ""}`}>
      <Token token={p.token} seat={seat} size={30} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold" style={{ color: seatColor(seat) }}>
          {p.name}
        </div>
        <div className="text-[0.68rem] text-ink/55">{p.color === "w" ? "לבן" : "שחור"}
          {turn && <span className="mr-1.5 font-semibold text-ink/80">· בתור</span>}
        </div>
      </div>
      <div dir="ltr" className="text-base leading-none tracking-tight"
           style={{ color: other === "w" ? "#fff" : "#2b2340",
                    WebkitTextStroke: other === "w" ? "0.6px #3b2f5c" : "0",
                    fontFamily: '"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2",sans-serif' }}
           title="כלים שהוכו">
        {taken.map((t, i) => <span key={i}>{GLYPH[t]}{"︎"}</span>)}
      </div>
    </div>
  );
}

/** רשימת המהלכים, בזוגות. */
function MoveList({ moves }: { moves: string[] }) {
  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i]!, moves[i + 1]]);
  // הרשימה עצמה LTR ובגופן אחיד — סימון שחמט הוא לטיני. הכיתוב הריק
  // עברי, ולכן מחוץ לזה: עברית בתוך מכולת LTR עם גופן קבוע נשברת למילים.
  if (pairs.length === 0) {
    return (
      <p className="toy-card toy-card--flat p-2 text-center text-[0.74rem] text-ink/40">
        עדיין אין מהלכים
      </p>
    );
  }
  return (
    <ol dir="ltr" className="toy-card toy-card--flat max-h-56 overflow-y-auto p-2 font-mono
                              text-[0.74rem] leading-relaxed text-ink/80 lg:max-h-[40vh]">
      {pairs.map(([w, b], i) => (
        <li key={i} className="grid grid-cols-[2rem_1fr_1fr]">
          <span className="text-ink/40">{i + 1}.</span><span>{w}</span><span>{b ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}

/** התור, כניעה, תיקו. */
function ChessActions() {
  const { state, mySeat, canAct, dispatch } = useChess();
  const [arming, setArming] = useState(false);
  const me = mySeat ?? state.currentSeat;
  const other = state.players.find((p) => p.seat !== me)?.seat ?? null;
  const cur = state.players.find((p) => p.seat === state.currentSeat)!;

  const status = state.phase === "finished" ? "המשחק נגמר"
    : state.check ? `שח! התור של ${cur.name}`
    : `התור של ${cur.name}`;

  return (
    <div className="toy-card space-y-2.5 p-3">
      <div className="text-center font-display text-sm font-bold"
           style={{ color: state.check ? "#dc2626" : seatColor(state.currentSeat) }}>
        {status}
      </div>

      {canAct && state.phase === "playing" && (
        <>
          {state.drawOffer !== null && state.drawOffer === other && (
            <div className="rounded-2xl bg-toy-sun/25 p-2.5 text-center ring-2 ring-toy-sun">
              <div className="mb-1.5 text-[0.8rem] font-semibold text-ink">
                {state.players.find((p) => p.seat === other)?.name} מציע/ה תיקו
              </div>
              <div className="flex justify-center gap-2">
                <button onClick={() => dispatch({ type: "chess_accept_draw" })}
                        className="toy-btn toy-btn--primary !px-3 !py-1 !text-[0.78rem]">קבלה</button>
                <button onClick={() => dispatch({ type: "chess_decline_draw" })}
                        className="toy-btn !px-3 !py-1 !text-[0.78rem]">דחייה</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {state.drawOffer === me
              ? <span className="toy-chip toy-chip--muted px-2.5 py-1 text-[0.72rem]">הצעת תיקו נשלחה…</span>
              : state.drawOffer === null && (
                <button onClick={() => dispatch({ type: "chess_offer_draw" })}
                        className="toy-btn !px-3 !py-1 !text-[0.78rem]">הצעת תיקו</button>
              )}
            {arming ? (
              <>
                <button onClick={() => { dispatch({ type: "chess_resign" }); setArming(false); }}
                        className="toy-btn toy-btn--danger !px-3 !py-1 !text-[0.78rem]">כן, כניעה</button>
                <button onClick={() => setArming(false)}
                        className="toy-btn !px-3 !py-1 !text-[0.78rem]">ביטול</button>
              </>
            ) : (
              <button onClick={() => setArming(true)}
                      className="text-[0.76rem] text-ink/50 underline-offset-4 hover:underline">
                כניעה
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChessOver({ onLeave }: { onLeave: () => void }) {
  const { state } = useChess();
  if (state.phase !== "finished") return null;
  const winner = state.winnerSeat === null ? null
    : state.players.find((p) => p.seat === state.winnerSeat);
  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="סיום המשחק"
         className="toy-overlay absolute inset-0 z-50 flex items-center justify-center p-6">
      <div className="tabu-pop toy-modal w-full max-w-sm space-y-4 p-6 text-center">
        <div className="toy-title font-logo text-4xl">
          {winner ? `ניצחון ל${winner.name}` : "תיקו"}
        </div>
        <p className="text-sm text-ink/70">{state.ending ? ENDINGS[state.ending] : ""}</p>
        <p className="text-[0.74rem] text-ink/50">{state.moves.length} מהלכים</p>
        <button onClick={onLeave} className="toy-btn toy-btn--primary !px-6 !py-2.5 !text-base">
          משחק חדש
        </button>
      </div>
    </div>
  );
}

/**
 * מסך השחמט — מקומי ומקוון כאחד.
 *
 * הלוח באמצע וגדול ככל שהמסך מרשה; משני צדדיו הכרטיסים, הווידאו והמהלכים.
 * במסך צר הכול נערם: לוח ברוחב מלא, ומעליו ומתחתיו מה שצריך.
 */
export function ChessScreen({ onLeave, videoTiles }: {
  onLeave: () => void; videoTiles?: React.ReactNode;
}) {
  const { state, mySeat, myColor, canAct, dispatch } = useChess();
  // במקוון: הצבע שלי למטה. במקומי: הלבן למטה, תמיד — לוח שמתהפך כל תור
  // מבלבל יותר ממה שהוא עוזר כששניים יושבים מול אותו מסך.
  const bottom: ChessColor = mySeat === null ? "w" : (myColor ?? "w");
  const top = state.players.find((p) => p.color !== bottom)?.seat ?? 1;
  const bottomSeat = state.players.find((p) => p.color === bottom)?.seat ?? 0;
  const myTurn = canAct && (mySeat === null || state.currentSeat === mySeat);

  return (
    <main dir="rtl" className="relative flex min-h-[100dvh] w-full flex-col items-stretch gap-3
                               p-3 lg:h-[100dvh] lg:flex-row lg:items-center lg:justify-center
                               lg:overflow-hidden lg:gap-5">
      <ChessToast />

      {/* צד ימין: השחקנים והווידאו */}
      <aside className="flex w-full flex-col gap-2.5 lg:w-72">
        <PlayerCard state={state} seat={top} />
        {videoTiles && (
          <div className="h-32 w-full lg:h-[22rem]">{videoTiles}</div>
        )}
        <PlayerCard state={state} seat={bottomSeat} />
      </aside>

      {/* הלוח: ריבוע, חסום בגובה המסך במחשב וברוחבו בטלפון */}
      <div className="relative mx-auto w-full max-w-[min(100vw-1.5rem,100dvh-1.5rem)]
                      lg:h-full lg:w-auto lg:max-w-none"
           style={{ aspectRatio: "1 / 1" }}>
        <ChessBoard state={state} bottom={bottom} myColor={myColor} canMove={myTurn}
                    onMove={(from, to, promotion) =>
                      dispatch({ type: "chess_move", from, to, ...(promotion ? { promotion } : {}) })} />
        <ChessOver onLeave={onLeave} />
      </div>

      {/* צד שמאל: מצב, פעולות, מהלכים */}
      <aside className="flex w-full flex-col gap-2.5 lg:w-64">
        <ChessActions />
        <MoveList moves={state.moves} />
        <button onClick={onLeave}
                className="self-center text-[0.8rem] text-ink/50 underline-offset-4 hover:underline">
          יציאה מהמשחק
        </button>
      </aside>

      <ViewControls />
    </main>
  );
}
