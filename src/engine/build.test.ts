import { describe, it, expect } from "vitest";
import { act, fail, newGame, own, setCash, setPhase } from "./testkit";

// ערי הפיתוח: דימונה (6), אופקים (8), נתיבות (9). בית = ₪50,000.
const SKY = [6, 8, 9];
const HOUSE = 50_000;
// קצה המדבר: ירוחם (1), מצפה רמון (3). בית = ₪40,000.
const SAND = [1, 3];

/** קבוצה שלמה בבעלות מושב 0, עם הרבה מזומן. */
function withGroup(positions: number[], cash = 5_000_000) {
  let s = newGame(2);
  for (const p of positions) s = own(s, p, 0);
  return setCash(s, 0, cash);
}

describe("בנייה", () => {
  it("דורשת קבוצת צבע שלמה", () => {
    let s = own(newGame(2), SKY[0]!, 0);
    s = setCash(s, 0, 5_000_000);
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("GROUP_INCOMPLETE");
  });

  it("דורשת שאף שטר בקבוצה לא יהיה משוכן", () => {
    let s = withGroup(SKY);
    s = own(s, SKY[1]!, 0, { mortgaged: true });
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("GROUP_INCOMPLETE");
  });

  it("גובה את עלות הבית ומורידה מהמלאי", () => {
    let s = withGroup(SKY);
    const before = s.players[0]!.cash;
    s = act(s, { type: "build_house", pos: SKY[0]! });
    expect(s.deeds[SKY[0]!]!.houses).toBe(1);
    expect(s.players[0]!.cash).toBe(before - HOUSE);
    expect(s.bank.houses).toBe(31);
  });

  it("אוכפת בנייה שווה — אסור לבנות שני על אחד לפני אחד על כולם", () => {
    let s = withGroup(SKY);
    s = act(s, { type: "build_house", pos: SKY[0]! });
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("UNEVEN_BUILD");
    s = act(s, { type: "build_house", pos: SKY[1]! });
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("UNEVEN_BUILD");
    s = act(s, { type: "build_house", pos: SKY[2]! });
    s = act(s, { type: "build_house", pos: SKY[0]! });   // עכשיו חוקי
    expect(s.deeds[SKY[0]!]!.houses).toBe(2);
  });

  it("דוחה בנייה בלי מזומן", () => {
    let s = withGroup(SKY, 1_000);
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("INSUFFICIENT_FUNDS");
  });

  it("בונה מלון בסף, ומחזירה את הבתים למלאי", () => {
    let s = withGroup(SAND);
    for (let round = 0; round < 4; round++)
      for (const p of SAND) s = act(s, { type: "build_house", pos: p });
    expect(s.bank.houses).toBe(32 - 8);
    s = act(s, { type: "build_house", pos: SAND[0]! });   // הופך למלון
    expect(s.deeds[SAND[0]!]!.hotel).toBe(true);
    expect(s.deeds[SAND[0]!]!.houses).toBe(0);
    expect(s.bank.hotels).toBe(11);
    // ארבעת הבתים חוזרים למלאי — זה מה שמאפשר הרעבת בתים
    expect(s.bank.houses).toBe(32 - 8 + 4);
  });

  it("לא בונה מעבר למלון", () => {
    let s = withGroup(SAND);
    s = own(s, SAND[0]!, 0, { hotel: true });
    s = own(s, SAND[1]!, 0, { hotel: true });
    expect(fail(s, { type: "build_house", pos: SAND[0]! })).toBe("MAX_DEVELOPED");
  });

  it("במצב מהיר המלון נבנה בשלושה בתים", () => {
    let s = newGame(2, { mode: "quick", hotelThreshold: 3 });
    for (const p of SAND) s = own(s, p, 0);
    s = setCash(s, 0, 5_000_000);
    for (let round = 0; round < 3; round++)
      for (const p of SAND) s = act(s, { type: "build_house", pos: p });
    s = act(s, { type: "build_house", pos: SAND[0]! });
    expect(s.deeds[SAND[0]!]!.hotel).toBe(true);
    // חוק הבנייה השווה עדיין תקף: 3 בתים מול מלון
    expect(fail(s, { type: "build_house", pos: SAND[0]! })).toBe("MAX_DEVELOPED");
    s = act(s, { type: "build_house", pos: SAND[1]! });
    expect(s.deeds[SAND[1]!]!.hotel).toBe(true);
  });
});

describe("מחסור במלאי הבנק", () => {
  it("חוסמת בנייה כשנגמרו הבתים", () => {
    let s = withGroup(SKY);
    s.bank.houses = 0;
    expect(fail(s, { type: "build_house", pos: SKY[0]! })).toBe("NO_HOUSES_LEFT");
  });

  it("חוסמת מלון כשנגמרו המלונות", () => {
    let s = withGroup(SAND);
    for (let round = 0; round < 4; round++)
      for (const p of SAND) s = act(s, { type: "build_house", pos: p });
    s.bank.hotels = 0;
    expect(fail(s, { type: "build_house", pos: SAND[0]! })).toBe("NO_HOTELS_LEFT");
  });

  it("חוסמת פירוק מלון כשאין בבנק בתים להחזיר", () => {
    let s = withGroup(SAND);
    s = own(s, SAND[0]!, 0, { hotel: true });
    s = own(s, SAND[1]!, 0, { hotel: true });
    s.bank.houses = 2;                       // צריך 4 כדי לפרק
    expect(fail(s, { type: "sell_house", pos: SAND[0]! })).toBe("NO_HOUSES_LEFT");
  });
});

describe("מכירת בתים", () => {
  it("מחזירה חצי מהעלות ומחזירה את הבית למלאי", () => {
    let s = withGroup(SKY);
    for (const p of SKY) s = act(s, { type: "build_house", pos: p });
    const before = s.players[0]!.cash;
    s = act(s, { type: "sell_house", pos: SKY[0]! });
    expect(s.players[0]!.cash).toBe(before + HOUSE / 2);
    expect(s.bank.houses).toBe(32 - 2);
  });

  it("אוכפת מכירה שווה — רק מהגבוה בקבוצה", () => {
    let s = withGroup(SKY);
    for (const p of SKY) s = act(s, { type: "build_house", pos: p });
    s = act(s, { type: "build_house", pos: SKY[0]! });   // ל-0 יש שניים
    expect(fail(s, { type: "sell_house", pos: SKY[1]! })).toBe("UNEVEN_BUILD");
    s = act(s, { type: "sell_house", pos: SKY[0]! });     // חוקי
    expect(s.deeds[SKY[0]!]!.houses).toBe(1);
  });

  it("דוחה מכירה כשאין בנייה", () => {
    const s = withGroup(SKY);
    expect(fail(s, { type: "sell_house", pos: SKY[0]! })).toBe("NO_BUILDINGS");
  });
});

describe("משכון", () => {
  it("מזכה בחצי מהמחיר ומסמן משוכן", () => {
    let s = own(newGame(2), 39, 0);
    const before = s.players[0]!.cash;
    s = act(s, { type: "mortgage", pos: 39 });
    expect(s.deeds[39]!.mortgaged).toBe(true);
    expect(s.players[0]!.cash).toBe(before + 210_000);
  });

  it("חוסם משכון כל עוד יש בנייה כלשהי בקבוצה", () => {
    let s = withGroup(SKY);
    s = act(s, { type: "build_house", pos: SKY[0]! });
    expect(fail(s, { type: "mortgage", pos: SKY[1]! })).toBe("HAS_BUILDINGS");
  });

  it("פודה בעלות של 110%", () => {
    let s = own(newGame(2), 39, 0, { mortgaged: true });
    const before = s.players[0]!.cash;
    s = act(s, { type: "unmortgage", pos: 39 });
    expect(s.deeds[39]!.mortgaged).toBe(false);
    expect(s.players[0]!.cash).toBe(before - 231_000);   // 210,000 × 1.10
  });

  it("דוחה פדיון בלי מזומן", () => {
    let s = own(newGame(2), 39, 0, { mortgaged: true });
    s = setCash(s, 0, 1_000);
    expect(fail(s, { type: "unmortgage", pos: 39 })).toBe("INSUFFICIENT_FUNDS");
  });

  it("דוחה פעולה על שטר של אחר", () => {
    const s = own(newGame(2), 39, 1);
    expect(fail(s, { type: "mortgage", pos: 39 }, 0)).toBe("NOT_OWNER");
  });
});

describe("בנייה מותרת בכל עת", () => {
  it("מאפשרת לבנות גם כשזה לא תורך — נדרש לגיוס חירום", () => {
    let s = withGroup(SKY);
    s = setPhase(s, "awaiting_end");
    s.currentSeat = 1;
    s = act(s, { type: "build_house", pos: SKY[0]! }, 0);
    expect(s.deeds[SKY[0]!]!.houses).toBe(1);
  });
});
