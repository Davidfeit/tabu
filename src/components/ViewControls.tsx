import { useFullscreen } from "@/ui/useFullscreen";

const BTN = `flex h-8 w-8 items-center justify-center rounded-md bg-black/45
             text-parchment/70 ring-1 ring-white/10 backdrop-blur
             transition-colors hover:bg-black/70 hover:text-parchment
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400`;

/** בקרות תצוגה. צפות בפינה כדי לא לגזול מקום מהלוח. */
export function ViewControls({ bare, onToggleBare }: {
  bare: boolean; onToggleBare: () => void;
}) {
  const [full, toggleFull, supported] = useFullscreen();

  return (
    <div className="absolute bottom-2 left-2 z-40 flex gap-1.5" dir="ltr">
      <button onClick={onToggleBare} className={BTN}
              title={bare ? "הצגת הפאנלים" : "הסתרת הפאנלים — לוח גדול יותר"}
              aria-label={bare ? "הצגת הפאנלים" : "הסתרת הפאנלים"}
              aria-pressed={bare}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {bare
            ? <><path d="M4 5v14M20 5v14" /><path d="M9 12h6M12 9l-3 3 3 3" /></>
            : <><path d="M4 5v14M20 5v14" /><path d="M9 9l3 3-3 3M15 9l-3 3 3 3" /></>}
        </svg>
      </button>

      {supported && (
        <button onClick={toggleFull} className={BTN}
                title={full ? "יציאה ממסך מלא" : "מסך מלא — הלוח גדל בכ-8%"}
                aria-label={full ? "יציאה ממסך מלא" : "מסך מלא"}
                aria-pressed={full}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full
              ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      )}
    </div>
  );
}
