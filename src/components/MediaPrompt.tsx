import { Button } from "./Button";

/**
 * פרה-פרומפט בעברית לפני הבקשה למצלמה.
 *
 * דיאלוג ההרשאות עצמו מרונדר ע"י מערכת ההפעלה בשפת המכשיר, ואי אפשר
 * לתרגם או לעצב אותו. הסבר לפני הבקשה מעלה משמעותית את שיעור האישור,
 * וחשוב לא פחות — הלחיצה כאן היא מחוות המשתמש שספארי דורש כדי לאפשר
 * הפעלה קולית אוטומטית של הווידאו הנכנס.
 */
export function MediaPrompt({ onAllow, onSkip }: {
  onAllow: () => void; onSkip: () => void;
}) {
  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="הרשאת מצלמה"
         className="toy-overlay fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="tabu-pop toy-modal w-full max-w-sm space-y-4 p-6 text-center">
        <div className="text-5xl" aria-hidden="true">🎥</div>
        <h2 className="font-logo text-2xl text-ink">רואים זה את זה תוך כדי משחק</h2>
        <p className="text-sm leading-relaxed text-ink/70">
          הווידאו עובר <strong className="font-semibold text-ink">ישירות בין
          המחשבים</strong> של המשתתפים ולא דרך שרת שלנו.
          הדפדפן יבקש עכשיו הרשאה — ההודעה שלו מופיעה בשפת המכשיר.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="primary" autoFocus onClick={onAllow}>
            הפעלת מצלמה ומיקרופון
          </Button>
          <Button onClick={onSkip}>המשך בלי וידאו</Button>
        </div>
      </div>
    </div>
  );
}
