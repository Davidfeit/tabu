import { useState } from "react";
import { Button } from "@/components/Button";

/** שחמט מקומי: שני שמות, ומתחילים. */
export function ChessSetup({ onStart, onBack }: {
  onStart: (names: [string, string]) => void; onBack: () => void;
}) {
  const [names, setNames] = useState<[string, string]>(["דנה", "יואב"]);
  const ready = names.every((n) => n.trim().length > 0);

  return (
    <div dir="rtl" className="mx-auto max-w-sm space-y-6 px-4 py-10">
      <header className="text-center">
        <h1 className="toy-title font-logo text-6xl">שחמט</h1>
        <p className="mt-2 font-display text-base text-ink/70">על מסך אחד</p>
      </header>

      <section className="toy-card space-y-2 p-4">
        {(["לבן", "שחור"] as const).map((side, i) => (
          <label key={side} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[0.8rem] font-semibold text-ink/70">{side}</span>
            <input value={names[i]} maxLength={14} aria-label={`שם השחקן ב${side}`}
                   onChange={(e) => setNames((v) => {
                     const next: [string, string] = [...v] as [string, string];
                     next[i] = e.target.value;
                     return next;
                   })}
                   className="toy-input min-w-0 flex-1 px-3 py-1.5 text-sm" />
          </label>
        ))}
      </section>

      <div className="flex flex-col items-center gap-3">
        <Button variant="primary" disabled={!ready} className="!px-6 !py-2.5 !text-base"
                onClick={() => onStart([names[0].trim(), names[1].trim()])}>
          התחלת המשחק
        </Button>
        <button onClick={onBack} className="text-[0.8rem] text-ink/50 underline-offset-4 hover:underline">
          חזרה
        </button>
      </div>
    </div>
  );
}
