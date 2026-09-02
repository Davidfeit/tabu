import type { GameEvent } from "@/engine/types";
import type { ChessEnding, ChessErrorCode } from "./types";

/** הניסוח העברי של השחמט. אותו עיקרון כמו lib/messages: קודים במנוע, מילים כאן. */

const ERRORS: Record<ChessErrorCode, string> = {
  NOT_YOUR_TURN: "לא תורך",
  GAME_OVER: "המשחק נגמר",
  ILLEGAL_MOVE: "המהלך הזה לא חוקי",
  NO_DRAW_OFFER: "אין הצעת תיקו לענות עליה",
  DRAW_PENDING: "כבר הצעת תיקו — ממתינים לתשובה",
  NOT_A_PLAYER: "את/ה לא משחק/ת בלוח הזה",
  UNKNOWN_ACTION: "פעולה לא מוכרת",
};

export function chessErrorText(code: string): string {
  return ERRORS[code as ChessErrorCode] ?? "השרת דחה את הפעולה";
}

export const ENDINGS: Record<ChessEnding, string> = {
  checkmate: "מט",
  resign: "כניעה",
  stalemate: "פט — תיקו",
  draw_agreed: "תיקו בהסכמה",
  repetition: "תיקו — חזרה משולשת",
  fifty_moves: "תיקו — חמישים מהלכים",
  insufficient: "תיקו — אין מספיק כלים למט",
};

const PIECES: Record<string, string> = {
  p: "רגלי", n: "פרש", b: "רץ", r: "צריח", q: "מלכה", k: "מלך",
};

export function chessEventText(e: GameEvent, name: (seat: number) => string): string {
  const who = e.seat === null ? "" : name(e.seat);
  const p = e.payload;
  switch (e.type) {
    case "chess_move": {
      const piece = PIECES[String(p.piece)] ?? "";
      const cap = p.captured ? ` ×${PIECES[String(p.captured)] ?? ""}` : "";
      return `${who} — ${piece} ${p.from}→${p.to}${cap}${p.check ? " שח" : ""}`;
    }
    case "chess_resigned": return `${who} — כניעה`;
    case "chess_draw_offered": return `${who} — הצעת תיקו`;
    case "chess_draw_accepted": return `${who} — קיבל/ה תיקו`;
    case "chess_draw_declined": return `${who} — דחה/תה תיקו`;
    case "chess_over": {
      const ending = ENDINGS[p.ending as ChessEnding] ?? "";
      return who ? `${ending} — ניצחון ל${who}` : ending;
    }
    default: return e.type;
  }
}
