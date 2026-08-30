import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * מה בדיוק לא בסדר בהגדרה, אם משהו.
 *
 * Vite מטמיע את המשתנים בזמן הבנייה, ולכן "הגדרתי אותם" ו"הם בבנייה" הם
 * שתי טענות שונות: שמירה בלוח הבקרה בלי בנייה מחדש לא משנה כלום. ההודעה
 * הישנה אמרה רק "דורש הגדרת Supabase", וזה חסר תועלת למי שכבר הגדיר.
 * כאן נאמר מי משני המשתנים הגיע, כדי להבחין בין בנייה ישנה (שניהם חסרים)
 * לבין שגיאת כתיב בשם אחד מהם (רק אחד חסר).
 */
export function describeConfig(
  url: string | undefined, anonKey: string | undefined,
): string | null {
  const missing: string[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  if (!anonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  if (missing.length === 2) return "שני המשתנים לא הגיעו לבנייה";
  if (missing.length === 1) return `${missing[0]} לא הגיע לבנייה`;

  // ערכי ה-placeholder מ-.env.example נראים תקינים אבל מצביעים לשומקום.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url!.trim())) {
    return `VITE_SUPABASE_URL אינו כתובת פרויקט תקינה: ${url}`;
  }
  if (!/^ey[\w-]+\.[\w-]+\.[\w-]+$/.test(anonKey!.trim())) {
    return "VITE_SUPABASE_ANON_KEY אינו JWT תקין (מפתח anon מתחיל ב-ey)";
  }
  return null;
}

/** מה חסם את המצב המקוון, או null אם הכל תקין. מוצג למשתמש. */
export const CONFIG_PROBLEM = describeConfig(url, anonKey);

/** האם הוגדרה תשתית מקוונת. בלעדיה האפליקציה עובדת במצב מקומי בלבד. */
export const ONLINE_ENABLED = CONFIG_PROBLEM === null;

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
  if (error || !data.user) {
    // הסיבה השכיחה היא מתג שלא הופעל בלוח הבקרה, וההודעה של Supabase אומרת
    // זאת במפורש. "ההתחברות נכשלה" לבדה הסתירה בדיוק את מה שצריך לתקן.
    const raw = error?.message ?? "לא התקבל משתמש";
    if (/anonymous.*disabled|anonymous_provider_disabled/i.test(raw)) {
      throw new Error("AUTH_ANON_DISABLED");
    }
    throw new Error(`AUTH_FAILED: ${raw}`);
  }
  return data.user.id;
}

async function call<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke("play", { body: { op, ...body } });
  if (error) {
    // FunctionsHttpError עוטף את גוף התשובה; הקוד המכונתי חשוב יותר מהסטטוס.
    const ctx = (error as { context?: Response }).context;
    const detail = await ctx?.json?.().catch(() => null);
    if (detail?.error) throw new Error(detail.error);

    // בלי גוף תשובה אין מה לפענח, ואז הסטטוס הוא כל מה שיש. הבחנה חשובה:
    // כשל רשת/CORS מגיע בלי סטטוס בכלל — וזה בדיוק מה שקורה כשחסר
    // ALLOWED_ORIGIN בסודות של ה-Edge Function, כי הדפדפן חוסם את התשובה.
    if (typeof ctx?.status === "number") {
      throw new Error(`HTTP_${ctx.status}: ${error.message}`);
    }
    throw new Error(`NETWORK: ${error.message}`);
  }
  if (data && data.ok === false) throw new Error(data.error ?? "UNKNOWN");
  return data as T;
}

export interface RoomHandle {
  roomId: string; code?: string; seat?: number;
  /** האם הקורא הוא המארח. חסר בשרת ישן — ראה החזרה ל-seat 0 בלקוח. */
  host?: boolean;
}

export const api = {
  createRoom: (name: string, token: string, settings: unknown) =>
    call<RoomHandle & { seedHash: string }>("create", { name, token, settings }),
  joinRoom: (code: string, name: string, token: string) =>
    call<RoomHandle>("join", { code: code.trim().toUpperCase(), name, token }),
  startGame: (roomId: string) => call<{ version: number; state: unknown }>("start", { roomId }),
  play: (roomId: string, action: unknown, idempotencyKey: string) =>
    call<{ version: number; state: unknown }>("play", { roomId, action, idempotencyKey }),
  signal: (roomId: string, to: string, message: unknown) =>
    call<{ ok: true }>("signal", { roomId, to, message }),
  ops: () => call<{ ops: string[] }>("ops"),
};

/**
 * האם ה-Edge Function שנפרסה מכירה את הפעולות שהלקוח צריך.
 *
 * האתר נפרס אוטומטית בכל דחיפה, אבל הפונקציות נפרסות רק ב-setup:supabase.
 * שני החצאים יכולים להתפצל בשקט, ואז תקלת שרת נראית כמו תקלת רשת.
 */
export async function staleServer(required: string[]): Promise<string | null> {
  try {
    const { ops } = await api.ops();
    const missing = required.filter((op) => !ops.includes(op));
    return missing.length ? `חסרות פעולות בשרת: ${missing.join(", ")}` : null;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === "UNKNOWN_OP") return "ה-Edge Function בשרת ישנה";
    return null;   // תקלת רשת אמיתית — לא ענייננו כאן
  }
}

/**
 * שרתי ICE.
 *
 * STUN של גוגל מספיק לרוב, אבל לא מול symmetric NAT — ובישראל הסלולר עושה
 * שימוש כבד ב-CGNAT, ולכן להניח שכ-20% מהחיבורים יזדקקו לממסר. אישורי
 * TURN מונפקים ע"י השרת עם TTL קצר; המפתח לעולם לא מגיע לדפדפן.
 */
/**
 * ממסר ציבורי חינמי, כברירת מחדל.
 *
 * הנחת "רוב החיבורים יסתדרו ישירות" נבדקה ונפלה: ICE נתקע ב-connecting
 * בין שני מכשירים בבית אחד, וזה תסמין של רשת שחוסמת עמית-לעמית. בלי
 * ממסר אין וידאו, נקודה — ולכן ממסר הוא לא "אופציונלי לשיפור" אלא חלק
 * מהמסלול הבסיסי.
 *
 * Open Relay של metered.ca נותן TURN פתוח בלי הרשמה. האישורים גלויים
 * לכולם ואין עליו התחייבות זמינות, ולכן הוא הגיבוי ולא הבחירה: אם
 * הוגדרו מפתחות Cloudflare בשרת, הם נכנסים ראשונים ברשימה ו-ICE ינסה
 * אותם קודם. פורט 443 ו-TCP קיימים כאן בכוונה — הם עוברים גם ברשתות
 * שחוסמות UDP, וזה בדיוק המקרה שבגללו הכול נבנה.
 */
const FREE_RELAY: RTCIceServer[] = [
  { urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:staticauth.openrelay.metered.ca:443",
    username: "openrelayproject", credential: "openrelayproject" },
];

export async function iceServers(): Promise<RTCIceServer[]> {
  const base: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (!ONLINE_ENABLED) return [...base, ...FREE_RELAY];
  try {
    const sb = supabase();
    const { data } = await sb.functions.invoke("ice", { body: {} });
    if (Array.isArray(data?.iceServers) && data.iceServers.length) {
      return [...base, ...data.iceServers, ...FREE_RELAY];
    }
  } catch { /* אין אישורים פרטיים — נשארים עם הציבורי */ }
  return [...base, ...FREE_RELAY];
}
