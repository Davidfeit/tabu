/**
 * שחמט — הטיפוסים.
 *
 * אותה תבנית כמו טאבו: מצב אחד שלם ב-JSON, פעולות מכונתיות, רדוקר טהור.
 * השדות players / phase / currentSeat / turnDeadline / seq קיימים כאן
 * בכוונה באותם שמות כמו במונופול — השרת (commit_move, commitAction) קורא
 * אותם בלי לדעת איזה משחק זה, וזה מה שמאפשר לשני המשחקים לחלוק חדר,
 * מושבים, יומן ווידאו בלי שכבת תרגום.
 */

export type ChessColor = "w" | "b";

export interface ChessPlayer {
  seat: number;
  userId: string;
  name: string;
  token: string;
  color: ChessColor;
}

/** איך המשחק נגמר. הניסוח העברי ב-messages, לא כאן. */
export type ChessEnding =
  | "checkmate" | "resign"
  | "stalemate" | "draw_agreed" | "repetition" | "fifty_moves" | "insufficient";

export interface ChessState {
  game: "chess";
  settings: { game: "chess" };
  players: ChessPlayer[];
  phase: "playing" | "finished";
  /** מי בתור. מושב 0 לבן, 1 שחור. */
  currentSeat: number;
  /** אין שעון בשחמט הזה — משחק משפחתי נגמר כשנמאס, לא כשהזמן נגמר. */
  turnDeadline: null;
  /** מונה אירועים, כמו במונופול. */
  seq: number;
  /** העמדה הנוכחית. הסמכות; המהלכים משוחזרים ממנה ומ-moves. */
  fen: string;
  /** המהלכים ב-SAN, מהתחלה. נחוץ לחזרה משולשת ולתצוגת הרשימה. */
  moves: string[];
  lastMove: { from: string; to: string } | null;
  /** המלך של מי שבתור מאוים. */
  check: boolean;
  /** מושב שהציע תיקו וממתין לתשובה. */
  drawOffer: number | null;
  winnerSeat: number | null;
  ending: ChessEnding | null;
  startedAt: number;
  finishedAt: number | null;
}

export type Promotion = "q" | "r" | "b" | "n";

export type ChessAction =
  | { type: "chess_move"; from: string; to: string; promotion?: Promotion }
  | { type: "chess_resign" }
  | { type: "chess_offer_draw" }
  | { type: "chess_accept_draw" }
  | { type: "chess_decline_draw" };

export type ChessActionType = ChessAction["type"];

export type ChessErrorCode =
  | "NOT_YOUR_TURN" | "GAME_OVER" | "ILLEGAL_MOVE"
  | "NO_DRAW_OFFER" | "DRAW_PENDING" | "NOT_A_PLAYER" | "UNKNOWN_ACTION";
