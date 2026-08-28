import { describe, it, expect } from "vitest";
import { BOARD } from "@/lib/board";
import { applyCard, drawCard } from "./moves";
import { act, newGame, own, place, setCash, T0 } from "./testkit";
import type { GameEvent, GameState } from "./types";

/** מכריח קלף מסוים לראש החפיסה ומחיל אותו. */
function playCard(s: GameState, deck: "kupat_gemel" | "yad_hagoral", id: string, seat = 0) {
  const c = structuredClone(s);
  c.currentSeat = seat;
  c.decks[deck] = [id, ...c.decks[deck].filter((x) => x !== id)];
  const events: GameEvent[] = [];
  drawCard(c, events, seat, deck);
  applyCard(c, events, seat);
  return { state: c, events };
}

describe("החפיסות", () => {
  it("קלף שנמשך חוזר לתחתית — חוץ מכרטיס היציאה", () => {
    const s = newGame(2);
    const events: GameEvent[] = [];
    const c = structuredClone(s);
    const top = c.decks.kupat_gemel[0]!;
    drawCard(c, events, 0, "kupat_gemel");
    const isJailCard = (BOARD.decks.kupat_gemel as { id: string; effect: { type: string } }[])
      .find((x) => x.id === top)!.effect.type === "keep_out_of_jail";
    if (isJailCard) expect(c.decks.kupat_gemel).not.toContain(top);
    else expect(c.decks.kupat_gemel.at(-1)).toBe(top);
  });

  it("הקלף ממתין לאישור לפני שהאפקט מוחל", () => {
    let s = place(newGame(2), 0, 0);
    s.currentSeat = 0;
    s.decks.kupat_gemel = ["kg01", ...s.decks.kupat_gemel.filter((x) => x !== "kg01")];
    const before = s.players[0]!.cash;
    const events: GameEvent[] = [];
    drawCard(s, events, 0, "kupat_gemel");
    expect(s.drawnCard).not.toBeNull();
    expect(s.players[0]!.cash).toBe(before);      // עדיין לא הוחל
    s = act(s, { type: "acknowledge_card" }, 0, T0);
    expect(s.players[0]!.cash).toBe(before + 200);
  });

  it("החפיסה לא מעורבבת מחדש באמצע משחק — ההידלדלות היא חלק מהחוויה", () => {
    const s = newGame(2);
    const first = s.decks.yad_hagoral[0]!;
    const events: GameEvent[] = [];
    const c = structuredClone(s);
    drawCard(c, events, 0, "yad_hagoral");
    expect(c.decks.yad_hagoral[0]).not.toBe(first);
  });
});

describe("אפקטים כספיים", () => {
  it("קלף זיכוי מוסיף מזומן", () => {
    const { state } = playCard(newGame(2), "kupat_gemel", "kg01");
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash + 200);
  });

  it("קלף חיוב גובה מזומן", () => {
    const { state } = playCard(newGame(2), "kupat_gemel", "kg03");
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash - 50);
  });

  it("קלף החתונה גובה מכל שחקן אחר", () => {
    const { state } = playCard(newGame(3), "kupat_gemel", "kg07");
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash + 2 * 50);
    expect(state.players[1]!.cash).toBe(BOARD.meta.startingCash - 50);
    expect(state.players[2]!.cash).toBe(BOARD.meta.startingCash - 50);
  });

  it("קלף השיפוצים מחייב לפי בנייה בפועל", () => {
    let s = own(newGame(2), 6, 0, { houses: 3 });
    s = own(s, 8, 0, { hotel: true });
    const { state } = playCard(s, "kupat_gemel", "kg11");
    // 3 בתים × 25,000 + מלון × 100,000
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash - 175);
  });

  it("קלף שיפוצים לא גובה כלום בלי בנייה", () => {
    const { state } = playCard(newGame(2), "kupat_gemel", "kg11");
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash);
  });
});

describe("אפקטי תנועה", () => {
  it("נסיעה לעיר מזכה בבונוס זינוק אם עוברים", () => {
    const s = place(newGame(2), 0, 30);
    const { state } = playCard(s, "yad_hagoral", "yg02");   // סע לירושלים (37)
    expect(state.players[0]!.pos).toBe(37);
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash);  // 37 > 30, לא עבר
  });

  it("נסיעה שחוצה את הזינוק מזכה בבונוס", () => {
    const s = place(newGame(2), 0, 30);
    const { state } = playCard(s, "yad_hagoral", "yg03");   // סע לבאר שבע (18)
    expect(state.players[0]!.pos).toBe(18);
    expect(state.players[0]!.cash).toBeGreaterThan(BOARD.meta.startingCash);
  });

  it("שלוש משבצות אחורה לעולם לא מזכות בבונוס זינוק", () => {
    const s = place(newGame(2), 0, 1);
    const { state } = playCard(s, "yad_hagoral", "yg04");
    expect(state.players[0]!.pos).toBe(38);                 // 1 - 3 → 38
    expect(state.players[0]!.cash).toBeLessThan(BOARD.meta.startingCash);  // מס רכישה
  });

  it("צו עיקול שולח למעצר בית", () => {
    const s = place(newGame(2), 0, 5);
    const { state } = playCard(s, "yad_hagoral", "yg15");
    expect(state.players[0]!.inJail).toBe(true);
    expect(state.players[0]!.pos).toBe(10);
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash);  // בלי בונוס
  });

  it("קלף הצומת גובה דמי מעבר כפולים", () => {
    let s = place(newGame(2), 0, 2);
    s = own(s, 5, 1);                                       // תחנת הרכבת לשחקן 1
    const { state } = playCard(s, "yad_hagoral", "yg06");
    expect(state.players[0]!.pos).toBe(5);
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash - 40);
  });

  it("קלף התשתית כופה ×12,000 גם כשלבעלים יש אחת בלבד", () => {
    let s = place(newGame(2), 0, 9);
    s = own(s, 12, 1);                                      // תחנת הכוח לשחקן 1
    s.dice = [4, 5];
    const { state } = playCard(s, "yad_hagoral", "yg07");
    expect(state.players[0]!.pos).toBe(12);
    expect(state.players[0]!.cash).toBe(BOARD.meta.startingCash - 9 * 12);
  });
});

describe("אפקטים מיוחדים", () => {
  it("כרטיס יציאה נשמר אצל השחקן", () => {
    const { state } = playCard(newGame(2), "kupat_gemel", "kg15");
    expect(state.players[0]!.getOutCards).toBe(1);
  });

  it("פקק בכביש 1 מדלג על התור הבא", () => {
    const { state } = playCard(newGame(2), "yad_hagoral", "yg10");
    expect(state.players[0]!.skipNextTurn).toBe(true);
  });

  it("קלף שמחייב יותר מהמזומן פותח חוב", () => {
    let s = own(newGame(2), 39, 0);
    s = setCash(s, 0, 1);
    const { state } = playCard(s, "kupat_gemel", "kg14");    // ‎-80,000
    expect(state.phase).toBe("debt");
    expect(state.debt!.amount).toBe(80);
  });
});
