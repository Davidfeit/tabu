import { useSyncExternalStore } from "react";

/**
 * האם להציג את שורות האבחון של הווידאו.
 *
 * כבוי כברירת מחדל, בכוונה. האבחון נכתב כדי לפתור תקלה, ומרגע שהוא
 * מופיע מעצמו הוא נקרא כהודעת שגיאה קבועה — גם כשאין שגיאה, וגם כשאין
 * מה לעשות עם מה שכתוב בו. מי שמדבג מדליק אותו; שחקן לא אמור לראות אותו
 * לעולם.
 *
 * חנות זעירה ברמת המודול ולא context: המתג נקרא בשני מקומות רחוקים
 * (המשבצות ובקרות התצוגה), ו-context היה מוסיף ספק שכל תפקידו בוליאני.
 */
const KEY = "tabu:diag";

function initial(): boolean {
  if (typeof location !== "undefined"
      && new URLSearchParams(location.search).get("diag") === "1") return true;
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

let on = initial();
const listeners = new Set<() => void>();

export function toggleDiag(): void {
  on = !on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* פרטי, לא קריטי */ }
  for (const l of listeners) l();
}

export function useDiag(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => on,
    () => false,
  );
}
