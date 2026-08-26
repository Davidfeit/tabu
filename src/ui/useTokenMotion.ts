import { useEffect, useRef, useState } from "react";
import { pathBetween } from "@/lib/geometry";
import type { GameState } from "@/engine/types";

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
 */
export function useTokenMotion(state: GameState): Map<number, TokenMotion> {
  const [motion, setMotion] = useState<Map<number, TokenMotion>>(() =>
    new Map(state.players.map((p) => [p.seat, { pos: p.pos, walking: false }])));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMotion((prev) => {
      const next = new Map(prev);
      let changed = false;

      for (const p of state.players) {
        const current = prev.get(p.seat)?.pos ?? p.pos;
        if (current === p.pos) continue;
        changed = true;

        const forward = (p.pos - current + 40) % 40;
        if (reducedMotion() || forward > MAX_WALK) {
          next.set(p.seat, { pos: p.pos, walking: false });
          continue;
        }

        const steps = pathBetween(current, p.pos).slice(1);
        next.set(p.seat, { pos: current, walking: true });
        steps.forEach((square, i) => {
          const id = setTimeout(() => {
            setMotion((m) => new Map(m).set(p.seat, {
              pos: square, walking: i < steps.length - 1,
            }));
          }, (i + 1) * STEP_MS);
          timers.current.push(id);
        });
      }
      return changed ? next : prev;
    });
  }, [state.players]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  return motion;
}
