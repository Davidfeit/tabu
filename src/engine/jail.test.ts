import { describe, it, expect } from "vitest";
import { BOARD } from "@/lib/board";
import { act, fail, newGame, own, place, setCash, toEndOfTurn, withRoll } from "./testkit";

const FINE = BOARD.meta.jailFine;

function inJail(seed = { d1: 2, d2: 3 }) {
  const s = place(withRoll(newGame(2), seed.d1, seed.d2), 0, 10,
                  { inJail: true, jailTurns: 0 });
  s.currentSeat = 0;
  return s;
}

describe("מעצר בית — כניסה", () => {
  it("משבצת ההוצאה לפועל שולחת פנימה בלי מעבר בזינוק", () => {
    let s = place(withRoll(newGame(2), 3, 4), 0, 23);   // 23+7 = 30
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.pos).toBe(10);
    expect(s.players[0]!.cash).toBe(before);            // אין בונוס
  });

  it("שלושה כפולים שולחים פנימה בלי לפתור את המשבצת השלישית", () => {
    let s = withRoll(newGame(2), 5, 5);
    s.doublesCount = 2;
    s = place(s, s.currentSeat, 0);
    s = act(s, { type: "roll" });
    expect(s.players[s.currentSeat]!.inJail).toBe(true);
    expect(s.players[s.currentSeat]!.pos).toBe(10);
  });
});

describe("מעצר בית — שלוש דרכים החוצה", () => {
  it("תשלום ערובה משחרר ומאפשר לגלגל", () => {
    let s = inJail();
    const before = s.players[0]!.cash;
    s = act(s, { type: "pay_jail_fine" });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.cash).toBe(before - FINE);
    expect(s.phase).toBe("awaiting_roll");
    s = act(s, { type: "roll" });
    expect(s.players[0]!.pos).not.toBe(10);
  });

  it("כרטיס יציאה משחרר ומוחזר לתחתית החפיסה", () => {
    let s = inJail();
    // כרטיס שנמשך עוזב את החפיסה — משחזרים את המצב הזה במדויק.
    const cardId = s.decks.yad_hagoral.find((id) => id === "yg16")!;
    s.decks.yad_hagoral = s.decks.yad_hagoral.filter((id) => id !== cardId);
    s.players[0]!.getOutCards = 1;
    const deckBefore = s.decks.yad_hagoral.length;
    s = act(s, { type: "use_jail_card" });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.getOutCards).toBe(0);
    expect(s.decks.yad_hagoral.length).toBe(deckBefore + 1);
    expect(s.decks.yad_hagoral.at(-1)).toBe(cardId);
  });

  it("לא משכפל כרטיס שכבר נמצא בחפיסה", () => {
    // הגנה מפני מצב לא עקבי: מימוש לא יכול ליצור קלף שני.
    let s = inJail();
    s.players[0]!.getOutCards = 1;
    const deckBefore = s.decks.yad_hagoral.length;
    s = act(s, { type: "use_jail_card" });
    expect(s.decks.yad_hagoral.length).toBe(deckBefore);
    expect(s.decks.yad_hagoral.filter((id) => id === "yg16")).toHaveLength(1);
  });

  it("דוחה כרטיס שאין", () => {
    expect(fail(inJail(), { type: "use_jail_card" })).toBe("NO_JAIL_CARD");
  });

  it("דוחה ערובה בלי מזומן", () => {
    const s = setCash(inJail(), 0, 10);   // מתחת לערובה (₪50)
    expect(fail(s, { type: "pay_jail_fine" })).toBe("INSUFFICIENT_FUNDS");
  });

  it("דוחה תשלום ערובה כשלא במעצר", () => {
    const s = newGame(2);
    expect(fail(s, { type: "pay_jail_fine" })).toBe("NOT_IN_JAIL");
  });

  it("כפולים משחררים ומזיזים — אבל בלי גלגול נוסף", () => {
    let s = place(withRoll(newGame(2), 4, 4), 0, 10, { inJail: true });
    s.currentSeat = 0;
    s = act(s, { type: "roll" });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.pos).toBe(18);
    expect(s.doublesCount).toBe(0);
    s = toEndOfTurn(s);
    s = act(s, { type: "end_turn" }, 0);
    expect(s.currentSeat).toBe(1);        // התור עבר, אין גלגול נוסף
  });
});

describe("מעצר בית — שלושה ניסיונות", () => {
  it("סופר ניסיונות שנכשלו ומשאיר בפנים", () => {
    let s = inJail();
    s = act(s, { type: "roll" });
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.jailTurns).toBe(1);
    expect(s.phase).toBe("awaiting_end");
  });

  it("בניסיון השלישי מחייב ערובה ומזיז", () => {
    let s = inJail();
    s.players[0]!.jailTurns = 2;
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.cash).toBe(before - FINE);
    expect(s.players[0]!.pos).toBe(15);    // 10 + 5
  });

  it("שומר את התנועה שגולגלה כשהערובה פותחת חוב", () => {
    // בלי מזומן לערובה, אבל עם נכס לממש — התנועה חייבת לשרוד את גיוס הכספים.
    let s = inJail();
    s.players[0]!.jailTurns = 2;
    s = own(s, 39, 0);
    s = setCash(s, 0, 1);
    s = act(s, { type: "roll" });
    expect(s.phase).toBe("debt");
    expect(s.pendingMove).toBe(5);
    expect(s.players[0]!.pos).toBe(10);    // עדיין לא זז
    // ממשכן ומכסה את החוב; התנועה מוחלת מיד עם הסגירה
    s = act(s, { type: "mortgage", pos: 39 }, 0);
    expect(s.debt).toBeNull();
    expect(s.pendingMove).toBeNull();
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.pos).toBe(15);
  });
});

describe("מעצר בית — מה עדיין מותר", () => {
  it("הבעלים גובה שכר דירה גם כשהוא במעצר", () => {
    let s = place(withRoll(newGame(2), 3, 3), 1, 0);
    s.currentSeat = 1;
    s = own(s, 6, 0);
    s.players[0]!.inJail = true;
    s.players[0]!.pos = 10;
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" }, 1);
    expect(s.players[0]!.cash).toBe(before + 5);
  });

  it("מותר לבנות ולמשכן מתוך המעצר", () => {
    let s = inJail();
    s = own(s, 39, 0);
    s = act(s, { type: "mortgage", pos: 39 }, 0);
    expect(s.deeds[39]!.mortgaged).toBe(true);
  });
});
