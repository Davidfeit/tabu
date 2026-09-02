import { CHESS_ACTIONS, createChessGame, reduceChess } from "@/chess/reduce";
import type { ChessAction, ChessState } from "@/chess/types";
import { ENGINE_ACTIONS, reduce } from "./reduce";
import { createGame, type SeatSpec } from "./setup";
import type { Action, Ctx, GameState, Result, Settings } from "./types";

/**
 * שני משחקים, חדר אחד.
 *
 * השרת לא יודע שחמט וגם לא מונופול: הוא מקבל מצב ופעולה, מריץ "את
 * המנוע" ומתחייב. הקובץ הזה הוא המנוע מבחינתו — הוא מסתכל על תג
 * המשחק שבמצב ומעביר הלאה. התג חי במצב עצמו ולא בהגדרות החדר, כי המצב
 * הוא מה שעובר בין השרת ללקוח בכל מהלך, וההגדרות לא.
 */

export type AnyState = GameState | ChessState;
export type AnyAction = Action | ChessAction;
export type AnyOutcome = Result | ReturnType<typeof reduceChess>;

export function isChess(state: AnyState): state is ChessState {
  return (state as { game?: string }).game === "chess";
}

/** כל המהלכים שהמנוע המקובץ מכיר, לבדיקת שרת ישן. */
export const ALL_ACTIONS: string[] = [...ENGINE_ACTIONS, ...CHESS_ACTIONS].sort();

export function createAnyGame(
  seats: SeatSpec[], settings: Partial<Settings> & { game?: string },
  seed: string, now: number,
): AnyState {
  if (settings.game === "chess") return createChessGame(seats, now);
  return createGame(seats, settings as Settings, seed, now);
}

export function reduceAny(state: AnyState, action: AnyAction, ctx: Ctx): AnyOutcome {
  if (isChess(state)) return reduceChess(state, action as ChessAction, ctx);
  return reduce(state, action as Action, ctx);
}
