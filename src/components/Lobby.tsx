import { useState } from "react";
import { BOARD } from "@/lib/board";
import type { Settings } from "@/engine/types";
import { api, signIn } from "@/net/supabase";
import { Button } from "./Button";
import { Token } from "./Token";

const TOKENS = BOARD.tokens;

export interface JoinedRoom {
  roomId: string;
  seat: number;
  code: string;
  userId: string;
  isHost: boolean;
}

const JOIN_ERRORS: Record<string, string> = {
  NO_ROOM: "לא נמצא חדר עם הקוד הזה",
  ROOM_FULL: "החדר מלא",
  ALREADY_STARTED: "המשחק בחדר הזה כבר התחיל",
  AUTH_ANON_DISABLED:
    "התחברות אנונימית כבויה בפרויקט Supabase. " +
    "הפעילו אותה ב-Authentication → Providers → Anonymous sign-ins.",
};

/**
 * מה להציג לשגיאה שאין לה תרגום מוכן.
 *
 * "משהו השתבש" הוא מבוי סתום: הוא נכון תמיד ולכן לא עוזר אף פעם. שתי
 * התקלות שקורות בהתקנה חדשה — מתג התחברות אנונימית ו-ALLOWED_ORIGIN חסר —
 * שתיהן נראות זהות מבחוץ, ולכן הקוד הגולמי מוצג מתחת להודעה.
 */
export function explain(raw: string): { text: string; hint?: string; raw?: string } {
  if (JOIN_ERRORS[raw]) return { text: JOIN_ERRORS[raw]! };
  if (raw.startsWith("NETWORK")) {
    return {
      text: "השרת לא ענה.",
      hint: "אם זו התקנה חדשה: חסר ALLOWED_ORIGIN בסודות של ה-Edge Functions " +
            "ב-Supabase, וצריך שיהיה בו בדיוק כתובת האתר הזה.",
      raw,
    };
  }
  if (raw.startsWith("AUTH_FAILED")) return { text: "ההתחברות נכשלה.", raw };
  if (raw.startsWith("HTTP_")) return { text: "השרת החזיר שגיאה.", raw };
  if (raw === "SERVER_ERROR" || raw.startsWith("SERVER_ERROR")) {
    return { text: "שגיאה בשרת. הפרטים ביומן ה-Edge Functions ב-Supabase.", raw };
  }
  if (raw === "ROOM_CREATE_FAILED") {
    return { text: "יצירת החדר נכשלה בבסיס הנתונים.", raw };
  }
  return { text: "משהו השתבש. נסו שוב.", raw };
}

export function Lobby({ onJoined, onBack }: {
  onJoined: (room: JoinedRoom) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [tokenIdx, setTokenIdx] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof explain> | null>(null);

  const token = TOKENS[tokenIdx]!.key;
  const ready = name.trim().length > 0;

  async function run(fn: () => Promise<JoinedRoom>) {
    setBusy(true); setError(null);
    try { onJoined(await fn()); }
    catch (e) {
      setError(explain((e as Error).message));
    }
    finally { setBusy(false); }
  }

  const settings: Partial<Settings> = { mode: "quick", auctions: true };

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-5 py-10">
      <header className="text-center">
        <h1 className="font-logo text-5xl text-parchment">טאבו</h1>
        <p className="mt-1 text-sm text-parchment/50">משחק אונליין עם וידאו</p>
      </header>

      <section className="space-y-3 rounded-lg bg-black/25 p-4 ring-1 ring-white/10">
        <label className="block">
          <span className="mb-1 block text-[0.78rem] text-parchment/60">השם שלך</span>
          <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)}
                 className="w-full rounded-md bg-black/40 px-3 py-2 text-sm text-parchment
                            ring-1 ring-white/10 focus:outline-none focus:ring-2
                            focus:ring-amber-400/60" />
        </label>

        <div>
          <span className="mb-1.5 block text-[0.78rem] text-parchment/60">החייל שלך</span>
          <div className="flex flex-wrap gap-1.5">
            {TOKENS.map((t, i) => (
              <button key={t.key} onClick={() => setTokenIdx(i)} title={t.name}
                      aria-label={t.name} aria-pressed={i === tokenIdx}
                      className={`rounded-md p-1 ring-1 transition
                        ${i === tokenIdx ? "ring-2 ring-amber-400" : "ring-white/10"}`}>
                <Token token={t.key} seat={i} size={26} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg bg-black/25 p-4 ring-1 ring-white/10">
        <Button variant="primary" disabled={!ready || busy} className="w-full !py-2"
                onClick={() => run(async () => {
                  const userId = await signIn();
                  const r = await api.createRoom(name.trim(), token, settings);
                  return { roomId: r.roomId, seat: 0, code: r.code!, userId, isHost: true };
                })}>
          פתיחת חדר חדש
        </Button>

        <div className="flex items-center gap-2 py-1 text-[0.7rem] text-parchment/30">
          <span className="h-px flex-1 bg-white/10" />או<span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input value={code} maxLength={6} placeholder="קוד חדר"
                 onChange={(e) => setCode(e.target.value.toUpperCase())}
                 aria-label="קוד חדר"
                 className="min-w-0 flex-1 rounded-md bg-black/40 px-3 py-2 text-center
                            font-mono text-lg tracking-[0.3em] text-parchment
                            ring-1 ring-white/10 focus:outline-none focus:ring-2
                            focus:ring-amber-400/60"
                 style={{ direction: "ltr" }} />
          <Button disabled={!ready || busy || code.trim().length < 4}
                  onClick={() => run(async () => {
                    const userId = await signIn();
                    const r = await api.joinRoom(code, name.trim(), token);
                    return { roomId: r.roomId, seat: r.seat ?? 0, code: code.trim(),
                             userId, isHost: false };
                  })}>
            הצטרפות
          </Button>
        </div>
      </section>

      {error && (
        <div role="alert" className="space-y-1.5 rounded-md bg-red-500/15 px-3 py-2
                                     text-center text-[0.8rem] text-red-200">
          <p>{error.text}</p>
          {error.hint && <p className="text-red-200/70">{error.hint}</p>}
          {error.raw && (
            <p dir="ltr" className="font-mono text-[0.68rem] text-red-200/45">
              {error.raw}
            </p>
          )}
        </div>
      )}

      <div className="text-center">
        <button onClick={onBack}
                className="text-[0.78rem] text-parchment/40 underline-offset-4 hover:underline">
          חזרה למשחק מקומי
        </button>
      </div>
    </div>
  );
}
