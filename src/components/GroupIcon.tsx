import type { IconKey } from "@/lib/types";

/**
 * אייקון לכל קבוצת צבע.
 *
 * קבוצות הצבע חייבות להיות ניתנות להבחנה בלי צבע: כ-8% מהגברים עם עיוורון
 * צבעים, ו-crimson מול copper הן צמד סיכון אדום-ירוק מובהק.
 */
const PATHS: Record<IconKey, string> = {
  dune: "M1 11c2.5 0 3-5 5.5-5S9.5 11 12 11 14.5 5 17 5s3 6 6 6",          // חולות
  wave: "M1 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M1 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0", // גל
  peak: "M1 18l6-11 4 6 3-4 5 9z",                                          // פסגה
  copper: "M12 3l7 4v8l-7 4-7-4V7z",                                        // גוש מתכת
  anemone: "M12 4v14M5 8l14 6M19 8L5 14",                                   // כלנית
  olive: "M12 4c4 3 4 10 0 14-4-4-4-11 0-14zM12 11h7",                      // ענף זית
  cypress: "M12 3l4 7h-3l3 6h-8l3-6H8zM12 16v5",                            // ברוש
  anchor: "M12 6v13M6 13a6 6 0 0012 0M8 8h8",                               // עוגן
};

export function GroupIcon({ icon, className }: { icon: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[icon]} />
    </svg>
  );
}

/** אייקוני סוגי משבצות שאינן נכסים. */
export function SquareIcon({ kind, className }: { kind: string; className?: string }) {
  const d: Record<string, string> = {
    transport: "M6 4h12v10H6zM6 14l-2 5M18 14l2 5M9 8h6M8 19h8",   // קרון
    utility: "M13 2L4 14h6l-1 8 9-12h-6z",                          // ברק
    tax: "M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 11h.01M15 11h.01",       // מבנה ציבור
    card: "M4 6h16v12H4zM4 10h16M8 14h8",                           // קלף
    start: "M5 20V4M5 4h11l-2 3 2 3H5",                             // דגל זינוק
    jail: "M4 4h16v16H4zM9 4v16M15 4v16",                           // סורגים
    rest: "M4 18h16M6 18V9l6-4 6 4v9M9 18v-5h6v5",                  // סוכה
    goto_jail: "M13 4l7 8-7 8M20 12H4",                             // חץ
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d[kind] ?? d.card!} />
    </svg>
  );
}

/** חץ כיוון התור. תמיד SVG מסובב — לעולם לא תו טקסט (ראה geometry.ts). */
export function TravelArrow({ rotation, className }: { rotation: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={{ transform: `rotate(${rotation}deg)` }}
         fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}
