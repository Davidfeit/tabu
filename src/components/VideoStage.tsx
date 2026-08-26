import { BOARD } from "@/lib/board";
import { TravelArrow } from "./GroupIcon";
import { travelArrowRotation } from "@/lib/geometry";

/**
 * מרכז הלוח — כאן ישבו משבצות הווידאו.
 *
 * שלב 1: שלד בלבד. הריבוע הזה הוא הסיבה שה-mesh הישיר עובד: כל המשבצות קטנות
 * ובאותו גודל, ולכן אין צורך ב-simulcast — מה שבדרך כלל הורג mesh.
 */
export function VideoStage() {
  return (
    <div dir="rtl" className="flex h-full w-full flex-col items-center justify-center gap-4
                              rounded-md bg-felt-dark/60 p-6 text-center ring-1 ring-white/10">
      <div className="font-logo text-5xl tracking-tight text-parchment drop-shadow">
        {BOARD.meta.name}
      </div>
      <div className="text-sm font-medium text-parchment/70">משחק הנדל״ן הישראלי</div>

      <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}
               className="flex aspect-[4/3] w-[5.5rem] items-center justify-center rounded
                          border border-dashed border-parchment/25 bg-black/20
                          text-[0.6rem] text-parchment/40">
            שחקן {i + 1}
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-2 text-[0.65rem] text-parchment/45">
        <span>כיוון המשחק</span>
        {/* חץ SVG מסובב לפי גיאומטריית הלוח, לעולם לא תו טקסט */}
        <TravelArrow rotation={travelArrowRotation("bottom")} className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
