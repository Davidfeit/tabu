import { shekelShort } from "@/lib/format";
import { DEED_POSITIONS } from "@/engine/setup";
import { useGame } from "@/ui/GameContext";

/**
 * הבנק, כמקום על הלוח.
 *
 * כל תשלום שאינו לשחקן — מס, קנס, קנייה מהבנק, בנייה — נע לכאן, וכל
 * זיכוי מהבנק יוצא מכאן. בלי עוגן גלוי, השטרות המעופפים נעים אל ומתוך
 * נקודה שרירותית, וקשה לקרוא לאן הכסף הלך.
 */
export function BankCard() {
  const { state } = useGame();
  const owned = DEED_POSITIONS.filter((p) => state.deeds[p]!.owner !== null).length;
  const free = DEED_POSITIONS.length - owned;

  return (
    <div data-money="bank"
         className="tabu-bank flex items-center gap-3 rounded-lg px-4 py-2
                    ring-1 ring-amber-200/25">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-amber-200/85"
           fill="none" stroke="currentColor" strokeWidth="1.7"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* גג משולש על עמודים — מבנה בנק */}
        <path d="M3 12L16 4l13 8" />
        <path d="M5 12v13M11 12v13M21 12v13M27 12v13" />
        <path d="M2 25h28M2 28.5h28" />
      </svg>

      <div className="text-right leading-tight">
        <div className="font-display text-sm font-bold text-amber-100">הבנק</div>
        <div className="tabular-nums text-[0.63rem] text-amber-100/45">
          <bdi>{state.bank.houses}</bdi> בתים · <bdi>{state.bank.hotels}</bdi> מלונות
          {free > 0 && <> · <bdi>{free}</bdi> נכסים פנויים</>}
        </div>
      </div>

      <div className="mr-1 border-r border-amber-200/15 pr-3 text-right">
        <div className="text-[0.58rem] text-amber-100/40">בקופה</div>
        <div className="tabular-nums font-display text-sm font-bold text-amber-100/80">
          <bdi>{state.settings.eilatJackpot ? shekelShort(state.pot) : "∞"}</bdi>
        </div>
      </div>
    </div>
  );
}
