import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { squareAt } from "@/lib/board";
import { shekel, shekelShort } from "@/lib/format";
import { errorText } from "@/lib/messages";
import { reduce } from "@/engine/reduce";
import { buildingUnits, deedAt } from "@/engine/selectors";
import { DEED_POSITIONS } from "@/engine/setup";
import type { GameState, TradeOffer } from "@/engine/types";
import { useGame } from "@/ui/GameContext";
import { Button } from "./Button";
import { seatColor, Token } from "./Token";

/** מרנדר לשכבה משלו על ה-body, מחוץ לכל מסגרת שממנה נפתח. */
const portal = (node: React.ReactNode) =>
  typeof document === "undefined" ? node : createPortal(node, document.body);

type Side = TradeOffer["give"];
const emptySide = (): Side => ({ cash: 0, deeds: [], jailCards: 0 });

/** שווי מוערך של צד בעסקה. לא חוק משחק — עזר להערכה ויזואלית. */
function sideValue(state: GameState, side: Side): number {
  return side.cash + side.deeds.reduce((n, pos) => {
    const d = state.deeds[pos]!;
    return n + (d.mortgaged ? deedAt(pos).mortgage : deedAt(pos).price);
  }, 0);
}

function DeedChip({ pos, state, picked, onToggle, disabled }: {
  pos: number; state: GameState; picked: boolean;
  onToggle: () => void; disabled: boolean;
}) {
  const d = state.deeds[pos]!;
  const sq = squareAt(pos);
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
            aria-pressed={picked}
            title={disabled ? "יש בנייה בקבוצת הצבע — צריך למכור אותה קודם" : undefined}
            className={`toy-chip px-2 py-1 text-right text-[0.68rem] leading-tight
                        transition disabled:cursor-not-allowed disabled:opacity-30
              ${picked ? "!border-toy-sun !bg-toy-sun/40 !text-ink" : ""}`}>
      <span className={d.mortgaged ? "line-through opacity-60" : ""}>{sq.name}</span>
      <span className="mr-1 tabular-nums text-[0.58rem] opacity-50">
        {shekelShort("price" in sq ? sq.price : 0)}
      </span>
    </button>
  );
}

function SideEditor({ seat, side, onChange, state, title }: {
  seat: number; side: Side; onChange: (s: Side) => void;
  state: GameState; title: string;
}) {
  const player = state.players[seat]!;
  const owned = DEED_POSITIONS.filter((p) => state.deeds[p]!.owner === seat);

  // חוק חד-משמעי מהמנוע: שטר אינו סחיר כל עוד יש בנייה כלשהי בקבוצת
  // הצבע שלו. הממשק מסמן זאת מראש במקום לתת לשרת לדחות.
  const locked = (pos: number) => {
    const sq = deedAt(pos);
    if (sq.type !== "property") return false;
    return DEED_POSITIONS.some((q) => {
      const qs = deedAt(q);
      return qs.type === "property" && qs.group === sq.group
        && buildingUnits(state, state.deeds[q]!) > 0;
    });
  };

  return (
    <section className="toy-card toy-card--flat flex min-w-0 flex-1 flex-col gap-2 p-3">
      <header className="flex items-center gap-2">
        <Token token={player.token} seat={seat} size={20} />
        <h3 className="min-w-0 flex-1 truncate font-display text-sm font-bold"
            style={{ color: seatColor(seat), unicodeBidi: "plaintext" }}>
          {title}
        </h3>
        <span className="tabular-nums text-[0.7rem] text-ink/60">
          <bdi>{shekel(player.cash)}</bdi>
        </span>
      </header>

      <label className="block">
        <span className="mb-1 block text-[0.68rem] font-semibold text-ink/65">מזומן</span>
        <input type="number" min={0} max={player.cash} step={10} value={side.cash}
               onChange={(e) => onChange({
                 ...side,
                 cash: Math.max(0, Math.min(player.cash, Math.round(+e.target.value || 0))),
               })}
               aria-label={`מזומן מ${title}`}
               className="toy-input w-full px-2 py-1 text-right tabular-nums text-sm" />
      </label>

      {player.getOutCards > 0 && (
        <label className="flex items-center gap-2 text-[0.72rem] text-ink/75">
          <input type="checkbox" checked={side.jailCards > 0}
                 onChange={(e) => onChange({ ...side, jailCards: e.target.checked ? 1 : 0 })} />
          כרטיס יציאה ממעצר בית
        </label>
      )}

      <div className="min-h-0 flex-1">
        <span className="mb-1 block text-[0.68rem] font-semibold text-ink/65">
          נכסים <span className="opacity-60">({owned.length})</span>
        </span>
        {owned.length === 0 ? (
          <p className="text-[0.68rem] text-ink/40">אין נכסים</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {owned.map((pos) => (
              <DeedChip key={pos} pos={pos} state={state} disabled={locked(pos)}
                        picked={side.deeds.includes(pos)}
                        onToggle={() => onChange({
                          ...side,
                          deeds: side.deeds.includes(pos)
                            ? side.deeds.filter((p) => p !== pos)
                            : [...side.deeds, pos],
                        })} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * בניית עסקה.
 *
 * ── למה בדיקה מול המנוע ולא כללים משוכפלים ──
 * הכפתור נבדק בהרצה יבשה של אותה פעולה שתישלח. שכפול הכללים בממשק היה
 * מתפצל מהמנוע ברגע שחוק אחד משתנה, והמשתמש היה מקבל דחייה אחרי לחיצה.
 */
export function TradeBuilder({ mySeat, onClose }: { mySeat: number; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const others = state.players.filter((p) => !p.bankrupt && p.seat !== mySeat);
  const [target, setTarget] = useState(others[0]?.seat ?? 0);
  const [give, setGive] = useState<Side>(emptySide);
  const [receive, setReceive] = useState<Side>(emptySide);

  const offer = useMemo(() => ({ fromSeat: mySeat, toSeat: target, give, receive }),
                        [mySeat, target, give, receive]);

  const check = useMemo(() => {
    const empty = give.cash === 0 && give.deeds.length === 0 && give.jailCards === 0
      && receive.cash === 0 && receive.deeds.length === 0 && receive.jailCards === 0;
    if (empty) return "עסקה ריקה — בחרו מה עובר לכל צד";
    const r = reduce(state, { type: "propose_trade", offer },
                     { seat: mySeat, now: Date.now(), seed: "dry-run" });
    return r.ok ? null : errorText(r.error);
  }, [state, offer, mySeat, give, receive]);

  const giveValue = sideValue(state, give);
  const receiveValue = sideValue(state, receive);

  // פורטל ו-fixed, ולא absolute.
  //
  // הכפתור שפותח את החלון יושב בלוח הפקדים שבמרכז הלוח — אלמנט ברוחב
  // ~180 פיקסלים — וכל absolute נמדד מול האב הממוקם הקרוב. כלומר החלון
  // נדחס לרוחב הכפתור שפתח אותו. שכבה משלו על ה-body מנתקת אותו מכל
  // הקשר שממנו נפתח.
  return portal(
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="הצעת עסקה"
         className="toy-overlay fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="tabu-pop toy-modal flex w-full max-w-2xl flex-col gap-3 p-5">
        <header className="flex items-center gap-3">
          <h2 className="flex-1 font-logo text-2xl text-ink">מכירה או החלפה</h2>
          {others.length > 1 && (
            <label className="flex items-center gap-2 text-[0.75rem] text-ink/60">
              עם
              <select value={target} onChange={(e) => { setTarget(+e.target.value);
                                                        setReceive(emptySide()); }}
                      aria-label="עם מי לסחור"
                      className="toy-input px-2 py-1 text-sm">
                {others.map((p) => (
                  <option key={p.seat} value={p.seat}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        <div className="flex gap-3">
          <SideEditor seat={mySeat} side={give} onChange={setGive} state={state}
                      title={`${state.players[mySeat]!.name} נותן`} />
          <SideEditor seat={target} side={receive} onChange={setReceive} state={state}
                      title={`${state.players[target]!.name} נותן`} />
        </div>

        {/* הערכת שווי — עזר בלבד, לא חוק. עסקה לא שוויונית עדיין חוקית. */}
        <div className="flex items-center justify-center gap-3 text-[0.72rem] text-ink/55">
          <span className="tabular-nums"><bdi>{shekel(giveValue)}</bdi></span>
          <span aria-hidden="true">↔</span>
          <span className="tabular-nums"><bdi>{shekel(receiveValue)}</bdi></span>
          {giveValue > 0 && receiveValue > 0 && (
            <span className={Math.abs(giveValue - receiveValue) / Math.max(giveValue, receiveValue) > 0.4
                             ? "font-semibold text-amber-600" : ""}>
              {giveValue === receiveValue ? "שווה"
                : giveValue > receiveValue ? "לטובת הצד השני" : "לטובתך"}
            </span>
          )}
        </div>

        {check && (
          <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 px-3
                                     py-1.5 text-center text-[0.78rem] text-red-700">{check}</p>
        )}

        <footer className="flex justify-center gap-2">
          <Button variant="primary" disabled={check !== null}
                  onClick={() => { dispatch({ type: "propose_trade", offer }, mySeat); onClose(); }}>
            שלח הצעה
          </Button>
          <Button onClick={onClose}>ביטול</Button>
        </footer>
      </div>
    </div>,
  );
}

/** ההצעה הפתוחה, כפי שהיא נראית לצד המקבל. */
export function TradeOfferCard() {
  const { state, dispatch, canControl } = useGame();
  const offer = state.trade;
  if (!offer) return null;

  const from = state.players[offer.fromSeat]!;
  const to = state.players[offer.toSeat]!;
  const mine = canControl(offer.toSeat);

  const list = (side: Side, who: string) => (
    <div className="toy-card toy-card--flat min-w-0 flex-1 p-2.5">
      <div className="mb-1 text-[0.68rem] text-ink/55">{who} נותן</div>
      <ul className="space-y-0.5 text-[0.74rem] text-ink/85">
        {side.cash > 0 && <li className="tabular-nums"><bdi>{shekel(side.cash)}</bdi></li>}
        {side.deeds.map((pos) => <li key={pos}>{squareAt(pos).name}</li>)}
        {side.jailCards > 0 && <li>כרטיס יציאה ממעצר בית</li>}
        {side.cash === 0 && side.deeds.length === 0 && side.jailCards === 0 && (
          <li className="text-ink/35">כלום</li>
        )}
      </ul>
    </div>
  );

  return portal(
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="הצעת עסקה נכנסת"
         className="toy-overlay fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="tabu-pop toy-modal w-full max-w-md space-y-3 p-5">
        <h2 className="text-center font-display text-base font-bold text-ink">
          <span style={{ color: seatColor(from.seat), unicodeBidi: "plaintext" }}>{from.name}</span>
          {" מציע עסקה ל"}
          <span style={{ color: seatColor(to.seat), unicodeBidi: "plaintext" }}>{to.name}</span>
        </h2>

        <div className="flex gap-2">
          {list(offer.give, from.name)}
          {list(offer.receive, to.name)}
        </div>

        <div className="flex justify-center gap-2">
          <Button variant="primary" disabled={!mine}
                  onClick={() => dispatch({ type: "accept_trade" }, offer.toSeat)}>
            קבל
          </Button>
          <Button variant="danger" disabled={!mine && !canControl(offer.fromSeat)}
                  onClick={() => dispatch({ type: "reject_trade" },
                                          mine ? offer.toSeat : offer.fromSeat)}>
            דחה
          </Button>
        </div>
      </div>
    </div>,
  );
}
