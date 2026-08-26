/**
 * נקודת הכניסה היחידה למנוע.
 *
 * זהו המודול שמקובץ ל-supabase/functions/_shared/engine.js ורץ ב-Edge
 * Function. גם הדפדפן משתמש בו — לחיזוי אופטימי ולמצב מקומי. מקור אחד,
 * ולכן אי אפשר שהשרת והלקוח יחלקו על חוק.
 */
export { reduce } from "./reduce";
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
