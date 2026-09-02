import { useEffect, useRef } from "react";

/**
 * הודעת שגיאה שנעלמת מעצמה.
 *
 * למה זה לא עבד פעם: פונקציית הניקוי נוצרה מחדש בכל רינדור, והאפקט היה
 * תלוי בה. ספירת השניות של התור גרמה לרינדור פעמיים בשנייה, כלומר
 * הטיימר של ההיעלמות אופס שוב ושוב ולא הגיע לסופו לעולם. עכשיו האפקט
 * תלוי בטקסט בלבד, והפונקציה נקראת דרך ref.
 */
export function Toast({ error, onClear }: { error: string | null; onClear: () => void }) {
  const clear = useRef(onClear);
  clear.current = onClear;

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => clear.current(), 3200);
    return () => clearTimeout(id);
  }, [error]);

  if (!error) return null;
  return (
    <div dir="rtl" role="status" aria-live="assertive"
         className="tabu-pop fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-full
                    border-[3px] border-white bg-[#ef4b4b] px-5 py-2 text-sm font-bold
                    text-white shadow-[0_5px_0_#b32626,0_16px_26px_-12px_rgba(140,20,20,0.7)]">
      {error}
    </div>
  );
}
