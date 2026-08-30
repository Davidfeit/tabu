import { describe, it, expect } from "vitest";
import { BOARD, SQUARES, GROUPS, group, squareAt } from "./board";
import { isDeed, type PropertySquare } from "./types";
import { SQUARE_COUNT } from "./geometry";

const props = SQUARES.filter((s): s is PropertySquare => s.type === "property");

describe("שלמות נתוני הלוח", () => {
  it("מכיל בדיוק 40 משבצות ברצף", () => {
    expect(SQUARES).toHaveLength(SQUARE_COUNT);
    expect(SQUARES.map((s) => s.pos)).toEqual([...Array(SQUARE_COUNT).keys()]);
  });

  it("שומר על ההרכב הקלאסי: 22 נכסים, 4 צמתים, 2 תשתיות, 4 פינות", () => {
    const count = (t: string) => SQUARES.filter((s) => s.type === t).length;
    expect(count("property")).toBe(22);
    expect(count("transport")).toBe(4);
    expect(count("utility")).toBe(2);
    expect(count("corner")).toBe(4);
    expect(count("card")).toBe(6);
    expect(count("tax")).toBe(2);
  });

  it("מציב פינות ב-0/10/20/30 וצמתים ב-5/15/25/35", () => {
    expect(SQUARES.filter((s) => s.type === "corner").map((s) => s.pos)).toEqual([0, 10, 20, 30]);
    expect(SQUARES.filter((s) => s.type === "transport").map((s) => s.pos)).toEqual([5, 15, 25, 35]);
    expect(SQUARES.filter((s) => s.type === "utility").map((s) => s.pos)).toEqual([12, 28]);
  });

  it("גדלי קבוצות הצבע תואמים למספר הנכסים בפועל", () => {
    for (const g of GROUPS) {
      expect(props.filter((p) => p.group === g.key)).toHaveLength(g.size);
    }
    expect(GROUPS.reduce((n, g) => n + g.size, 0)).toBe(22);
  });

  it("מסדר את הנכסים במחיר עולה סביב הלוח", () => {
    const prices = props.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("מתמחר משכון בדיוק בחצי מחיר, לכל שטר", () => {
    for (const sq of SQUARES) {
      if (isDeed(sq)) expect(sq.mortgage * 2).toBe(sq.price);
    }
  });

  it("נותן לכל נכס טבלת שכ\"ד עולה של שש רמות", () => {
    for (const p of props) {
      expect(p.rent).toHaveLength(6);
      for (let i = 1; i < p.rent.length; i++) {
        expect(p.rent[i]).toBeGreaterThan(p.rent[i - 1]!);
      }
    }
  });

  it("שומר על יחס היצע הכסף (יחס ~0.70)", () => {
    // סך ערך השטרות חלקי הון הפתיחה של 4 שחקנים. במקור ~0.95, וכאן
    // ~0.70 בכוונה: הון פתיחה של 2,000 נבחר כדי שלא ייגמר הכסף מוקדם.
    // המחיר הוא פחות פשיטות רגל ומשחק ארוך יותר — וזו ההחלטה.
    //
    // הבדיקה נשארת כשומר: שינוי מחירים או הון פתיחה שיסיט את היחס
    // ישבור אותה, ואז זו החלטה מודעת ולא תופעת לוואי.
    const deedValue = SQUARES.filter(isDeed).reduce((n, s) => n + s.price, 0);
    const ratio = deedValue / (4 * BOARD.meta.startingCash);
    expect(ratio).toBeGreaterThan(0.66);
    expect(ratio).toBeLessThan(0.74);
  });

  it("מספק שתי חפיסות של 16 קלפים עם מזהים ייחודיים", () => {
    for (const key of ["kupat_gemel", "yad_hagoral"] as const) {
      const deck = BOARD.decks[key] as { id: string; text: string }[];
      expect(deck).toHaveLength(16);
      expect(new Set(deck.map((c) => c.id)).size).toBe(16);
      for (const card of deck) expect(card.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("כולל שני כרטיסי יציאה ממעצר בית — אחד בכל חפיסה", () => {
    const all = [...BOARD.decks.kupat_gemel, ...BOARD.decks.yad_hagoral] as {
      effect: { type: string };
    }[];
    expect(all.filter((c) => c.effect.type === "keep_out_of_jail")).toHaveLength(2);
  });
});

describe("היגיינת מותג ו-IP", () => {
  const text = JSON.stringify(BOARD);

  it("לא עושה שימוש בשמות או בסימנים של Hasbro", () => {
    // החוקים חופשיים; השם, שמות הפינות והחפיסות אינם.
    for (const banned of ["מונופול", "monopoly", "Monopoly", "הזדמנות", "קופה ציבורית"]) {
      expect(text).not.toContain(banned);
    }
    expect(text).not.toMatch(/ופול\b/);
  });

  it("לא עושה שימוש בסימנים מסחריים ישראליים חיים", () => {
    // חשיפה שנייה, בלתי תלויה, מצדדים שאינם Hasbro.
    for (const tm of ["רכבת ישראל", "נתב\"ג", "נמל חיפה", "אגד", "חברת החשמל", "מקורות", "מפעל הפיס"]) {
      expect(text).not.toContain(tm);
    }
  });
});

describe("עוזרי גישה", () => {
  it("מאתר קבוצה לפי מפתח וזורק על מפתח לא מוכר", () => {
    expect(group("azure").name).toBe("הצמרת");
    // @ts-expect-error בדיקת התנהגות בזמן ריצה
    expect(() => group("nope")).toThrow();
  });

  it("מאתר משבצת לפי מיקום וזורק מחוץ לתחום", () => {
    expect(squareAt(39).name).toBe("תל אביב-יפו");
    expect(() => squareAt(40)).toThrow();
  });
});
