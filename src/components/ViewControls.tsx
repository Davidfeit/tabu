import { useFullscreen } from "@/ui/useFullscreen";
import { toggleDiag, useDiag } from "@/ui/useDiag";

const BTN = `toy-btn !h-9 !w-9 !p-0
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-toy-sun`;

/** בקרות תצוגה. צפות בפינה כדי לא לגזול מקום מהלוח. */
export function ViewControls({ bare = false, onToggleBare }: {
  bare?: boolean;
  /** בלי זה אין כפתור הסתרה — בשחמט אין פאנלים להסתיר. */
  onToggleBare?: () => void;
}) {
  const [full, toggleFull, supported] = useFullscreen();
  const diag = useDiag();

  return (
    <div className="absolute bottom-2 left-2 z-40 flex items-center gap-1.5" dir="ltr">
      {/* מזהה הבנייה. קטן ודהוי, אבל עונה בוודאות על "האם הגרסה החדשה
          באוויר" — שאלה שאי אפשר היה לענות עליה בלי לנחש. */}
      <span className="select-all font-mono text-[0.6rem] text-ink/35"
            title="מזהה הבנייה שמוגשת כרגע">
        {__BUILD_ID__}
      </span>
      {onToggleBare && (
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
      )}

      {/* אבחון וידאו — כבוי כברירת מחדל, ונדלק רק כשמחפשים תקלה. */}
      <button onClick={toggleDiag} className={BTN} aria-pressed={diag}
              title={diag ? "כיבוי אבחון הווידאו" : "אבחון הווידאו — למה אין תמונה"}
              aria-label="אבחון הווידאו">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.6v.6" />
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
