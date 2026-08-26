import { describe, it, expect } from "vitest";
import { shekel, shekelShort } from "./format";

describe("shekel", () => {
  it("מציב את ₪ לפני הספרות בסדר הלוגי", () => {
    // ₪ הוא European Terminator: הסדר הלוגי קובע את המיקום החזותי.
    const s = shekel(1234000);
    expect(s.startsWith("₪")).toBe(true);
    expect(s).toBe("₪1,234,000");
  });

  it("לא פולט תווי כיווניות בלתי נראים", () => {
    // Intl בלוקאל he-IL מזריק LRM לפני מספר שלילי, ו-RLM + NBSP סביב סימן
    // המטבע. התווים האלה משבשים מדידות רוחב ו-snapshots. תווי בריחה במפורש —
    // תו בלתי נראה מילולי בקוד המקור לא שורד עריכה.
    const BIDI = /[\u200E\u200F\u061C\u00A0]/;
    for (const n of [0, 50000, 1500000, -75000, -1200000]) {
      expect(shekel(n)).not.toMatch(BIDI);
      expect(shekelShort(n)).not.toMatch(BIDI);
    }
  });

  it("מטפל באפס ובסכומים שליליים", () => {
    expect(shekel(0)).toBe("₪0");
    expect(shekel(-75000)).toBe("₪-75,000");
  });
});

describe("shekelShort", () => {
  it("מקצר מיליונים ואלפים עם גרש עברי", () => {
    expect(shekelShort(1200000)).toBe("₪1.2 מ׳");
    expect(shekelShort(250000)).toBe("₪250 א׳");
  });

  it("משתמש בגרש U+05F3 ולא באפוסטרוף ASCII", () => {
    expect(shekelShort(250000)).toContain("׳");
    expect(shekelShort(250000)).not.toContain("'");
  });

  it("משאיר סכומים קטנים בצורה מלאה", () => {
    expect(shekelShort(600)).toBe("₪600");
  });
});
