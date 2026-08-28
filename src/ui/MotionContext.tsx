import { createContext, useContext } from "react";
import { useTokenMotion, type MotionState } from "./useTokenMotion";
import type { GameState } from "@/engine/types";

/**
 * מצב התנועה, משותף לכל מי שצריך לחכות לו.
 *
 * שני צרכנים: שכבת החיילים מציירת לפיו, והכרטיס נמנע מלהופיע כל עוד הוא
 * פעיל. קריאה כפולה ל-useTokenMotion הייתה יוצרת שתי הנפשות עצמאיות עם
 * טיימרים נפרדים, ולכן זה חייב להיות מקור אחד.
 */
const Ctx = createContext<MotionState>({ bySeat: new Map(), settling: false });

export function MotionProvider({ state, children }: {
  state: GameState; children: React.ReactNode;
}) {
  const motion = useTokenMotion(state);
  return <Ctx.Provider value={motion}>{children}</Ctx.Provider>;
}

export function useMotion(): MotionState {
  return useContext(Ctx);
}
