import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** האם הוגדרה תשתית מקוונת. בלעדיה האפליקציה עובדת במצב מקומי בלבד. */
export const ONLINE_ENABLED = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!ONLINE_ENABLED) throw new Error("משחק מקוון לא מוגדר — חסרים משתני סביבה");
  client ??= createClient(url!, anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

/**
 * הזדהות אנונימית.
 *
 * חדרים פרטיים בלינק הזמנה — אין הרשמה, אין סיסמה, אין מייל. המשתמש מקבל
 * מזהה יציב שנשמר בדפדפן, וזה כל מה שנדרש כדי לזהות מושב ולאכוף בעלות.
 */
export async function signIn(): Promise<string> {
  const sb = supabase();
  const { data: existing } = await sb.auth.getSession();
  if (existing.session) return existing.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error("ההתחברות נכשלה");
  return data.user.id;
}

async function call<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke("play", { body: { op, ...body } });
  if (error) {
    // FunctionsHttpError עוטף את גוף התשובה; הקוד המכונתי חשוב יותר מהסטטוס.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? "NETWORK");
  }
  if (data && data.ok === false) throw new Error(data.error ?? "UNKNOWN");
  return data as T;
}

export interface RoomHandle { roomId: string; code?: string; seat?: number }

export const api = {
  createRoom: (name: string, token: string, settings: unknown) =>
    call<RoomHandle & { seedHash: string }>("create", { name, token, settings }),
  joinRoom: (code: string, name: string, token: string) =>
    call<RoomHandle>("join", { code: code.trim().toUpperCase(), name, token }),
  startGame: (roomId: string) => call<{ version: number; state: unknown }>("start", { roomId }),
  play: (roomId: string, action: unknown, idempotencyKey: string) =>
    call<{ version: number; state: unknown }>("play", { roomId, action, idempotencyKey }),
};

/**
 * שרתי ICE.
 *
 * STUN של גוגל מספיק לרוב, אבל לא מול symmetric NAT — ובישראל הסלולר עושה
 * שימוש כבד ב-CGNAT, ולכן להניח שכ-20% מהחיבורים יזדקקו לממסר. אישורי
 * TURN מונפקים ע"י השרת עם TTL קצר; המפתח לעולם לא מגיע לדפדפן.
 */
export async function iceServers(): Promise<RTCIceServer[]> {
  const base: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (!ONLINE_ENABLED) return base;
  try {
    const sb = supabase();
    const { data } = await sb.functions.invoke("ice", { body: {} });
    if (Array.isArray(data?.iceServers)) return [...base, ...data.iceServers];
  } catch { /* בלי TURN עדיין עובד לרוב המשתמשים */ }
  return base;
}
