import { useEffect, useState } from "react";

/**
 * האם זה טלפון — כלומר מסך צר עם מגע.
 *
 * שני התנאים יחד, בכוונה. רוחב לבדו תופס גם חלון דפדפן מוקטן בדסקטופ,
 * שבו הלוח דווקא רצוי; מגע לבדו תופס מסכי מגע גדולים. השילוב מתאר את
 * המקרה שבשבילו זה נבנה: מישהו שיושב מול המסך המשותף ומחזיק טלפון.
 */
/**
 * שלוש שאילתות נפרדות ולא אחת מורכבת.
 *
 * `(A) and ((B) or (C))` הוא תחביר Media Queries 4, ודפדפן שלא מכיר אותו
 * לא נכשל אלא פשוט לעולם לא מתאים — כלומר כשל שקט. שלוש שאילתות פשוטות
 * שמצטרפות ב-JS נתמכות בכל מקום.
 */
const QUERIES = {
  narrow: "(max-width: 820px)",
  coarse: "(any-pointer: coarse)",
  noHover: "(hover: none)",
} as const;

function detect(): boolean {
  if (typeof matchMedia === "undefined") return false;
  // רוחב *וגם* מגע: רוחב לבדו תופס חלון מוקטן בדסקטופ, שבו הלוח דווקא
  // רצוי; מגע לבדו תופס מסכי מגע גדולים.
  return matchMedia(QUERIES.narrow).matches
    && (matchMedia(QUERIES.coarse).matches || matchMedia(QUERIES.noHover).matches);
}

/** דריסה ידנית: ?controller=1 מכריח שלט, ?controller=0 מכריח לוח. */
function override(): boolean | null {
  if (typeof location === "undefined") return null;
  const v = new URLSearchParams(location.search).get("controller");
  return v === null ? null : v !== "0";
}

export function useIsPhone(): boolean {
  const forced = override();
  const [phone, setPhone] = useState(() => forced ?? detect());

  useEffect(() => {
    if (forced !== null || typeof matchMedia === "undefined") return;
    const mqs = Object.values(QUERIES).map((q) => matchMedia(q));
    const onChange = () => setPhone(detect());
    for (const mq of mqs) mq.addEventListener("change", onChange);
    return () => { for (const mq of mqs) mq.removeEventListener("change", onChange); };
  }, [forced]);

  return forced ?? phone;
}
