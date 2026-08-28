import { useEffect, useRef, useState } from "react";
import { pathBetween } from "@/lib/geometry";
import type { GameState } from "@/engine/types";
import { DICE_MS } from "@/components/Dice";

const STEP_MS = 105;
/** מרחק מרבי שמונפש צעד-צעד. גלגול 2d6 לעולם לא עובר 12. */
const MAX_WALK = 12;

function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TokenMotion {
  /** המיקום שבו החייל מצויר כרגע — לא בהכרח המיקום במצב המשחק. */
  pos: number;
  walking: boolean;
}

export interface WalkPlan {
  /** "walk" = צעד-צעד לאורך המסלול, "jump" = העברה מיידית. */
  kind: "walk" | "jump";
  /** השהיה לפני שמשהו זז, במילישניות. */
  delayMs: number;
  /** המשבצות שיש לעבור בהן, בלי משבצת המוצא. ריק בקפיצה. */
  steps: number[];
}

/**
 * מה לעשות עם תזוזה בודדת — הכלל עצמו, בלי React ובלי טיימרים.
 *
 * מופרד מההוק כדי שיהיה אפשר לבדוק אותו: העיתוי הוא הדרישה, וההוק הוא רק
 * מי שמפעיל טיימרים לפיו.
 */
export function walkPlan(
  from: number, to: number, opts: { rolled: boolean; reduced: boolean },
): WalkPlan {
  if (opts.reduced) return { kind: "jump", delayMs: 0, steps: [] };
  // תזוזה שנובעת מגלגול מחכה לקוביות; תזוזה מקלף אינה מחכה לדבר.
  const delayMs = opts.rolled ? DICE_MS : 0;
  const forward = (to - from + 40) % 40;
  if (forward > MAX_WALK) return { kind: "jump", delayMs, steps: [] };
  return { kind: "walk", delayMs, steps: pathBetween(from, to).slice(1) };
}

export interface MotionState {
  bySeat: Map<number, TokenMotion>;
  /** האם משהו עדיין בתנועה — כולל ההמתנה לסיום הקוביות. */
  settling: boolean;
}

/**
 * מיקומי החיילים לצורך ציור, עם הליכה צעד-צעד.
 *
 * ── למה לא פשוט להנפיש מ-א' ל-ב' ──
 * מעבר ישיר חוצה את אמצע הלוח באלכסון. חייל צריך לעקוב אחרי המסלול, אחרת
 * אי אפשר לספור איתו ולראות על מה נחתים.
 *
 * ── למה יש תקרה למרחק ──
 * מעצר בית הוא העברה, לא הליכה: מי שנשלח מ-30 ל-10 לא עובר בזינוק, ולכן
 * גם אסור שייראה כאילו הוא עובר שם. אותו דבר לקלף "שלוש משבצות אחורה",
 * שקדימה הוא 37 צעדים. הכלל: עד 12 הולכים, מעבר לזה מקפיצים.
 *
 * ── למה יש השהיה בתחילת תזוזה שנובעת מגלגול ──
 * החייל יצא לדרך בו-זמנית עם הקוביות, וכך סיפר את התוצאה לפני שהספיקו
 * לקרוא אותה. תזוזה שמקורה בקלף אינה מחכה — שם אין קוביות להמתין להן.
 */
export function useTokenMotion(state: GameState): MotionState {
  const [bySeat, setBySeat] = useState<Map<number, TokenMotion>>(() =>
    new Map(state.players.map((p) => [p.seat, { pos: p.pos, walking: false }])));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastDice = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const diceKey = state.dice ? `${state.dice[0]}-${state.dice[1]}` : null;
    const firstRender = lastDice.current === undefined;
    const rolled = !firstRender && diceKey !== null && diceKey !== lastDice.current;
    lastDice.current = diceKey;

    setBySeat((prev) => {
      const next = new Map(prev);
      let changed = false;

      for (const p of state.players) {
        const current = prev.get(p.seat)?.pos ?? p.pos;
        if (current === p.pos) continue;
        changed = true;

        const plan = walkPlan(current, p.pos, { rolled, reduced: reducedMotion() });

        if (plan.kind === "jump") {
          // קפיצה עדיין מחכה לקוביות, אחרת ההעברה קורית תוך כדי גלגול.
          if (plan.delayMs === 0) {
            next.set(p.seat, { pos: p.pos, walking: false });
          } else {
            next.set(p.seat, { pos: current, walking: true });
            timers.current.push(setTimeout(() => {
              setBySeat((m) => new Map(m).set(p.seat, { pos: p.pos, walking: false }));
            }, plan.delayMs));
          }
          continue;
        }

        next.set(p.seat, { pos: current, walking: true });
        plan.steps.forEach((square, i) => {
          const id = setTimeout(() => {
            setBySeat((m) => new Map(m).set(p.seat, {
              pos: square, walking: i < plan.steps.length - 1,
            }));
          }, plan.delayMs + (i + 1) * STEP_MS);
          timers.current.push(id);
        });
      }
      return changed ? next : prev;
    });
  }, [state.players, state.dice]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  let settling = false;
  for (const m of bySeat.values()) if (m.walking) { settling = true; break; }
  return { bySeat, settling };
}
