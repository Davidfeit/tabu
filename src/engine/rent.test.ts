import { describe, it, expect } from "vitest";
import { rentFor } from "./selectors";
import { act, newGame, own, place, setCash, withRoll } from "./testkit";

// קצה המדבר: ירוחם (1) ומצפה רמון (3) — קבוצה בת שניים, נוחה לבדיקה.
const YERUHAM = 1, MITZPE = 3;
// ערי הפיתוח: דימונה (6), אופקים (8), נתיבות (9)
const DIMONA = 6;

describe("שכר דירה — נכסים", () => {
  it("גובה שכ\"ד בסיס על שטר בודד", () => {
    const s = own(newGame(2), YERUHAM, 1);
    expect(rentFor(s, YERUHAM, 7)).toBe(2_000);
  });

  it("מכפיל על קבוצה שלמה בלתי מבונה — המונופול", () => {
    let s = own(newGame(2), YERUHAM, 1);
    s = own(s, MITZPE, 1);
    expect(rentFor(s, YERUHAM, 7)).toBe(4_000);
  });

  it("מבטל את ההכפלה אם שטר כלשהו בקבוצה משוכן", () => {
    let s = own(newGame(2), YERUHAM, 1);
    s = own(s, MITZPE, 1, { mortgaged: true });
    // ההכפלה דורשת את הקבוצה כולה לא משוכנת — גם על החבר שאינו משוכן
    expect(rentFor(s, YERUHAM, 7)).toBe(2_000);
  });

  it("לא גובה כלום על שטר משוכן", () => {
    const s = own(newGame(2), YERUHAM, 1, { mortgaged: true });
    expect(rentFor(s, YERUHAM, 7)).toBe(0);
  });

  it("לא גובה כלום על שטר ללא בעלים", () => {
    expect(rentFor(newGame(2), YERUHAM, 7)).toBe(0);
  });

  it("משתמש בטבלת הבתים כשיש בנייה", () => {
    let s = own(newGame(2), YERUHAM, 1, { houses: 3 });
    s = own(s, MITZPE, 1);
    expect(rentFor(s, YERUHAM, 7)).toBe(90_000);
  });

  it("משתמש בשורת המלון", () => {
    let s = own(newGame(2), YERUHAM, 1, { hotel: true });
    s = own(s, MITZPE, 1);
    expect(rentFor(s, YERUHAM, 7)).toBe(250_000);
  });
});

describe("שכר דירה — צמתי תחבורה", () => {
  const HUBS = [5, 15, 25, 35];

  it("גדל לפי מספר הצמתים בבעלות", () => {
    let s = newGame(2);
    const expected = [20_000, 40_000, 80_000, 160_000];
    for (let i = 0; i < 4; i++) {
      s = own(s, HUBS[i]!, 1);
      expect(rentFor(s, HUBS[0]!, 7)).toBe(expected[i]);
    }
  });

  it("לא סופר צמתים משוכנים למניין", () => {
    let s = own(newGame(2), HUBS[0]!, 1);
    s = own(s, HUBS[1]!, 1, { mortgaged: true });
    expect(rentFor(s, HUBS[0]!, 7)).toBe(20_000);   // אחד בלבד נספר
  });

  it("מכפיל בהגעה דרך קלף הצומת", () => {
    const s = own(newGame(2), HUBS[0]!, 1);
    expect(rentFor(s, HUBS[0]!, 7, "transport_double")).toBe(40_000);
  });
});

describe("שכר דירה — תשתיות", () => {
  const POWER = 12, WATER = 28;

  it("מכפיל את סכום הקוביות ב-5,000 כשמחזיקים אחת", () => {
    const s = own(newGame(2), POWER, 1);
    expect(rentFor(s, POWER, 9)).toBe(45_000);
  });

  it("מכפיל ב-12,000 כשמחזיקים את שתיהן", () => {
    let s = own(newGame(2), POWER, 1);
    s = own(s, WATER, 1);
    expect(rentFor(s, POWER, 9)).toBe(108_000);
  });

  it("כופה ×12,000 בהגעה דרך הקלף, גם עם תשתית אחת", () => {
    const s = own(newGame(2), POWER, 1);
    expect(rentFor(s, POWER, 9, "utility_max")).toBe(108_000);
  });
});

describe("גביית שכר דירה בפועל", () => {
  it("מעבירה מזומן מהנוחת לבעלים", () => {
    let s = own(place(withRoll(newGame(2), 3, 3), 0, 0), DIMONA, 1);
    const ownerBefore = s.players[1]!.cash;
    const payerBefore = s.players[0]!.cash;
    s = act(s, { type: "roll" });          // 0 + 6 = 6 דימונה
    expect(s.players[0]!.pos).toBe(DIMONA);
    expect(s.players[1]!.cash).toBe(ownerBefore + 5_000);
    expect(s.players[0]!.cash).toBe(payerBefore - 5_000);
  });

  it("לא גובה מהבעלים על נחיתה בנכס של עצמו", () => {
    let s = own(place(withRoll(newGame(2), 3, 3), 0, 0), DIMONA, 0);
    const before = s.players[0]!.cash;
    s = act(s, { type: "roll" });
    expect(s.players[0]!.cash).toBe(before);
  });

  it("פותחת חוב כשאין מזומן אבל יש די נכסים לממש", () => {
    // דימונה עם שני בתים = ₪75,000. לנוחת תל אביב, ששווי משכונה ₪210,000.
    let s = own(place(withRoll(newGame(2), 3, 3), 0, 0), DIMONA, 1, { houses: 2 });
    s = own(s, 8, 1); s = own(s, 9, 1);
    s = own(s, 39, 0);
    s = setCash(s, 0, 1_000);
    s = act(s, { type: "roll" });
    expect(s.phase).toBe("debt");
    expect(s.debt!.debtorSeat).toBe(0);
    expect(s.debt!.creditorSeat).toBe(1);
    expect(s.debt!.amount).toBe(75_000);
  });

  it("קופצת ישר לפשיטת רגל כששווי המימוש נמוך מהחוב", () => {
    // אותו תרחיש עם מלון: ₪480,000 מול שווי מימוש ₪211,000 בלבד.
    let s = own(place(withRoll(newGame(2), 3, 3), 0, 0), DIMONA, 1, { hotel: true });
    s = own(s, 8, 1); s = own(s, 9, 1);
    s = own(s, 39, 0);
    s = setCash(s, 0, 1_000);
    s = act(s, { type: "roll" });
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.phase).toBe("finished");
    expect(s.winnerSeat).toBe(1);
    // הנכס עבר לנושה, לא נעלם מהכלכלה
    expect(s.deeds[39]!.owner).toBe(1);
  });
});
