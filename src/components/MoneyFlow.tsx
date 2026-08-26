import { useEffect, useRef, useState } from "react";
import { squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { transferFor, transferTitle, type Party, type Transfer } from "@/lib/money";
import { useGame } from "@/ui/GameContext";
import { seatColor } from "./Token";

const FLIGHT_MS = 2000;
const STAGGER_MS = 300;
/** גובה הקשת ביחס למרחק, עם רצפה. */
const ARC_RATIO = 0.28;
/**
 * קשת מינימלית בפיקסלים.
 *
 * העברה בין שני שחקנים סמוכים באותו פאנל עוברת מרחק של ~80px, וקשת
 * יחסית לבדה כמעט לא נראית. רצפה מכריחה את השטר לצאת מהעמודה ולחזור,
 * וזה מה שהופך אותו לתנועה שאפשר לעקוב אחריה.
 */
const ARC_MIN = 190;
/**
 * שוליים שהשטר לא חורג מהם.
 *
 * מוגבלות *כל* נקודות הנתיב, לא רק שיא הקשת: השטר מרונדר בהיסט של
 * ‎-118%‎ כדי לא לכסות את היתרה שהוא מסביר, ולכן גם נקודת ההופעה מורמת
 * בגובה שטר שלם. שטר שיוצא מכרטיס בראש הפאנל חרג כבר בהופעתו.
 *
 * ההצמדה מזיזה את השטר מעט מהכרטיס, וזה בסדר — טבעת ההדגשה על הכרטיס
 * היא שמסמנת בדיוק מי משלם ומי מקבל.
 */
const EDGE_X = 140;
const EDGE_TOP = 125;
const EDGE_BOTTOM = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** מצמיד נקודה כך שהשטר כולו נשאר בתוך החלון. */
function inside(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, EDGE_X, window.innerWidth - EDGE_X),
    y: clamp(y, EDGE_TOP, window.innerHeight - EDGE_BOTTOM),
  };
}

interface Flight extends Transfer {
  id: string;
  title: string;
  x0: number; y0: number;
  xm: number; ym: number;
  x1: number; y1: number;
}

const anchorKey = (party: Party) => (party === "bank" ? "bank" : `seat-${party}`);

function anchorOf(party: Party): HTMLElement | null {
  return document.querySelector(`[data-money="${anchorKey(party)}"]`);
}

function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * שטרות מעופפים בין חשבונות.
 *
 * ── מה השטר אומר ──
 * כמה, למה, ועל מה: "שכר דירה על רמת גן · ₪30,000 · דנה ← יואב". סכום
 * לבדו לא מסביר מה קרה, וזה משחק שכולו כסף.
 *
 * ── למה שכבה קבועה ──
 * התנועה חוצה בין העמודות, ואלמנט בתוך כרטיס שחקן כלוא ב-overflow שלו.
 *
 * ── למה נגיעה ישירה ב-DOM ──
 * שני קצות התנועה מודגשים בזמן המעוף. הכרטיסים האלה כבר נמצאים דרך
 * querySelector כדי לקרוא את מיקומם, והם חיים בענפים אחרים של העץ;
 * העברת מצב אליהם דרך React הייתה מוסיפה צימוד לאורך כל הדרך בשביל
 * אפקט חזותי בלבד.
 */
export function MoneyFlow() {
  const { events, state } = useGame();
  const [flights, setFlights] = useState<Flight[]>([]);
  const handled = useRef(new Set<number>());
  const primed = useRef(false);

  const name = (seat: number) => state.players[seat]?.name ?? "";

  useEffect(() => {
    // בהרכבה הראשונה מסמנים את כל מה שכבר קרה כמטופל, אחרת טעינת משחק
    // קיים הייתה מפוצצת עשרות שטרות בבת אחת.
    if (!primed.current || reducedMotion()) {
      primed.current = true;
      for (const e of events) handled.current.add(e.seq);
      return;
    }

    const fresh: Flight[] = [];
    // events מגיע חדש-לישן; הופכים כדי לשלוח בסדר שבו זה קרה.
    for (const e of [...events].reverse()) {
      if (handled.current.has(e.seq)) continue;
      handled.current.add(e.seq);
      const t = transferFor(e);
      if (!t) continue;
      const a = anchorOf(t.from)?.getBoundingClientRect();
      const b = anchorOf(t.to)?.getBoundingClientRect();
      if (!a || !b) continue;

      const src = inside(a.left + a.width / 2, a.top + a.height / 2);
      const dst = inside(b.left + b.width / 2, b.top + b.height / 2);
      const { x: x0, y: y0 } = src;
      const { x: x1, y: y1 } = dst;
      const span = Math.hypot(x1 - x0, y1 - y0);
      const lift = Math.max(ARC_MIN, span * ARC_RATIO);
      // הקשת יוצאת לצד שיש בו מקום, כדי שלא תיחתך בקצה החלון.
      const towardCenter = (x0 + x1) / 2 < window.innerWidth / 2 ? 1 : -1;

      fresh.push({
        ...t,
        id: `${e.seq}-${t.from}-${t.to}`,
        title: transferTitle(t, (pos) => squareAt(pos).name),
        x0, y0, x1, y1,
        // בטיסה קצרה הקשת חייבת גם לצאת הצידה, אחרת היא רק קו אנכי קטן.
        ...(() => {
          const mid = inside((x0 + x1) / 2 + (span < ARC_MIN * 1.5 ? lift * 1.05 * towardCenter : 0),
                             (y0 + y1) / 2 - lift);
          return { xm: mid.x, ym: mid.y };
        })(),
      });
    }
    if (!fresh.length) return;

    setFlights((prev) => [...prev, ...fresh]);

    // הדגשת שני הקצוות בזמן המעוף
    const marks: [HTMLElement, string][] = [];
    fresh.forEach((f, i) => {
      const src = anchorOf(f.from), dst = anchorOf(f.to);
      setTimeout(() => {
        if (src) { src.classList.add("tabu-anchor-out"); marks.push([src, "tabu-anchor-out"]); }
      }, i * STAGGER_MS);
      setTimeout(() => {
        if (dst) { dst.classList.add("tabu-anchor-in"); marks.push([dst, "tabu-anchor-in"]); }
      }, i * STAGGER_MS + FLIGHT_MS * 0.8);
    });

    const cleanup = setTimeout(() => {
      for (const [el, cls] of marks) el.classList.remove(cls);
      setFlights((prev) => prev.filter((f) => !fresh.some((n) => n.id === f.id)));
    }, FLIGHT_MS + fresh.length * STAGGER_MS + 400);

    return () => {
      clearTimeout(cleanup);
      for (const [el, cls] of marks) el.classList.remove(cls);
    };
  }, [events, state.players]);

  if (!flights.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {flights.map((f, i) => {
        const toBank = f.to === "bank";
        return (
          <span key={f.id} className="tabu-bill absolute"
                style={{
                  // הנתיב נמסר כמשתני CSS: הקואורדינטות נקראות בזמן ריצה
                  // ואי אפשר לכתוב אותן ב-keyframes סטטי.
                  ["--x0" as string]: `${f.x0}px`, ["--y0" as string]: `${f.y0}px`,
                  ["--xm" as string]: `${f.xm}px`, ["--ym" as string]: `${f.ym}px`,
                  ["--x1" as string]: `${f.x1}px`, ["--y1" as string]: `${f.y1}px`,
                  // תשלומים מרובים יוצאים בזה אחר זה ולא נערמים.
                  animationDelay: `${i * STAGGER_MS}ms`,
                }}>
            <span data-dir={toBank ? "out" : "in"}
                  className="tabu-bill__note block min-w-[9.5rem] max-w-[15rem] rounded-lg
                             px-3 py-2 text-parchment">
              <span className="block text-[0.66rem] font-semibold leading-tight opacity-85">
                {f.title}
              </span>
              <bdi className="mt-0.5 block tabular-nums text-[1.05rem] font-bold leading-none">
                {shekel(f.amount)}
              </bdi>
              <span className="mt-1.5 flex items-center justify-center gap-1.5
                               border-t border-white/15 pt-1 text-[0.6rem]">
                <span className="font-semibold" style={{ unicodeBidi: "plaintext",
                        color: typeof f.from === "number" ? seatColor(f.from) : "#e5d3a3" }}>
                  {f.from === "bank" ? "הבנק" : name(f.from)}
                </span>
                {/* חץ SVG ולא תו טקסט: גיליון סגנון RTL הופך תווי חץ,
                    והם מתחילים לסתור את הכיוון שהם מתארים. */}
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 opacity-70"
                     fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12H5M11 6l-6 6 6 6" />
                </svg>
                <span className="font-semibold" style={{ unicodeBidi: "plaintext",
                        color: typeof f.to === "number" ? seatColor(f.to) : "#e5d3a3" }}>
                  {f.to === "bank" ? "הבנק" : name(f.to)}
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
