import { describe, it, expect } from "vitest";
import { cellFor, colorBarEdge, contentInset, labelRotation, travelArrowRotation, BAR_PERCENT, GRID, SQUARE_COUNT } from "./geometry";
import type { Side } from "./geometry";

describe("cellFor", () => {
  it("מציב את הפינות בארבע פינות הרשת", () => {
    expect(cellFor(0)).toMatchObject({ row: 11, col: 11, isCorner: true });  // זינוק
    expect(cellFor(10)).toMatchObject({ row: 11, col: 1, isCorner: true });  // מעצר בית
    expect(cellFor(20)).toMatchObject({ row: 1, col: 1, isCorner: true });   // חופשה באילת
    expect(cellFor(30)).toMatchObject({ row: 1, col: 11, isCorner: true });  // הוצאה לפועל
  });

  it("מקצה בדיוק ארבע פינות", () => {
    const corners = [...Array(SQUARE_COUNT).keys()].filter((p) => cellFor(p).isCorner);
    expect(corners).toEqual([0, 10, 20, 30]);
  });

  it("נותן תא ייחודי לכל משבצת", () => {
    const seen = new Set([...Array(SQUARE_COUNT).keys()].map((p) => {
      const c = cellFor(p);
      return `${c.row},${c.col}`;
    }));
    expect(seen.size).toBe(SQUARE_COUNT);
  });

  it("משאיר את הליבה 9×9 פנויה לווידאו", () => {
    for (let p = 0; p < SQUARE_COUNT; p++) {
      const { row, col } = cellFor(p);
      const inCore = row > 1 && row < GRID && col > 1 && col < GRID;
      expect(inCore).toBe(false);
    }
  });

  it("נע עם כיוון השעון מזינוק: שמאלה, למעלה, ימינה, למטה", () => {
    // שורה תחתונה נעה שמאלה
    expect(cellFor(1)).toMatchObject({ row: 11, col: 10, side: "bottom" });
    expect(cellFor(9)).toMatchObject({ row: 11, col: 2, side: "bottom" });
    // עמודה שמאלית נעה למעלה
    expect(cellFor(11)).toMatchObject({ row: 10, col: 1, side: "left" });
    expect(cellFor(19)).toMatchObject({ row: 2, col: 1, side: "left" });
    // שורה עליונה נעה ימינה
    expect(cellFor(21)).toMatchObject({ row: 1, col: 2, side: "top" });
    expect(cellFor(29)).toMatchObject({ row: 1, col: 10, side: "top" });
    // עמודה ימנית נעה למטה
    expect(cellFor(31)).toMatchObject({ row: 2, col: 11, side: "right" });
    expect(cellFor(39)).toMatchObject({ row: 10, col: 11, side: "right" });
  });

  it("כל שני מיקומים עוקבים שכנים ברשת", () => {
    for (let p = 0; p < SQUARE_COUNT; p++) {
      const a = cellFor(p);
      const b = cellFor((p + 1) % SQUARE_COUNT);
      const dist = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
      expect(dist).toBe(1);
    }
  });

  it("דוחה מיקום מחוץ לתחום", () => {
    expect(() => cellFor(-1)).toThrow(RangeError);
    expect(() => cellFor(40)).toThrow(RangeError);
    expect(() => cellFor(1.5)).toThrow(RangeError);
  });
});

describe("כיוון תוויות וסימונים", () => {
  it("מסובב עמודות צד הרחק ממרכז הלוח, ומשאיר שורות זקופות", () => {
    // הסיבובים הפוכים מלטינית: טקסט עברי זורם ב-‎-x‎, וסיבוב ‎-90°‎ ממפה את ‎-x‎
    // כלפי מטה. לכן "מלמטה למעלה" בעמודה השמאלית דורש ‎+90°‎, לא ‎-90°‎.
    expect(labelRotation("bottom")).toBe(0);
    expect(labelRotation("top")).toBe(0);
    expect(labelRotation("left")).toBe(90);
    expect(labelRotation("right")).toBe(-90);
  });

  it("מסובב את שתי עמודות הצד בכיוונים מנוגדים", () => {
    expect(labelRotation("left")).toBe(-labelRotation("right"));
  });

  it("מציב את פס הצבע בצלע הפונה למרכז", () => {
    expect(colorBarEdge("bottom")).toBe("top");
    expect(colorBarEdge("top")).toBe("bottom");
    expect(colorBarEdge("left")).toBe("right");
    expect(colorBarEdge("right")).toBe("left");
  });

  it("מכוון את חץ התור לפי גיאומטריה ולא לפי כיוון טקסט", () => {
    // הבאג מספר 1 ב-RTL: חץ שהתהפך וכעת סותר את תנועת החייל.
    expect(travelArrowRotation("bottom")).toBe(180);
    expect(travelArrowRotation("left")).toBe(270);
    expect(travelArrowRotation("top")).toBe(0);
    expect(travelArrowRotation("right")).toBe(90);
  });
});

describe("contentInset", () => {
  const SIDES: Side[] = ["bottom", "left", "top", "right"];

  it("מפנה מקום בדיוק בצלע שעליה יושב הפס", () => {
    expect(contentInset("right")).toEqual({ top: 0, right: BAR_PERCENT, bottom: 0, left: 0 });
    expect(contentInset("top")).toEqual({ top: BAR_PERCENT, right: 0, bottom: 0, left: 0 });
  });

  it("לכל צלע לוח, התוכן נמנע מאותה צלע שבה יושב הפס", () => {
    // זה מה שנשבר כשהמפה נכתבה ביד: פס בימין מול תוכן שנמנע מלמעלה.
    for (const side of SIDES) {
      const edge = colorBarEdge(side);
      const inset = contentInset(edge);
      expect(inset[edge]).toBe(BAR_PERCENT);
      const others = (["top", "right", "bottom", "left"] as const).filter((e) => e !== edge);
      for (const o of others) expect(inset[o]).toBe(0);
    }
  });
});
