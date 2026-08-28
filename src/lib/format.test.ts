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
  // הקיצור בוטל יחד עם שינוי קנה המידה: ₪1,500 הוצג "₪2 א׳", כלומר עיגול
  // כלפי מעלה שמשנה את המשמעות. בטווח הסכומים של הלוח אין מה לקצר.
  it("מחזיר את הסכום המלא, בלי קיצור", () => {
    expect(shekelShort(1500)).toBe("₪1,500");
    expect(shekelShort(250)).toBe("₪250");
    expect(shekelShort(60)).toBe("₪60");
  });

  it("זהה ל-shekel", () => {
    for (const n of [0, 1, 60, 420, 1500, -50]) {
      expect(shekelShort(n)).toBe(shekel(n));
    }
  });
});
