import { useCallback, useMemo, useState } from "react";
import { reduce } from "@/engine/reduce";
import { seatOf } from "@/engine/selectors";
import type { Action, GameState } from "@/engine/types";
import { errorText } from "@/lib/messages";
import { GameCtx, type GameClient } from "./GameContext";
import { useRoomFeed } from "./useRoomFeed";

/**
 * ספק מצב מקוון למונופול.
 *
 * הסנכרון עצמו — ערוץ, גרסאות, טעינה מחדש, חיזוי — חי ב-useRoomFeed,
 * משותף עם השחמט. כאן נשאר רק מה שמונופולי: המושב שלי, המנוע לחיזוי,
 * והניסוח של השגיאות.
 */
export function RemoteGameProvider({
  roomId, userId, mySeat: claimedSeat, initialState, initialVersion, children,
}: {
  roomId: string;
  /** מי אני. זה, ולא מספר המושב, מה שמזהה אותי במצב. */
  userId: string;
  mySeat: number;
  initialState: GameState;
  initialVersion: number;
  children: React.ReactNode;
}) {
  const { state, stateRef, events, send } =
    useRoomFeed<GameState>(roomId, initialState, initialVersion);
  // המושב נלקח מהמצב לפי מזהה המשתמש, ורק בהיעדרו נופלים למה שהשרת
  // אמר בהצטרפות. שני המספורים יכולים להתפצל, ואז השחקן פועל בשם מישהו
  // אחר ורואה את הווידאו שלו במשבצת שלו — בלי שום סימן שמשהו לא בסדר.
  const mySeat = seatOf(state.players, userId) ?? claimedSeat;
  const [error, setError] = useState<string | null>(null);

  const dispatch = useCallback((action: Action, seat?: number) => {
    const actor = seat ?? mySeat;
    if (actor !== mySeat) { setError("אפשר לפעול רק בשם עצמך"); return; }

    void send(action, (prev) => {
      const r = reduce(prev, action, { seat: actor, now: Date.now(), seed: "" });
      // החיזוי לא יכול לדעת את הזרע, ולכן גלגול קוביות נשאר לשרת בלבד.
      if (!r.ok || action.type === "roll" || action.type === "claim_timeout") return null;
      return r.state;
    })
      .then(() => setError(null))
      .catch((e: Error) => {
        // המצב שממנו יצאנו הוא מה שחוסם, ולכן הוא זה שמסביר.
        setError(errorText(e.message as never, stateRef.current) || "השרת דחה את הפעולה");
      });
  }, [send, mySeat, stateRef]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<GameClient>(() => ({
    state, events, mySeat,
    canControl: (seat) => seat === mySeat,
    dispatch, error, clearError, now: Date.now(),
  }), [state, events, mySeat, dispatch, error, clearError]);

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
