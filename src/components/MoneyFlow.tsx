import { useEffect, useRef, useState } from "react";
import { shekelShort } from "@/lib/format";
import { transferFor, TRANSFER_LABEL, type Party, type Transfer } from "@/lib/money";
import { useGame } from "@/ui/GameContext";
import { seatColor } from "./Token";

const FLIGHT_MS = 2000;
/** גובה הקשת, ביחס למרחק. קו ישר נקרא כהחלקה ולא כהעברה. */
const ARC_LIFT = 0.22;

interface Flight extends Transfer {
  id: string;
  x0: number; y0: number;
  xm: number; ym: number;
  x1: number; y1: number;
}

/** נקודת העגינה של צד בתנועה: כרטיס שחקן, או מרכז הלוח עבור הבנק. */
function anchorOf(party: Party): DOMRect | null {
  const key = party === "bank" ? "bank" : `seat-${party}`;
  const el = document.querySelector(`[data-money="${key}"]`);
  return el ? el.getBoundingClientRect() : null;
}

function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * שטרות מעופפים בין חשבונות.
 *
 * ── למה שכבה קבועה ולא אנימציה בתוך כרטיס השחקן ──
 * התנועה חייבת לחצות את המסך מכרטיס אחד לאחר, ואלמנט בתוך כרטיס כלוא
 * ב-overflow שלו. שכבה ב-position: fixed מעל הכל היא היחידה שיכולה.
 *
 * המיקומים נקראים מה-DOM ברגע האירוע, ולא מחושבים מראש — הפריסה משתנה
 * עם מספר השחקנים ועם גודל החלון.
 */
export function MoneyFlow() {
  const { events, state } = useGame();
  const name = (seat: number) => state.players[seat]?.name ?? "";
  const [flights, setFlights] = useState<Flight[]>([]);
  const handled = useRef(new Set<number>());
  const primed = useRef(false);

  useEffect(() => {
    // בהרכבה הראשונה מסמנים את כל מה שכבר קרה כמטופל, אחרת טעינת משחק
    // קיים הייתה מפוצצת עשרות שטרות בבת אחת.
    if (!primed.current) {
      primed.current = true;
      for (const e of events) handled.current.add(e.seq);
      return;
    }
    if (reducedMotion()) {
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
      const a = anchorOf(t.from), b = anchorOf(t.to);
      if (!a || !b) continue;
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      const span = Math.hypot(x1 - x0, y1 - y0);
      fresh.push({
        ...t, id: `${e.seq}-${t.from}-${t.to}`,
        x0, y0, x1, y1,
        xm: (x0 + x1) / 2,
        ym: (y0 + y1) / 2 - span * ARC_LIFT,
      });
    }
    if (!fresh.length) return;

    setFlights((prev) => [...prev, ...fresh]);
    const id = setTimeout(() => {
      setFlights((prev) => prev.filter((f) => !fresh.some((n) => n.id === f.id)));
    }, FLIGHT_MS + fresh.length * 260 + 200);
    return () => clearTimeout(id);
  }, [events]);

  if (!flights.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {flights.map((f, i) => (
        <span key={f.id} className="tabu-bill absolute"
              style={{
                // הנתיב נמסר כמשתני CSS, כי הקואורדינטות נקראות בזמן ריצה
                // ואי אפשר לכתוב אותן ב-keyframes סטטי.
                ["--x0" as string]: `${f.x0}px`, ["--y0" as string]: `${f.y0}px`,
                ["--xm" as string]: `${f.xm}px`, ["--ym" as string]: `${f.ym}px`,
                ["--x1" as string]: `${f.x1}px`, ["--y1" as string]: `${f.y1}px`,
                // תשלומים מרובים יוצאים בזה אחר זה ולא נערמים זה על זה.
                animationDelay: `${i * 260}ms`,
              }}>
          <span data-dir={f.to === "bank" ? "out" : "in"}
                className="tabu-bill__note flex flex-col items-center rounded-md
                           px-3 py-1.5 text-parchment">
            <span className="text-[0.55rem] uppercase tracking-wide opacity-55">
              {TRANSFER_LABEL[f.reason] ?? "תשלום"}
            </span>
            <bdi className="tabular-nums text-[0.95rem] font-bold leading-tight">
              {shekelShort(f.amount)}
            </bdi>
            <span className="mt-0.5 flex items-center gap-1 text-[0.55rem] opacity-75">
              <span style={{ unicodeBidi: "plaintext" }}>
                {f.from === "bank" ? "הבנק" : name(f.from)}
              </span>
              {/* חץ SVG ולא תו טקסט: גיליון סגנון RTL הופך תווי חץ, והם
                  מתחילים לסתור את הכיוון שהם אמורים לתאר. */}
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 shrink-0 opacity-80"
                   fill="none" stroke="currentColor" strokeWidth="3"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12H5M11 6l-6 6 6 6" />
              </svg>
              <span style={{ unicodeBidi: "plaintext",
                             color: typeof f.to === "number" ? seatColor(f.to) : undefined }}>
                {f.to === "bank" ? "הבנק" : name(f.to)}
              </span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
