import { describe, it, expect } from "vitest";
import { netWorth, liquidValue } from "./selectors";
import { act, fail, newGame, own, place, setCash, setPhase, withRoll } from "./testkit";

const SKY = [6, 8, 9];

describe("גיוס כספים", () => {
  function inDebt(amount = 100_000) {
    let s = own(newGame(3), 39, 0);         // תל אביב, שווי משכון ₪210,000
    s = setCash(s, 0, 1_000);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: 1, amount, deadline: s.turnDeadline! + 60_000 };
    return s;
  }

  it("נסגר מעצמו ברגע שיש מזומן — אין פעולת תשלום נפרדת", () => {
    let s = inDebt(100_000);
    const creditorBefore = s.players[1]!.cash;
    s = act(s, { type: "mortgage", pos: 39 }, 0);
    expect(s.debt).toBeNull();
    expect(s.players[1]!.cash).toBe(creditorBefore + 100_000);
    expect(s.players[0]!.cash).toBe(1_000 + 210_000 - 100_000);
  });

  it("לא מאפשר לוותר כשיש נכסים לכסות את החוב", () => {
    const s = inDebt(100_000);
    expect(fail(s, { type: "declare_bankruptcy" }, 0)).toBe("CAN_PAY");
  });

  it("מאפשר לוותר כשבאמת אין כיסוי", () => {
    let s = inDebt(900_000);
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.players[0]!.bankrupt).toBe(true);
  });

  it("חיסול אוטומטי בטיימאאוט מוכר וממשכן עד לכיסוי", () => {
    let s = inDebt(100_000);
    const late = s.debt!.deadline! + 1;
    s = act(s, { type: "claim_timeout" }, 1, late);
    expect(s.debt).toBeNull();
    expect(s.players[0]!.bankrupt).toBe(false);
    expect(s.deeds[39]!.mortgaged).toBe(true);
  });

  it("מוכר בתים לפני שממשכן", () => {
    let s = newGame(3);
    for (const p of SKY) s = own(s, p, 0, { houses: 2 });
    s = setCash(s, 0, 0);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: 1, amount: 50_000, deadline: s.turnDeadline! };
    s = act(s, { type: "claim_timeout" }, 1, s.turnDeadline! + 1);
    expect(s.debt).toBeNull();
    // כוסה במכירת בתים בלבד; אף שטר לא מושכן
    expect(SKY.every((p) => !s.deeds[p]!.mortgaged)).toBe(true);
    expect(s.bank.houses).toBeGreaterThan(32 - 6);
  });
});

describe("פשיטת רגל לשחקן", () => {
  function setup() {
    let s = newGame(3);
    for (const p of SKY) s = own(s, p, 0, { houses: 1 });
    s = own(s, 39, 0, { mortgaged: true });
    s = setCash(s, 0, 5_000);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: 1, amount: 9_000_000, deadline: null };
    return s;
  }

  it("מעביר מזומן, שטרות וסטטוס משכון לנושה", () => {
    let s = setup();
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.players[0]!.cash).toBe(0);
    for (const p of [...SKY, 39]) expect(s.deeds[p]!.owner).toBe(1);
    expect(s.deeds[39]!.mortgaged).toBe(true);   // סטטוס המשכון נשמר
  });

  it("מפרק בתים ומעביר את תמורתם לנושה — בתים לא עוברים בין שחקנים", () => {
    let s = setup();
    const housesBefore = s.bank.houses;
    s = act(s, { type: "declare_bankruptcy" }, 0);
    for (const p of SKY) {
      expect(s.deeds[p]!.houses).toBe(0);
      expect(s.deeds[p]!.hotel).toBe(false);
    }
    expect(s.bank.houses).toBe(housesBefore + 3);
  });

  it("גובה מהנושה 10% על כל שטר משוכן שקיבל", () => {
    let s = setup();
    const before = s.players[1]!.cash;
    s = act(s, { type: "declare_bankruptcy" }, 0);
    // מקבל: 5,000 מזומן + 3 × 25,000 פירוק בתים = 80,000
    // משלם: 10% על משכון תל אביב = 21,000
    expect(s.players[1]!.cash).toBe(before + 5_000 + 75_000 - 21_000);
  });

  it("מעביר כרטיסי יציאה לנושה", () => {
    let s = setup();
    s.players[0]!.getOutCards = 2;
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.players[1]!.getOutCards).toBe(2);
    expect(s.players[0]!.getOutCards).toBe(0);
  });
});

describe("פשיטת רגל לבנק", () => {
  it("מוציא את כל השטרות למכרז, בסדר מיקום עולה", () => {
    let s = newGame(3);
    s = own(s, 39, 0); s = own(s, 6, 0); s = own(s, 24, 0);
    s = setCash(s, 0, 0);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: null, amount: 9_000_000, deadline: null };
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.phase).toBe("auction");
    expect(s.auction!.pos).toBe(6);
    expect(s.auction!.queue).toEqual([24, 39]);
  });

  it("מוציא למכרז גם שטרות משוכנים", () => {
    let s = own(newGame(3), 39, 0, { mortgaged: true });
    s = setCash(s, 0, 0);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: null, amount: 9_000_000, deadline: null };
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.auction!.pos).toBe(39);
  });
});

describe("תנאי ניצחון", () => {
  it("המשחק נגמר כשנשאר שחקן אחד", () => {
    let s = own(newGame(2), 39, 0);
    s = setCash(s, 0, 0);
    s = setPhase(s, "debt");
    s.debt = { debtorSeat: 0, creditorSeat: 1, amount: 9_000_000, deadline: null };
    s = act(s, { type: "declare_bankruptcy" }, 0);
    expect(s.phase).toBe("finished");
    expect(s.winnerSeat).toBe(1);
  });

  it("סיום מתוזמן נקבע לפי שווי נקי", () => {
    let s = newGame(3, { mode: "quick", hardLimitMinutes: 60 });
    s = own(s, 39, 1);                       // תל אביב לשחקן 1
    s = setPhase(s, "awaiting_end");
    const late = s.startedAt + 61 * 60_000;
    s = act(s, { type: "claim_timeout" }, s.currentSeat, late);
    expect(s.phase).toBe("finished");
    expect(s.winnerSeat).toBe(1);
  });
});

describe("חישובי שווי", () => {
  it("שווי נקי סופר מזומן, שטרות ובנייה", () => {
    let s = own(newGame(2), 6, 0, { houses: 2 });
    s = setCash(s, 0, 100_000);
    // 100,000 + 90,000 (מחיר דימונה) + 2 × 50,000 בתים
    expect(netWorth(s, 0)).toBe(290_000);
  });

  it("שווי נקי סופר שטר משוכן בשווי המשכון", () => {
    let s = own(newGame(2), 39, 0, { mortgaged: true });
    s = setCash(s, 0, 0);
    expect(netWorth(s, 0)).toBe(210_000);
  });

  it("שווי מימוש סופר בתים בחצי מחיר", () => {
    let s = own(newGame(2), 6, 0, { houses: 2 });
    s = setCash(s, 0, 0);
    // 45,000 (משכון דימונה) + 2 × 25,000
    expect(liquidValue(s, 0)).toBe(95_000);
  });
});

describe("שחקן שפשט רגל", () => {
  it("לא יכול לפעול", () => {
    const s = newGame(3);
    s.players[2]!.bankrupt = true;
    expect(fail(s, { type: "roll" }, 2)).toBe("PLAYER_BANKRUPT");
  });

  it("מדולג בסבב התורות", () => {
    let s = place(withRoll(newGame(3), 1, 2), 0, 20);
    s.currentSeat = 0;
    s.players[1]!.bankrupt = true;
    s = setPhase(s, "awaiting_end");
    s = act(s, { type: "end_turn" }, 0);
    expect(s.currentSeat).toBe(2);
  });
});
