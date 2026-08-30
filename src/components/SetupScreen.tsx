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
    <div dir="rtl" className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <header className="text-center">
        <h1 className="toy-title font-logo text-6xl">טאבו</h1>
        <p className="mt-2 font-display text-base text-ink/70">משחק הנדל״ן הישראלי</p>
      </header>

      <section className="toy-card space-y-2 p-4">
        <h2 className="font-display text-base font-bold text-ink">שחקנים</h2>
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2">
            <Token token={TOKENS[i]!.key} seat={i} size={22} dimmed={!n.trim()} />
            <input
              value={n}
              onChange={(e) => setNames((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={i < 2 ? "שם השחקן" : "ריק = לא משחק"}
              maxLength={14}
              aria-label={`שם שחקן ${i + 1}`}
              className="toy-input min-w-0 flex-1 px-3 py-1.5 text-sm"
              style={{ borderInlineStartColor: seatColor(i) }}
            />
            <span className="w-16 shrink-0 text-[0.66rem] text-ink/45">
              {TOKENS[i]!.name}
            </span>
          </div>
        ))}
      </section>

      <section className="toy-card space-y-2 p-4">
        <h2 className="font-display text-base font-bold text-ink">מצב משחק</h2>
        {MODES.map((m) => (
          <label key={m.key}
                 className={`flex cursor-pointer items-start gap-2.5 rounded-2xl p-2.5
                             ${mode === m.key
                               ? "bg-toy-sun/25 ring-[3px] ring-toy-sun"
                               : "bg-toy-grape/10 ring-2 ring-toy-edge"}`}>
            <input type="radio" name="mode" checked={mode === m.key} className="mt-1"
                   onChange={() => setMode(m.key)} />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{m.label}</span>
              <span className="block text-[0.68rem] text-ink/55">{m.hint}</span>
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
          <p className="mt-2 text-[0.72rem] text-ink/50">
            צריך לפחות <bdi>{BOARD.meta.minPlayers}</bdi> שחקנים
          </p>
        )}
      </div>
    </div>
  );
}
