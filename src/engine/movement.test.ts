import { describe, it, expect } from "vitest";
import { BOARD } from "@/lib/board";
import { reduce } from "./reduce";
import { act, fail, newGame, place, own, setCash, toEndOfTurn, withRoll, T0, SEED } from "./testkit";

describe("הקמה", () => {
  it("מחלקת הון פתיחה שווה ומציבה את כולם בזינוק", () => {
    const s = newGame(4);
    expect(s.players).toHaveLength(4);
    for (const p of s.players) {
      expect(p.cash).toBe(BOARD.meta.startingCash);
      expect(p.pos).toBe(0);
      expect(p.bankrupt).toBe(false);
    }
    expect(s.bank).toEqual({ houses: 32, hotels: 12 });
  });

  it("דוחה מספר שחקנים לא חוקי", () => {
    expect(() => newGame(1)).toThrow(RangeError);
    expect(() => newGame(7)).toThrow(RangeError);
  });

  it("מערבבת את סדר התורות לפי הזרע", () => {
    const a = newGame(4).players.map((p) => p.userId);
    const b = newGame(4).players.map((p) => p.userId);
    expect(a).toEqual(b);          // דטרמיניסטי
    expect(new Set(a).size).toBe(4);
  });

  it("מחלקת נכסים בפתיחה רק במצבים מקוצרים", () => {
    const full = newGame(4);
    expect(Object.values(full.deeds).filter((d) => d.owner !== null)).toHaveLength(0);
    const quick = newGame(4, { mode: "quick" });
    expect(Object.values(quick.deeds).filter((d) => d.owner !== null)).toHaveLength(8);
  });
});

describe("תנועה", () => {
  it("מזיזה לפי סכום הקוביות", () => {
    let s = withRoll(newGame(2), 3, 4);
    s = act(s, { type: "roll" });
    expect(s.players[s.currentSeat]!.pos).toBe(7);
    expect(s.dice).toEqual([3, 4]);
  });

  it("מזכה בבונוס מעבר בזינוק בגלישה סביב הלוח", () => {
    let s = place(withRoll(newGame(2), 3, 4), 0, 38);
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    expect(s.players[0]!.pos).toBe(5);   // 38 + 7 = 45 → 5
    expect(s.players[0]!.cash).toBeGreaterThan(before);
  });

  it("לא מזכה בבונוס בתנועה שאינה חוצה את הזינוק", () => {
    let s = place(withRoll(newGame(2), 3, 4), 0, 1);
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    // נחת על 8 (אופקים) — שטר פנוי, טרם שילם
    expect(s.players[0]!.cash).toBe(before);
  });

  it("מעניקה גלגול נוסף על כפולים", () => {
    let s = withRoll(newGame(2), 2, 2);
    const seat = s.currentSeat;
    s = act(s, { type: "roll" });
    expect(s.doublesCount).toBe(1);
    s = toEndOfTurn(s);
    s = act(s, { type: "end_turn" }, seat);
    expect(s.currentSeat).toBe(seat);       // אותו שחקן
    expect(s.phase).toBe("awaiting_roll");
  });

  it("שולחת למעצר בית אחרי שלושה כפולים רצופים", () => {
    let s = withRoll(newGame(2), 2, 2);
    const seat = s.currentSeat;
    s.doublesCount = 2;                     // שני הכפולים הראשונים כבר נספרו
    const posBefore = s.players[seat]!.pos;
    s = act(s, { type: "roll" });
    expect(s.players[seat]!.inJail).toBe(true);
    expect(s.players[seat]!.pos).toBe(10);
    // לא זזים ולא פותרים את המשבצת השלישית
    expect(posBefore).not.toBe(10);
  });

  it("מעבירה תור לשחקן הבא", () => {
    let s = place(withRoll(newGame(3), 1, 2), 0, 20);   // 20+3 = 23, שטר פנוי
    const first = s.currentSeat;
    s = act(s, { type: "roll" });
    s = toEndOfTurn(s);
    s = act(s, { type: "end_turn" }, first);
    expect(s.currentSeat).not.toBe(first);
  });

  it("דוחה פעולה של מי שאינו בתור", () => {
    const s = newGame(2);
    const other = (s.currentSeat + 1) % 2;
    expect(fail(s, { type: "roll" }, other)).toBe("NOT_YOUR_TURN");
  });

  it("דוחה פעולה בשלב לא מתאים", () => {
    const s = newGame(2);
    expect(fail(s, { type: "end_turn" })).toBe("WRONG_PHASE");
  });
});

describe("קנייה", () => {
  it("מעבירה בעלות וגובה את המחיר", () => {
    let s = place(withRoll(newGame(2), 3, 4), 0, 32);   // 32+7 = 39 תל אביב, בלי מעבר בזינוק
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    expect(s.phase).toBe("awaiting_buy");
    s = act(s, { type: "buy_property" });
    expect(s.deeds[39]!.owner).toBe(0);
    expect(s.players[0]!.cash).toBe(before - 420_000);
  });

  it("דוחה קנייה בלי מזומן מספיק", () => {
    let s = place(withRoll(newGame(2), 3, 4), 0, 32);
    s = act(s, { type: "roll" });
    s = setCash(s, 0, 1000);
    expect(fail(s, { type: "buy_property" })).toBe("INSUFFICIENT_FUNDS");
  });

  it("לא מציעה לקנות שטר שכבר בבעלות", () => {
    let s = own(place(withRoll(newGame(2), 3, 4), 0, 32), 39, 1);
    s = act(s, { type: "roll" });
    expect(s.phase).not.toBe("awaiting_buy");
  });
});

describe("אכיפה עצלה של הטיימאאוט", () => {
  it("מחילה טיימאאוט לפני הפעולה הנכנסת, בלי מתזמן", () => {
    const s = newGame(2);
    const late = s.turnDeadline! + 1000;
    // שחקן אחר פועל אחרי שהתור פג — הפעולה שלו מתקנת את החדר
    const r = reduce(s, { type: "claim_timeout" }, { seat: 1, now: late, seed: SEED });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events.some((e) => e.type === "auto_roll")).toBe(true);
  });

  it("דוחה claim_timeout לפני שהדדליין הגיע", () => {
    const s = newGame(2);
    expect(fail(s, { type: "claim_timeout" }, 0, T0)).toBe("DEADLINE_NOT_REACHED");
  });
});
