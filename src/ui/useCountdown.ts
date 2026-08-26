import { useEffect, useState } from "react";

/**
 * שניות שנותרו עד רגע נתון, מתעדכן פעם בשנייה.
 *
 * הדדליין סמכותי ומגיע מהשרת; הלקוח רק מרנדר ספירה מולו. אף פעם לא
 * מסתמכים על הטיימר הזה לחוק משחק — האכיפה נעשית בשרת, שבודק את השעון שלו.
 */
export function useCountdown(deadline: number | null): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
