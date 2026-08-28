import { useState } from "react";
import { BOARD } from "@/lib/board";
import type { Settings } from "@/engine/types";
import type { SeatSpec } from "@/engine/setup";
import { Button } from "./Button";
import { seatColor, Token } from "./Token";

const TOKENS = BOARD.tokens;
const MODES: { key: Settings["mode"]; label: string; hint: string }[] = [
  { key: "quick", label: "מהיר", hint: "45–60 דקות · נכסים מחולקים · מלון ב-3 בתים" },
  { key: "full",  label: "משחק מלא", hint: "החוקים המלאים · בלי תקרת זמן" },
  { key: "blitz", label: "בזק", hint: "~25 דקות · מלון ב-2 בתים" },
];

export function SetupScreen({ onStart }: {
  onStart: (seats: SeatSpec[], settings: Partial<Settings>) => void;
}) {
  // מספר המושבים נגזר מהלוח ולא נכתב כאן — שישה שדות נשארו אחרי שהמשחק
  // הוגבל לארבעה, ושני האחרונים היו מציעים מושב שאי אפשר להתחיל איתו.
  const [names, setNames] = useState(
    () => ["דנה", "יואב", ...Array(BOARD.meta.maxPlayers - 2).fill("")]);
  const [mode, setMode] = useState<Settings["mode"]>("quick");

  const filled = names.map((n, i) => ({ n: n.trim(), i })).filter((x) => x.n.length > 0);
  const ready = filled.length >= BOARD.meta.minPlayers;

  return (
    <div dir="rtl" className="mx-auto max-w-lg space-y-6 py-10">
      <header className="text-center">
        <h1 className="font-logo text-5xl text-parchment">טאבו</h1>
        <p className="mt-1 text-sm text-parchment/50">משחק הנדל״ן הישראלי</p>
      </header>

      <section className="space-y-2 rounded-lg bg-black/25 p-4 ring-1 ring-white/10">
        <h2 className="font-display text-sm font-bold text-parchment">שחקנים</h2>
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2">
            <Token token={TOKENS[i]!.key} seat={i} size={22} dimmed={!n.trim()} />
            <input
              value={n}
              onChange={(e) => setNames((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={i < 2 ? "שם השחקן" : "ריק = לא משחק"}
              maxLength={14}
              aria-label={`שם שחקן ${i + 1}`}
              className="min-w-0 flex-1 rounded-md bg-black/40 px-3 py-1.5 text-sm
                         text-parchment ring-1 ring-white/10 placeholder:text-parchment/25
                         focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              style={{ borderInlineStartColor: seatColor(i) }}
            />
            <span className="w-16 shrink-0 text-[0.66rem] text-parchment/35">
              {TOKENS[i]!.name}
            </span>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-lg bg-black/25 p-4 ring-1 ring-white/10">
        <h2 className="font-display text-sm font-bold text-parchment">מצב משחק</h2>
        {MODES.map((m) => (
          <label key={m.key}
                 className={`flex cursor-pointer items-start gap-2.5 rounded-md p-2 ring-1
                             ${mode === m.key ? "bg-amber-400/10 ring-amber-400/50"
                                              : "bg-black/20 ring-white/5"}`}>
            <input type="radio" name="mode" checked={mode === m.key} className="mt-1"
                   onChange={() => setMode(m.key)} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-parchment">{m.label}</span>
              <span className="block text-[0.68rem] text-parchment/45">{m.hint}</span>
            </span>
          </label>
        ))}

        
      </section>

      <div className="text-center">
        <Button variant="primary" disabled={!ready} className="!px-6 !py-2.5 !text-base"
                onClick={() => onStart(
                  filled.map(({ n, i }) => ({
                    userId: `local-${i}`, name: n, token: TOKENS[i]!.key,
                  })),
                  { mode, auctions: false },
                )}>
          התחל משחק
        </Button>
        {!ready && (
          <p className="mt-2 text-[0.7rem] text-parchment/40">
            צריך לפחות <bdi>{BOARD.meta.minPlayers}</bdi> שחקנים
          </p>
        )}
      </div>
    </div>
  );
}
