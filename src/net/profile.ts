/**
 * מי אני, לפעם הבאה.
 *
 * השם והחייל נשמרים אחרי הצטרפות אחת, וגם קוד החדר האחרון. בלי זה כל
 * רענון — וכל לחיצה חוזרת על קישור ההזמנה — החזיר מסך טופס: להקליד שם,
 * לבחור חייל, ורק אז לחזור למשחק שרץ. במשחק משפחתי זה קורה הרבה.
 *
 * localStorage ולא cookie: זה נשאר במכשיר, ואף פעם לא נשלח לשרת.
 */
const KEY = "tabu:me";

export interface Profile {
  name: string;
  token: string;
  /** החדר האחרון שהיינו בו, כדי שרענון בלי hash עדיין ידע לאן לחזור. */
  code?: string;
  /** מתי נשמר החדר. חדר של אתמול אינו "המשחק שלי עכשיו". */
  at?: number;
}

/** מעבר לזה, חדר שמור הוא זיכרון ולא כוונה. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/** האם הקוד השמור עדיין מתאר משחק שרץ עכשיו. */
export function freshRoom(p: Profile | null, now = Date.now()): string | null {
  if (!p?.code || !p.at) return null;
  return now - p.at < ROOM_TTL_MS ? p.code : null;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (typeof p.name !== "string" || !p.name.trim()) return null;
    return {
      name: p.name, token: typeof p.token === "string" ? p.token : "camel",
      code: typeof p.code === "string" ? p.code : undefined,
      at: typeof p.at === "number" ? p.at : undefined,
    };
  } catch { return null; }
}

export function saveProfile(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* פרטי */ }
}

/** מעדכן רק את קוד החדר, בלי לגעת בשם. */
export function rememberRoom(code: string): void {
  const p = loadProfile();
  if (p) saveProfile({ ...p, code, at: Date.now() });
}

/**
 * שוכח את החדר, ולא את השם.
 *
 * מי שיצא מהמשחק בכוונה לא אמור להיגרר אליו חזרה ברענון הבא — אבל גם
 * לא להקליד את שמו מחדש.
 */
export function forgetRoom(): void {
  const p = loadProfile();
  if (p) saveProfile({ name: p.name, token: p.token });
}
