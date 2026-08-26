import { squareAt } from "@/lib/board";
import { shekel } from "@/lib/format";
import { buildingUnits, houseCost } from "@/engine/selectors";
import { DEED_POSITIONS } from "@/engine/setup";
import { reduce } from "@/engine/reduce";
import { useGame } from "@/ui/GameContext";
import { Button } from "./Button";
import { seatColor } from "./Token";
import { BOARD } from "@/lib/board";

/**
 * ניהול נכסים. פתוח לכל שחקן בכל עת — נדרש לגיוס חירום, גם כשזה לא תורך.
 *
 * כל כפתור נבדק מול המנוע עצמו (dry run) במקום לשכפל את החוקים כאן. כפילות
 * הייתה מתפצלת מהמנוע ברגע שחוק אחד משתנה.
 */
export function ManagePanel({ seat }: { seat: number }) {
  const { state, dispatch, canControl } = useGame();
  const owned = DEED_POSITIONS.filter((p) => state.deeds[p]!.owner === seat);
  const player = state.players[seat]!;

  if (owned.length === 0) return null;

  const allows = (action: Parameters<typeof reduce>[1]) =>
    reduce(state, action, { seat, now: Date.now(), seed: "dry-run" }).ok;

  return (
    <section dir="rtl" className="space-y-2 rounded-lg bg-black/25 p-3 ring-1 ring-white/10"
             aria-label={`ניהול נכסים של ${player.name}`}>
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-sm font-bold" style={{ color: seatColor(seat) }}>
          הנכסים של {player.name}
        </h3>
        <span className="text-[0.66rem] text-parchment/40">
          בבנק <bdi>{state.bank.houses}</bdi> בתים · <bdi>{state.bank.hotels}</bdi> מלונות
        </span>
      </header>

      <div className="space-y-1">
        {owned.map((pos) => {
          const d = state.deeds[pos]!;
          const sq = squareAt(pos);
          const canBuild = sq.type === "property" && allows({ type: "build_house", pos });
          const canSell = sq.type === "property" && allows({ type: "sell_house", pos });
          const canMortgage = allows({ type: "mortgage", pos });
          const canUnmortgage = allows({ type: "unmortgage", pos });
          const units = buildingUnits(state, d);

          return (
            <div key={pos}
                 className="flex items-center gap-1.5 rounded bg-black/25 px-2 py-1">
              <span className={`min-w-0 flex-1 truncate text-[0.74rem]
                                ${d.mortgaged ? "text-parchment/35 line-through" : "text-parchment/85"}`}>
                {sq.name}
                {units > 0 && (
                  <span className="mr-1 text-[0.62rem] text-parchment/50">
                    {d.hotel ? "מלון" : `${d.houses} בתים`}
                  </span>
                )}
              </span>
              {sq.type === "property" && (
                <>
                  <Button className="!px-2 !py-0.5 !text-[0.68rem]"
                          disabled={!canControl(seat) || !canBuild}
                          title={`בנייה — ${shekel(houseCost(pos))}`}
                          onClick={() => dispatch({ type: "build_house", pos }, seat)}>
                    +
                  </Button>
                  <Button className="!px-2 !py-0.5 !text-[0.68rem]"
                          disabled={!canControl(seat) || !canSell}
                          title={`מכירה — ${shekel(houseCost(pos) / 2)}`}
                          onClick={() => dispatch({ type: "sell_house", pos }, seat)}>
                    −
                  </Button>
                </>
              )}
              {d.mortgaged ? (
                <Button className="!px-2 !py-0.5 !text-[0.68rem]"
                        disabled={!canControl(seat) || !canUnmortgage}
                        title={`פדיון — ${shekel(Math.round(
                          ("mortgage" in sq ? sq.mortgage : 0) * (1 + BOARD.meta.unmortgageInterest)))}`}
                        onClick={() => dispatch({ type: "unmortgage", pos }, seat)}>
                  פדה
                </Button>
              ) : (
                <Button className="!px-2 !py-0.5 !text-[0.68rem]"
                        disabled={!canControl(seat) || !canMortgage}
                        title={`משכון — ${shekel("mortgage" in sq ? sq.mortgage : 0)}`}
                        onClick={() => dispatch({ type: "mortgage", pos }, seat)}>
                  משכן
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
