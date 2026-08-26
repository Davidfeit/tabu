import { useEffect, useRef, useState } from "react";
import { shekelShort } from "@/lib/format";
import { transferFor, TRANSFER_LABEL, type Party, type Transfer } from "@/lib/money";
import { useGame } from "@/ui/GameContext";
import { seatColor } from "./Token";

const FLIGHT_MS = 900;

interface Flight extends Transfer {
  id: string;
  x0: number; y0: number;
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
  const { events } = useGame();
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
      fresh.push({
        ...t, id: `${e.seq}-${t.from}-${t.to}`,
        x0: a.left + a.width / 2, y0: a.top + a.height / 2,
        x1: b.left + b.width / 2, y1: b.top + b.height / 2,
      });
    }
    if (!fresh.length) return;

    setFlights((prev) => [...prev, ...fresh]);
    const id = setTimeout(() => {
      setFlights((prev) => prev.filter((f) => !fresh.some((n) => n.id === f.id)));
    }, FLIGHT_MS + 120);
    return () => clearTimeout(id);
  }, [events]);

  if (!flights.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {flights.map((f, i) => (
        <span key={f.id}
              className="tabu-bill absolute flex items-center gap-1 whitespace-nowrap
                         rounded-md px-2 py-1 text-[0.72rem] font-bold shadow-lg"
              style={{
                // הנתיב נמסר כמשתני CSS, כי הקואורדינטות נקראות בזמן ריצה
                // ואי אפשר לכתוב אותן ב-keyframes סטטי.
                ["--x0" as string]: `${f.x0}px`, ["--y0" as string]: `${f.y0}px`,
                ["--x1" as string]: `${f.x1}px`, ["--y1" as string]: `${f.y1}px`,
                animationDelay: `${i * 90}ms`,
                backgroundColor: f.to === "bank" ? "#7f1d1d" : "#14532d",
                color: "#f5f0e4",
                borderInlineStart: `3px solid ${
                  typeof f.to === "number" ? seatColor(f.to) : "#d4d4d4"}`,
              }}>
          <bdi className="tabular-nums">{shekelShort(f.amount)}</bdi>
          <span className="opacity-60">{TRANSFER_LABEL[f.reason] ?? ""}</span>
        </span>
      ))}
    </div>
  );
}
