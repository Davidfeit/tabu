import { describe, it, expect } from "vitest";
import {
  BAR_PERCENT,
  GRID,
  HALF_CELL_PCT,
  INWARD_PCT,
  SQUARE_COUNT,
  TOKEN_PCT,
  cellCenter,
  cellFor,
  colorBarEdge,
  contentInset,
  crowdOffset,
  crowdScale,
  inwardOffset,
  labelRotation,
  pathBetween,
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

describe("crowdOffset", () => {
  it("לא מזיז חייל בודד", () => {
    expect(crowdOffset(0, 1)).toEqual({ xPct: 0, yPct: 0 });
  });

  it("מפזר כמה חיילים למקומות שונים", () => {
    const points = [0, 1, 2, 3].map((i) => crowdOffset(i, 4));
    const keys = new Set(points.map((p) => `${p.xPct.toFixed(3)},${p.yPct.toFixed(3)}`));
    expect(keys.size).toBe(4);
  });

  it("חייל לא חורג מהמשבצת שלו, בכל צפיפות", () => {
    // זו האילוץ האמיתי: מרכז ההיסט ועוד חצי רוחב חייל, מול חצי משבצת.
    for (let n = 2; n <= 6; n++) {
      const halfToken = (TOKEN_PCT * crowdScale(n)) / 2;
      for (let i = 0; i < n; i++) {
        const { xPct, yPct } = crowdOffset(i, n);
        expect(Math.hypot(xPct, yPct) + halfToken).toBeLessThanOrEqual(HALF_CELL_PCT);
      }
    }
  });

  it("מקטין חיילים ככל שהמשבצת צפופה יותר", () => {
    expect(crowdScale(2)).toBe(1);
    expect(crowdScale(4)).toBeLessThan(crowdScale(2));
    expect(crowdScale(6)).toBeLessThan(crowdScale(4));
    expect(crowdScale(6)).toBeGreaterThan(0.6);   // עדיין נראה
  });

  it("שני חיילים על משבצת אחת מרוחקים מספיק כדי לא להסתיר זה את זה", () => {
    for (let n = 2; n <= 6; n++) {
      const width = TOKEN_PCT * crowdScale(n);
      const a = crowdOffset(0, n), b = crowdOffset(1, n);
      const gap = Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
      expect(gap).toBeGreaterThan(width * 0.5);
    }
  });
});

describe("היסט פנימה", () => {
  it("כל משבצת נדחפת אל מרכז הלוח ולא החוצה", () => {
    for (let pos = 0; pos < SQUARE_COUNT; pos++) {
      const c = cellCenter(pos);
      const o = inwardOffset(pos);
      const before = Math.hypot(c.xPct - 50, c.yPct - 50);
      const after = Math.hypot(c.xPct + o.xPct - 50, c.yPct + o.yPct - 50);
      expect(after).toBeLessThan(before);
    }
  });

  it("אורך ההיסט זהה בפינות ובצלעות — הנרמול עובד", () => {
    const len = (p: number) => {
      const o = inwardOffset(p);
      return Math.hypot(o.xPct, o.yPct);
    };
    for (const corner of [0, 10, 20, 30]) {
      expect(len(corner)).toBeCloseTo(INWARD_PCT, 10);
    }
    for (const edge of [5, 15, 25, 35]) {
      expect(len(edge)).toBeCloseTo(INWARD_PCT, 10);
    }
  });

  it("החייל יוצא לגמרי מגבולות המשבצת שלו", () => {
    // הקצה הקרוב של החייל חייב לעבור את גבול המשבצת, אחרת הוא עדיין
    // מכסה חלק מהתווית — וזו בדיוק הבעיה שההיסט בא לפתור.
    const nearEdge = INWARD_PCT - TOKEN_PCT / 2;
    expect(nearEdge).toBeGreaterThan(HALF_CELL_PCT);
  });

  it("גם עם פיזור צפיפות מלא החייל נשאר בטבעת ולא חוזר על המשבצת", () => {
    for (let total = 1; total <= 4; total++) {
      for (let i = 0; i < total; i++) {
        const o = crowdOffset(i, total);
        const worst = INWARD_PCT - Math.hypot(o.xPct, o.yPct);
        expect(worst).toBeGreaterThan(0);
      }
    }
  });
});
