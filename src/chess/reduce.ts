import { Chess, type Square } from "chess.js";
import type { Ctx, GameEvent } from "@/engine/types";
import type {
  ChessAction, ChessActionType, ChessColor, ChessEnding, ChessErrorCode, ChessState,
} from "./types";

/**
 * שחמט — הרדוקר.
 *
 * ── למה chess.js ולא חוקים משלנו ──
 * חוקי שחמט קלים לכתוב ומאוד קלים לכתוב לא נכון: הכאה דרך הילוכה, הצרחה
 * דרך שח, קידום, חזרה משולשת, חוק חמישים המהלכים. כל אחד מהם הוא באג
 * שמתגלה באמצע משחק אמיתי, בדיוק כשמישהו בטוח שניצח. הספרייה עברה את
 * הבדיקות האלה כבר; אנחנו עוטפים אותה במה שהיא לא יודעת — מושבים,
 * תורות, כניעה, הצעת תיקו, ואירועים ליומן.
 *
 * ── למה משחזרים מהמהלכים ולא רק מ-FEN ──
 * FEN מתאר עמדה, לא היסטוריה, ולכן ממנו לבדו אי אפשר לדעת אם עמדה חזרה
 * בפעם השלישית. רשימת המהלכים קצרה (משחק ארוך הוא כמה מאות), והשחזור
 * לוקח מילישניות. ה-FEN נשמר בכל זאת כדי שהתצוגה לא תצטרך לשחזר.
 */

export type ChessOutcome =
  | { ok: true; state: ChessState; events: GameEvent[] }
  | { ok: false; error: ChessErrorCode };

const err = (error: ChessErrorCode): ChessOutcome => ({ ok: false, error });

/** ראה ENGINE_ACTIONS במונופול — אותה שמירה, אותה סיבה. */
const KNOWN: Record<ChessActionType, true> = {
  chess_move: true, chess_resign: true,
  chess_offer_draw: true, chess_accept_draw: true, chess_decline_draw: true,
};
export const CHESS_ACTIONS: string[] = Object.keys(KNOWN).sort();

export interface ChessSeat { userId: string; name: string; token: string }

/** משחק חדש. הראשון לבן — מי שפתח את החדר מתחיל, כמו במונופול. */
export function createChessGame(seats: ChessSeat[], now: number): ChessState {
  if (seats.length !== 2) throw new Error("chess needs exactly two players");
  const colors: ChessColor[] = ["w", "b"];
  return {
    game: "chess",
    settings: { game: "chess" },
    players: seats.map((s, i) => ({
      seat: i, userId: s.userId, name: s.name, token: s.token, color: colors[i]!,
    })),
    phase: "playing",
    currentSeat: 0,
    turnDeadline: null,
    seq: 0,
    fen: new Chess().fen(),
    moves: [],
    lastMove: null,
    check: false,
    drawOffer: null,
    winnerSeat: null,
    ending: null,
    startedAt: now,
    finishedAt: null,
  };
}

/** העמדה החיה, משוחזרת מרשימת המהלכים. */
export function position(state: Pick<ChessState, "moves">): Chess {
  const c = new Chess();
  for (const san of state.moves) c.move(san);
  return c;
}

/** לאן החייל במשבצת הזו יכול ללכת. ריק כשאין חייל, או כשהוא לא בתור. */
export function targets(state: Pick<ChessState, "fen">, from: string): string[] {
  const c = new Chess(state.fen);
  return c.moves({ square: from as Square, verbose: true }).map((m) => m.to);
}

/** האם המהלך הזה הוא קידום רגלי — ואז צריך לשאול למה. */
export function isPromotion(state: Pick<ChessState, "fen">, from: string, to: string): boolean {
  const c = new Chess(state.fen);
  return c.moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && m.promotion !== undefined);
}

export function colorOf(state: ChessState, seat: number): ChessColor | null {
  return state.players.find((p) => p.seat === seat)?.color ?? null;
}

function emit(
  s: ChessState, events: GameEvent[], type: string, seat: number | null,
  payload: Record<string, unknown> = {},
): void {
  events.push({ seq: ++s.seq, type, seat, payload });
}

function finish(
  s: ChessState, events: GameEvent[], now: number,
  ending: ChessEnding, winnerSeat: number | null,
): void {
  s.phase = "finished";
  s.ending = ending;
  s.winnerSeat = winnerSeat;
  s.finishedAt = now;
  s.drawOffer = null;
  emit(s, events, "chess_over", winnerSeat, { ending });
}

/** סיום שנובע מהעמדה עצמה, אם יש כזה. */
function settled(c: Chess): { ending: ChessEnding; decisive: boolean } | null {
  if (c.isCheckmate()) return { ending: "checkmate", decisive: true };
  if (c.isStalemate()) return { ending: "stalemate", decisive: false };
  if (c.isInsufficientMaterial()) return { ending: "insufficient", decisive: false };
  if (c.isThreefoldRepetition()) return { ending: "repetition", decisive: false };
  if (c.isDrawByFiftyMoves()) return { ending: "fifty_moves", decisive: false };
  return null;
}

/**
 * הפונקציה היחידה שמשנה מצב שחמט. טהורה, כמו במונופול.
 *
 * מי שמבצע נקבע לפי ctx.seat — השרת גוזר אותו ממזהה המשתמש, בדיוק
 * כמו במונופול, ולכן שחקן לא יכול להזיז את הכלים של היריב.
 */
export function reduceChess(state: ChessState, action: ChessAction, ctx: Ctx): ChessOutcome {
  const s: ChessState = structuredClone(state);
  const events: GameEvent[] = [];
  const { seat, now } = ctx;

  if (s.phase === "finished") return err("GAME_OVER");
  const me = colorOf(s, seat);
  if (me === null) return err("NOT_A_PLAYER");
  const other = s.players.find((p) => p.seat !== seat)!.seat;

  switch (action.type) {
    case "chess_move": {
      if (s.currentSeat !== seat) return err("NOT_YOUR_TURN");
      const c = position(s);
      let mv;
      try {
        mv = c.move({ from: action.from, to: action.to, promotion: action.promotion });
      } catch {
        return err("ILLEGAL_MOVE");
      }
      s.moves.push(mv.san);
      s.fen = c.fen();
      s.lastMove = { from: mv.from, to: mv.to };
      s.check = c.isCheck();
      // הצעת תיקו של היריב פוקעת ברגע שהמשחק ממשיך. שלי נשארת — הוא עוד
      // לא ענה.
      if (s.drawOffer === other) s.drawOffer = null;
      emit(s, events, "chess_move", seat, {
        san: mv.san, from: mv.from, to: mv.to, piece: mv.piece,
        captured: mv.captured ?? null, check: s.check,
      });
      const end = settled(c);
      if (end) {
        finish(s, events, now, end.ending, end.decisive ? seat : null);
      } else {
        s.currentSeat = other;
      }
      break;
    }

    case "chess_resign": {
      emit(s, events, "chess_resigned", seat);
      finish(s, events, now, "resign", other);
      break;
    }

    case "chess_offer_draw": {
      if (s.drawOffer === seat) return err("DRAW_PENDING");
      // אם היריב כבר הציע, ההצעה שלי היא הסכמה.
      if (s.drawOffer === other) {
        emit(s, events, "chess_draw_accepted", seat);
        finish(s, events, now, "draw_agreed", null);
        break;
      }
      s.drawOffer = seat;
      emit(s, events, "chess_draw_offered", seat);
      break;
    }

    case "chess_accept_draw": {
      if (s.drawOffer !== other) return err("NO_DRAW_OFFER");
      emit(s, events, "chess_draw_accepted", seat);
      finish(s, events, now, "draw_agreed", null);
      break;
    }

    case "chess_decline_draw": {
      if (s.drawOffer !== other) return err("NO_DRAW_OFFER");
      s.drawOffer = null;
      emit(s, events, "chess_draw_declined", seat);
      break;
    }

    default:
      return err("UNKNOWN_ACTION");
  }

  return { ok: true, state: s, events };
}

// ── תצוגה ────────────────────────────────────────────────────────────────

/** מה הוכה מכל צד, לפי מה שחסר על הלוח ביחס לפתיחה. */
export function captured(state: Pick<ChessState, "fen">): Record<ChessColor, string[]> {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const left: Record<ChessColor, Record<string, number>> = {
    w: { ...start }, b: { ...start },
  };
  for (const row of new Chess(state.fen).board()) {
    for (const sq of row) {
      if (sq && sq.type !== "k") left[sq.color][sq.type]!--;
    }
  }
  const out: Record<ChessColor, string[]> = { w: [], b: [] };
  for (const color of ["w", "b"] as const) {
    for (const [type, n] of Object.entries(left[color])) {
      for (let i = 0; i < n; i++) out[color].push(type);
    }
  }
  return out;
}
