import { useGame } from "@/ui/GameContext";
import { Actions, TurnBar } from "./Actions";
import { LocalVideo } from "./VideoPanel";
import { Dice } from "./Dice";

/**
 * מרכז הלוח — הריבוע הפנימי 9×9.
 *
 * כאן יושבים הווידאו, הקוביות והפעולות. הן *לא* מתחת ללוח בכוונה: סרגל
 * תחתון גוזל גובה מהלוח, ובמסך רגיל זה בדיוק המימד שחסר. כאן זה שטח
 * שממילא פנוי, וזה גם המקום שהעין נמצאת בו.
 */
export function CenterPanel({ videoTiles }: {
  videoTiles?: React.ReactNode;
}) {
  const { state } = useGame();
  return (
    // הריפוד מפנה את טבעת הלבד שבה יושבים החיילים (ראה geometry.INWARD_PCT).
    // בלעדיו החייל היה נוחת על פני מישהו.
    <div dir="rtl"
         className="relative h-full w-full rounded-md bg-felt-dark/45 p-[6.5%]
                    text-center ring-1 ring-white/10">
      <div className="h-full w-full">
        {videoTiles ?? <LocalVideo />}
      </div>

      {/* הפקדים יושבים על התפר בין ארבעת החלונות, על חשבונם — שם העין
          ממילא נמצאת, ושם הם לא גוזלים גובה מהלוח. */}
      <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2
                      flex-col items-center gap-1.5 rounded-xl bg-neutral-950/85 px-3 py-2
                      shadow-xl ring-1 ring-white/15 backdrop-blur-sm">
        <Dice dice={state.dice} size={40} />
        <TurnBar />
        <Actions />
      </div>
    </div>
  );
}
