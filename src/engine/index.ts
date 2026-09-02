/**
 * נקודת הכניסה היחידה למנוע.
 *
 * זהו המודול שמקובץ ל-supabase/functions/_shared/engine.js ורץ ב-Edge
 * Function. גם הדפדפן משתמש בו — לחיזוי אופטימי ולמצב מקומי. מקור אחד,
 * ולכן אי אפשר שהשרת והלקוח יחלקו על חוק.
 */
export { reduce, ENGINE_ACTIONS } from "./reduce";
export {
  CHESS_ACTIONS, createChessGame, reduceChess, position, targets, isPromotion, captured,
} from "@/chess/reduce";
export type { ChessAction, ChessState, ChessPlayer, ChessEnding } from "@/chess/types";
export { createAnyGame, reduceAny, ALL_ACTIONS, isChess } from "./any";
export type { AnyState, AnyAction, AnyOutcome } from "./any";
export { createGame, defaultSettings, passStartBonus, DEED_POSITIONS } from "./setup";
export type { SeatSpec } from "./setup";
export {
  netWorth, liquidValue, rentFor, houseCost, buildingUnits, activePlayers, player,
} from "./selectors";
export { rollDice, shuffle } from "./rng";
export { AUCTION_OPENING, AUCTION_INCREMENT } from "./auction";
export type {
  Action, ActionType, Ctx, DeedState, ErrorCode, GameEvent, GameState, Phase,
  Player, Result, Settings, TradeOffer,
} from "./types";
