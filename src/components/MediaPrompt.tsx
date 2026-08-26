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
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6
                      text-center ring-1 ring-white/15">
        <div className="text-4xl" aria-hidden="true">🎥</div>
        <h2 className="font-logo text-2xl text-parchment">רואים זה את זה תוך כדי משחק</h2>
        <p className="text-sm leading-relaxed text-parchment/65">
          הווידאו עובר <strong className="font-semibold text-parchment/90">ישירות בין
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
