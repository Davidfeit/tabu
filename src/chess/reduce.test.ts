import { describe, it, expect } from "vitest";
import {
  CHESS_ACTIONS, captured, createChessGame, isPromotion, reduceChess, targets,
} from "./reduce";
import type { ChessAction, ChessState } from "./types";

const NOW = 1_700_000_000_000;
const seats = [
  { userId: "u-white", name: "דנה", token: "camel" },
  { userId: "u-black", name: "יואב", token: "scooter" },
];

function fresh(): ChessState { return createChessGame(seats, NOW); }

/** מריץ רצף מהלכים מתחלפים, ומחזיר את המצב האחרון. */
function play(state: ChessState, moves: [string, string, string?][]): ChessState {
  let s = state;
  for (const [from, to, promotion] of moves) {
    const action: ChessAction = { type: "chess_move", from, to,
      ...(promotion ? { promotion: promotion as "q" } : {}) };
    const r = reduceChess(s, action, { seat: s.currentSeat, now: NOW, seed: "" });
    if (!r.ok) throw new Error(`${from}${to}: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe("שחמט — פתיחה", () => {
  it("הלבן במושב 0 מתחיל, והלוח בעמדת הפתיחה", () => {
    const s = fresh();
    expect(s.players[0]!.color).toBe("w");
    expect(s.players[1]!.color).toBe("b");
    expect(s.currentSeat).toBe(0);
    expect(s.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(s.turnDeadline).toBeNull();
  });

  it("דורש בדיוק שני שחקנים", () => {
    expect(() => createChessGame(seats.slice(0, 1), NOW)).toThrow();
  });

  it("רשימת הפעולות מכסה את כל מה שהרדוקר מכיר", () => {
    expect(CHESS_ACTIONS).toEqual([
      "chess_accept_draw", "chess_decline_draw", "chess_move", "chess_offer_draw", "chess_resign",
    ]);
  });
});

describe("שחמט — מהלכים", () => {
  it("מהלך חוקי מעביר את התור ומעדכן את העמדה", () => {
    const s = play(fresh(), [["e2", "e4"]]);
    expect(s.currentSeat).toBe(1);
    expect(s.moves).toEqual(["e4"]);
    expect(s.lastMove).toEqual({ from: "e2", to: "e4" });
    expect(s.fen).toContain(" b ");
  });

  it("השחור לא יכול לזוז ראשון", () => {
    const r = reduceChess(fresh(), { type: "chess_move", from: "e7", to: "e5" },
                          { seat: 1, now: NOW, seed: "" });
    expect(r).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
  });

  it("מהלך לא חוקי נדחה בלי לשנות כלום", () => {
    const s = fresh();
    const r = reduceChess(s, { type: "chess_move", from: "e2", to: "e5" },
                          { seat: 0, now: NOW, seed: "" });
    expect(r).toEqual({ ok: false, error: "ILLEGAL_MOVE" });
    expect(s.moves).toEqual([]);
  });

  it("מי שאינו שחקן לא יכול לפעול", () => {
    const r = reduceChess(fresh(), { type: "chess_move", from: "e2", to: "e4" },
                          { seat: 7, now: NOW, seed: "" });
    expect(r).toEqual({ ok: false, error: "NOT_A_PLAYER" });
  });

  it("אירוע המהלך מדווח על הכאה ועל שח", () => {
    const s = play(fresh(), [["e2", "e4"], ["d7", "d5"]]);
    const r = reduceChess(s, { type: "chess_move", from: "e4", to: "d5" },
                          { seat: 0, now: NOW, seed: "" });
    expect(r.ok && r.events[0]!.payload).toMatchObject({ san: "exd5", captured: "p", check: false });
  });

  it("targets נותן את היעדים החוקיים של חייל בתור", () => {
    expect(targets(fresh(), "e2").sort()).toEqual(["e3", "e4"]);
    expect(targets(fresh(), "e7")).toEqual([]);   // לא בתור
    expect(targets(fresh(), "e4")).toEqual([]);   // ריק
  });

  it("קידום: הרדוקר דורש בחירה, והעמדה מקבלת את הכלי שנבחר", () => {
    // הדרך הקצרה לרגלי לבן בשורה השביעית.
    const s = play(fresh(), [
      ["h2", "h4"], ["g7", "g5"], ["h4", "g5"], ["h7", "h6"], ["g5", "h6"], ["a7", "a6"],
      ["h6", "h7"], ["a6", "a5"],
    ]);
    expect(isPromotion(s, "h7", "g8")).toBe(true);
    expect(isPromotion(s, "a2", "a3")).toBe(false);
    const done = play(s, [["h7", "g8", "q"]]);
    expect(done.moves.at(-1)).toBe("hxg8=Q");
  });
});

describe("שחמט — סיומים", () => {
  it("מט של רועה: הלבן מנצח והמשחק נסגר", () => {
    const s = play(fresh(), [
      ["e2", "e4"], ["e7", "e5"], ["d1", "h5"], ["b8", "c6"],
      ["f1", "c4"], ["g8", "f6"], ["h5", "f7"],
    ]);
    expect(s.phase).toBe("finished");
    expect(s.ending).toBe("checkmate");
    expect(s.winnerSeat).toBe(0);
    expect(s.finishedAt).toBe(NOW);
    expect(s.check).toBe(true);
  });

  it("אחרי הסיום שום פעולה לא מתקבלת", () => {
    const s = play(fresh(), [
      ["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"],
    ]);
    expect(s.ending).toBe("checkmate");
    expect(s.winnerSeat).toBe(1);
    const r = reduceChess(s, { type: "chess_resign" }, { seat: 0, now: NOW, seed: "" });
    expect(r).toEqual({ ok: false, error: "GAME_OVER" });
  });

  it("פט הוא תיקו בלי מנצח", () => {
    // עמדת פט ידועה: מלך שחור ב-a8, מלכה לבנה שסוגרת אותו.
    const s = { ...fresh(), moves: [] as string[],
      fen: "k7/8/1Q6/8/8/8/8/7K b - - 0 1" };
    // הרדוקר משחזר מהמהלכים, ולכן נכנסים לעמדה דרך משחק אמיתי קצר:
    const real = play(fresh(), [
      ["e2", "e3"], ["a7", "a5"], ["d1", "h5"], ["a8", "a6"], ["h5", "a5"], ["h7", "h5"],
      ["h2", "h4"], ["a6", "h6"], ["a5", "c7"], ["f7", "f6"], ["c7", "d7"], ["e8", "f7"],
      ["d7", "b7"], ["d8", "d3"], ["b7", "b8"], ["d3", "h7"], ["b8", "c8"], ["f7", "g6"],
      ["c8", "e6"],
    ]);
    expect(real.phase).toBe("finished");
    expect(real.ending).toBe("stalemate");
    expect(real.winnerSeat).toBeNull();
    expect(s.fen).toContain("k7");
  });

  it("חזרה משולשת מזוהה מרשימת המהלכים, לא מה-FEN לבדו", () => {
    const s = play(fresh(), [
      ["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"],
      ["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"],
    ]);
    expect(s.phase).toBe("finished");
    expect(s.ending).toBe("repetition");
  });

  it("כניעה מנצחת את היריב, גם שלא בתורו", () => {
    const r = reduceChess(fresh(), { type: "chess_resign" }, { seat: 1, now: NOW, seed: "" });
    expect(r.ok && r.state.winnerSeat).toBe(0);
    expect(r.ok && r.state.ending).toBe("resign");
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["chess_resigned", "chess_over"]);
  });
});

describe("שחמט — תיקו בהסכמה", () => {
  const offer = (s: ChessState, seat: number) =>
    reduceChess(s, { type: "chess_offer_draw" }, { seat, now: NOW, seed: "" });

  it("הצעה, קבלה", () => {
    const a = offer(fresh(), 0);
    expect(a.ok && a.state.drawOffer).toBe(0);
    const b = reduceChess((a as { state: ChessState }).state, { type: "chess_accept_draw" },
                          { seat: 1, now: NOW, seed: "" });
    expect(b.ok && b.state.ending).toBe("draw_agreed");
    expect(b.ok && b.state.winnerSeat).toBeNull();
  });

  it("אי אפשר לקבל תיקו שאף אחד לא הציע, או את ההצעה של עצמך", () => {
    expect(reduceChess(fresh(), { type: "chess_accept_draw" }, { seat: 1, now: NOW, seed: "" }))
      .toEqual({ ok: false, error: "NO_DRAW_OFFER" });
    const a = offer(fresh(), 0) as { state: ChessState };
    expect(reduceChess(a.state, { type: "chess_accept_draw" }, { seat: 0, now: NOW, seed: "" }))
      .toEqual({ ok: false, error: "NO_DRAW_OFFER" });
    expect(offer(a.state, 0)).toEqual({ ok: false, error: "DRAW_PENDING" });
  });

  it("הצעה נגדית היא הסכמה", () => {
    const a = offer(fresh(), 0) as { state: ChessState };
    const b = offer(a.state, 1);
    expect(b.ok && b.state.ending).toBe("draw_agreed");
  });

  it("דחייה מנקה, ומהלך של היריב מבטל את ההצעה מעצמו", () => {
    const a = offer(fresh(), 0) as { state: ChessState };
    const d = reduceChess(a.state, { type: "chess_decline_draw" }, { seat: 1, now: NOW, seed: "" });
    expect(d.ok && d.state.drawOffer).toBeNull();

    const s = play(fresh(), [["e2", "e4"]]);
    const o = offer(s, 0) as { state: ChessState };      // הלבן מציע כשהשחור בתור
    const m = play(o.state, [["e7", "e5"]]);              // השחור זז במקום לענות
    expect(m.drawOffer).toBeNull();
  });
});

describe("שחמט — תצוגה", () => {
  it("מה הוכה נגזר מהעמדה", () => {
    const s = play(fresh(), [["e2", "e4"], ["d7", "d5"], ["e4", "d5"], ["d8", "d5"]]);
    expect(captured(s)).toEqual({ w: ["p"], b: ["p"] });
  });
});
