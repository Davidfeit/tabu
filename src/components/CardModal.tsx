import { BOARD } from "@/lib/board";
import { useGame } from "@/ui/GameContext";
import { Button } from "./Button";

const DECK_STYLE = {
  kupat_gemel: { bg: "#1F4E9C", label: "קופת גמל" },
  yad_hagoral: { bg: "#D0342C", label: "יד הגורל" },
} as const;

/** הקלף מוצג ומחכה לאישור, כדי שהשחקן יספיק לקרוא אותו לפני שהאפקט מוחל. */
export function CardModal() {
  const { state, dispatch, canControl } = useGame();
  const drawn = state.drawnCard;
  if (!drawn) return null;

  const def = (BOARD.decks[drawn.deck] as { id: string; text: string }[])
    .find((c) => c.id === drawn.id);
  const style = DECK_STYLE[drawn.deck];

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label={style.label}
         className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="tabu-pop w-full max-w-sm overflow-hidden rounded-xl bg-parchment shadow-2xl">
        <div className="px-4 py-2.5 text-center font-logo text-lg text-white"
             style={{ backgroundColor: style.bg }}>
          {style.label}
        </div>
        <p className="px-5 py-6 text-center font-display text-base leading-relaxed
                      text-neutral-900">
          {def?.text}
        </p>
        <div className="px-5 pb-5 text-center">
          <Button variant="primary" autoFocus
                  disabled={!canControl(state.currentSeat)}
                  onClick={() => dispatch({ type: "acknowledge_card" }, state.currentSeat)}>
            הבנתי
          </Button>
        </div>
      </div>
    </div>
  );
}
