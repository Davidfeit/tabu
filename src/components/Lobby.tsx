import { useMemo, useState } from "react";
import { BOARD } from "@/lib/board";
import type { Settings } from "@/engine/types";
import { loadProfile, saveProfile } from "@/net/profile";
import { CHESS_ACTIONS } from "@/chess/reduce";
import { api, signIn, staleServer } from "@/net/supabase";
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
  SERVER_NO_CHESS:
    "השרת עדיין לא מכיר שחמט. אחרי דחיפה הוא נפרס תוך דקה — נסו שוב; " +
    "אם זה נשאר, הריצו npm run setup:supabase.",
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

/**
 * קוד חדר מתוך כתובת ההזמנה.
 *
 * הלינק הוא ‎…/#ABC123‎. בלי זה המוזמן ראה מסך עם שתי אפשרויות והיה צריך
 * להקליד ידנית קוד שכבר היה בכתובת שלחץ עליה.
 */
export function inviteCode(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(raw) ? raw : null;
}

export type GameKind = "tabu" | "chess";

export function Lobby({ onJoined, onBack, invite, game = "tabu" }: {
  onJoined: (room: JoinedRoom) => void;
  onBack: () => void;
  /** קוד מקישור הזמנה. כשהוא קיים, המסך הופך למסך הצטרפות בלבד. */
  invite?: string | null;
  /** איזה משחק לפתוח. מי שמצטרף לא בוחר — החדר כבר יודע. */
  game?: GameKind;
}) {
  // מי שכבר שיחק לא מקליד את שמו שוב.
  const saved = useMemo(loadProfile, []);
  const [name, setName] = useState(saved?.name ?? "");
  const [tokenIdx, setTokenIdx] = useState(
    () => Math.max(0, TOKENS.findIndex((t) => t.key === saved?.token)));
  const [code, setCode] = useState(invite ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof explain> | null>(null);

  const token = TOKENS[tokenIdx]!.key;
  const ready = name.trim().length > 0;

  async function run(fn: () => Promise<JoinedRoom>) {
    setBusy(true); setError(null);
    try {
      const room = await fn();
      saveProfile({ name: name.trim(), token, code: room.code, at: Date.now() });
      onJoined(room);
    }
    catch (e) {
      setError(explain((e as Error).message));
    }
    finally { setBusy(false); }
  }

  // מכרזים הוסרו: הם עצרו את המשחק וסיבכו אותו יותר משתרמו. תג המשחק
  // נאפה בהגדרות החדר — השרת יוצר לפיו את הלוח הנכון בהתחלה.
  const settings: Partial<Settings> & { game: GameKind } =
    { mode: "quick", auctions: false, game };

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-5 px-4 py-10">
      <header className="text-center">
        <h1 className="toy-title font-logo text-6xl">{game === "chess" && !invite ? "שחמט" : "טאבו"}</h1>
        <p className="mt-2 font-display text-base text-ink/70">
          {invite ? "הצטרפות למשחק" : game === "chess" ? "שחמט אונליין עם וידאו" : "משחק אונליין עם וידאו"}
        </p>
      </header>

      <section className="toy-card space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[0.8rem] font-semibold text-ink/70">השם שלך</span>
          <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)}
                 className="toy-input w-full px-3 py-2 text-sm" />
        </label>

        <div>
          <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink/70">החייל שלך</span>
          <div className="flex flex-wrap gap-1.5">
            {TOKENS.map((t, i) => (
              <button key={t.key} onClick={() => setTokenIdx(i)} title={t.name}
                      aria-label={t.name} aria-pressed={i === tokenIdx}
                      className={`rounded-full bg-white p-1.5 transition
                        ${i === tokenIdx
                          ? "ring-[3px] ring-toy-sun shadow-[0_3px_0_#d3a63a]"
                          : "ring-2 ring-toy-edge"}`}>
                <Token token={t.key} seat={i} size={26} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="toy-card space-y-2 p-4">
        {invite ? (
          <>
            <p className="text-center text-[0.85rem] text-ink/75">
              הוזמנתם לחדר{" "}
              <span className="font-mono font-bold tracking-[0.2em] text-ink"
                    style={{ direction: "ltr", unicodeBidi: "isolate" }}>{invite}</span>
            </p>
            <Button variant="primary" disabled={!ready || busy} className="w-full !py-2"
                    onClick={() => run(async () => {
                      const userId = await signIn();
                      const r = await api.joinRoom(invite, name.trim(), token);
                      return { roomId: r.roomId, seat: r.seat ?? 0, code: invite,
                               userId, isHost: false };
                    })}>
              {busy ? "מצטרף…" : "הצטרפות למשחק"}
            </Button>
          </>
        ) : (
        <>
        <Button variant="primary" disabled={!ready || busy} className="w-full !py-2"
                onClick={() => run(async () => {
                  // שרת שלא מכיר שחמט פותח חדר שחמט כמונופול, בשקט: הוא
                  // מתעלם מהתג ובונה את הלוח היחיד שהוא יודע. עדיף לעצור
                  // כאן עם הסבר מאשר להושיב שניים מול לוח לא נכון.
                  if (game === "chess") {
                    const stale = await staleServer([], CHESS_ACTIONS);
                    if (stale) throw new Error("SERVER_NO_CHESS");
                  }
                  const userId = await signIn();
                  const r = await api.createRoom(name.trim(), token, settings);
                  return { roomId: r.roomId, seat: 0, code: r.code!, userId, isHost: true };
                })}>
          פתיחת חדר חדש
        </Button>

        <div className="flex items-center gap-2 py-1 text-[0.72rem] text-ink/40">
          <span className="h-0.5 flex-1 rounded bg-toy-edge" />או
          <span className="h-0.5 flex-1 rounded bg-toy-edge" />
        </div>

        <div className="flex gap-2">
          <input value={code} maxLength={6} placeholder="קוד חדר"
                 onChange={(e) => setCode(e.target.value.toUpperCase())}
                 aria-label="קוד חדר"
                 className="toy-input min-w-0 flex-1 px-3 py-2 text-center
                            font-mono text-lg tracking-[0.3em]"
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
        </>
        )}
      </section>

      {error && (
        <div role="alert" className="space-y-1.5 rounded-2xl border-2 border-red-200
                                     bg-red-50 px-3 py-2.5 text-center text-[0.8rem]
                                     text-red-700">
          <p className="font-semibold">{error.text}</p>
          {error.hint && <p className="text-red-700/80">{error.hint}</p>}
          {error.raw && (
            <p dir="ltr" className="font-mono text-[0.68rem] text-red-700/50">
              {error.raw}
            </p>
          )}
        </div>
      )}

      <div className="text-center">
        <button onClick={onBack}
                className="text-[0.8rem] text-ink/50 underline-offset-4 hover:underline">
          חזרה
        </button>
      </div>
    </div>
  );
}
