import { describe, it, expect } from "vitest";
import {
  BAR_PERCENT,
  CORNER_UNITS,
  GRID,
  SQUARE_COUNT,
  TOTAL_UNITS,
  cellCenter,
  cellFor,
  colorBarEdge,
  contentInset,
  labelRotation,
  pathBetween,
  standFor,
  standRotation,
  tokenSize,
  travelArrowRotation,
} from "./geometry";
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

describe("cellCenter", () => {
  it("ממקם את הפינות בפינות הלוח", () => {
    // זינוק — ימין-למטה. הפינה רחבה פי 1.5, ולכן מרכזה ב-0.75/12.
    const start = cellCenter(0);
    expect(start.xPct).toBeCloseTo((10.5 + 0.75) / 12 * 100, 4);
    expect(start.yPct).toBeCloseTo((10.5 + 0.75) / 12 * 100, 4);

    const eilat = cellCenter(20);   // שמאל-למעלה
    expect(eilat.xPct).toBeCloseTo(0.75 / 12 * 100, 4);
    expect(eilat.yPct).toBeCloseTo(0.75 / 12 * 100, 4);
  });

  it("כל המרכזים בתוך הלוח", () => {
    for (let p = 0; p < SQUARE_COUNT; p++) {
      const { xPct, yPct } = cellCenter(p);
      expect(xPct).toBeGreaterThan(0);
      expect(xPct).toBeLessThan(100);
      expect(yPct).toBeGreaterThan(0);
      expect(yPct).toBeLessThan(100);
    }
  });

  it("משבצות עוקבות סמוכות זו לזו — אין קפיצות במסלול", () => {
    for (let p = 0; p < SQUARE_COUNT; p++) {
      const a = cellCenter(p);
      const b = cellCenter((p + 1) % SQUARE_COUNT);
      const dist = Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
      // מרווח משבצת רגילה הוא 100/12 ≈ 8.33; פינה מוסיפה עד 1.25 יחידות.
      expect(dist).toBeLessThan(12);
      expect(dist).toBeGreaterThan(5);
    }
  });

  it("שני מרכזים אינם חופפים", () => {
    const seen = new Set<string>();
    for (let p = 0; p < SQUARE_COUNT; p++) {
      const c = cellCenter(p);
      seen.add(`${c.xPct.toFixed(3)},${c.yPct.toFixed(3)}`);
    }
    expect(seen.size).toBe(SQUARE_COUNT);
  });
});

describe("pathBetween", () => {
  it("הולך קדימה וכולל את שני הקצוות", () => {
    expect(pathBetween(3, 7)).toEqual([3, 4, 5, 6, 7]);
  });

  it("גולש סביב הלוח דרך הזינוק ולא חותך אחורה", () => {
    // מעבר מ-38 ל-2 חייב לעבור ב-39 ואז 0 — אחרת הוא נראה כמו נסיגה.
    expect(pathBetween(38, 2)).toEqual([38, 39, 0, 1, 2]);
  });

  it("מיקום זהה נותן צעד יחיד", () => {
    expect(pathBetween(5, 5)).toEqual([5]);
  });

  it("הקפה מלאה אורכה 41 עצירות", () => {
    expect(pathBetween(0, 39)).toHaveLength(40);
  });
});

describe("עמידה על המשבצת", () => {
  const CELL = 100 / TOTAL_UNITS;

  it("תחתית החייל נשענת על המשבצת, בכל ארבע הצלעות", () => {
    // כפות הרגליים על הצלע הפנימית של המשבצת עצמה, והגוף יוצא ממנה החוצה
    // בזכות הסיבוב. זה הכלל היחיד, ואין לו יוצא מן הכלל.
    for (let pos = 0; pos < SQUARE_COUNT; pos++) {
      const { row, col } = cellFor(pos);
      const c = cellCenter(pos);
      const f = standFor(pos, 0, 1);
      const halfY = (row === 1 || row === GRID ? CORNER_UNITS : 1) / 2 / TOTAL_UNITS * 100;
      const halfX = (col === 1 || col === GRID ? CORNER_UNITS : 1) / 2 / TOTAL_UNITS * 100;

      if (row === GRID) expect(f.yPct).toBeCloseTo(c.yPct - halfY, 10);
      else if (row === 1) expect(f.yPct).toBeCloseTo(c.yPct + halfY, 10);
      else expect(Math.abs(f.xPct - c.xPct)).toBeCloseTo(halfX, 10);
    }
  });

  it("הסיבוב מוציא את הגוף מהמשבצת, לא לתוכה", () => {
    // 0 = הגוף כלפי מעלה. בשורה העליונה "החוצה" הוא כלפי מטה, ולכן 180.
    expect(standRotation(5)).toBe(0);      // שורה תחתונה
    expect(standRotation(0)).toBe(0);      // פינת הזינוק
    expect(standRotation(25)).toBe(180);   // שורה עליונה
    expect(standRotation(20)).toBe(180);   // פינה עליונה
    expect(standRotation(15)).toBe(90);    // עמודה שמאלית
    expect(standRotation(35)).toBe(-90);   // עמודה ימנית
  });

  it("צפופים עומדים בשורה על אותו קו רצפה, לא זה על זה", () => {
    const total = 4;
    const feet = [0, 1, 2, 3].map((i) => standFor(5, i, total));
    // שורה תחתונה: אותו גובה, ומרווח קבוע לרוחב.
    for (const f of feet) expect(f.yPct).toBeCloseTo(feet[0]!.yPct, 10);
    const gaps = feet.slice(1).map((f, i) => f.xPct - feet[i]!.xPct);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 10);
    expect(gaps[0]).toBeGreaterThan(0);
  });

  it("השורה מרוכזת סביב המשבצת", () => {
    for (const total of [1, 2, 3, 4]) {
      const xs = Array.from({ length: total }, (_, i) => standFor(5, i, total).xPct);
      const mid = (xs[0]! + xs[total - 1]!) / 2;
      expect(mid).toBeCloseTo(cellCenter(5).xPct, 10);
    }
  });

  it("ארבעה חיילים נכנסים ברוחב סביר ביחס למשבצת", () => {
    const { w } = tokenSize(4);
    const xs = [0, 1, 2, 3].map((i) => standFor(5, i, 4).xPct);
    const span = xs[3]! - xs[0]! + w;
    expect(span).toBeLessThan(CELL * 1.6);
  });

  it("בעמודות הפרישה אנכית ולא אופקית", () => {
    const a = standFor(15, 0, 3), b = standFor(15, 2, 3);
    expect(a.xPct).toBeCloseTo(b.xPct, 10);
    expect(b.yPct).toBeGreaterThan(a.yPct);
  });
});
