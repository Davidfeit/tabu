import { describe, it, expect } from "vitest";
import { act, fail, newGame, own, setCash, setPhase, T0 } from "./testkit";
import type { TradeOffer } from "./types";

const EMPTY = { cash: 0, deeds: [] as number[], jailCards: 0 };

function offer(p: Partial<Omit<TradeOffer, "expiresAt">>): Omit<TradeOffer, "expiresAt"> {
  return { fromSeat: 0, toSeat: 1, give: { ...EMPTY }, receive: { ...EMPTY }, ...p };
}

describe("הצעת עסקה", () => {
  it("מחליפה מזומן ושטרות בין שני שחקנים", () => {
    let s = own(newGame(2), 39, 0);
    s = own(s, 6, 1);
    s = setPhase(s, "awaiting_end");
    s = act(s, { type: "propose_trade", offer: offer({
      give: { cash: 100, deeds: [39], jailCards: 0 },
      receive: { cash: 0, deeds: [6], jailCards: 0 },
    }) }, 0);
    expect(s.trade).not.toBeNull();
    const cash0 = s.players[0]!.cash, cash1 = s.players[1]!.cash;
    s = act(s, { type: "accept_trade" }, 1);
    expect(s.deeds[39]!.owner).toBe(1);
    expect(s.deeds[6]!.owner).toBe(0);
    expect(s.players[0]!.cash).toBe(cash0 - 100);
    expect(s.players[1]!.cash).toBe(cash1 + 100);
    expect(s.trade).toBeNull();
  });

  it("מחליפה כרטיסי יציאה", () => {
    let s = setPhase(newGame(2), "awaiting_end");
    s.players[0]!.getOutCards = 1;
    s = act(s, { type: "propose_trade", offer: offer({
      give: { cash: 0, deeds: [], jailCards: 1 },
      receive: { cash: 50, deeds: [], jailCards: 0 },
    }) }, 0);
    s = act(s, { type: "accept_trade" }, 1);
    expect(s.players[0]!.getOutCards).toBe(0);
    expect(s.players[1]!.getOutCards).toBe(1);
  });

  it("דוחה הצעה של שטר שאינו שלך", () => {
    let s = own(setPhase(newGame(2), "awaiting_end"), 39, 1);
    expect(fail(s, { type: "propose_trade", offer: offer({
      give: { cash: 0, deeds: [39], jailCards: 0 }, receive: { ...EMPTY },
    }) }, 0)).toBe("NOT_OWNER");
  });

  it("דוחה הצעה של מזומן שאין", () => {
    let s = setCash(setPhase(newGame(2), "awaiting_end"), 0, 1);
    expect(fail(s, { type: "propose_trade", offer: offer({
      give: { cash: 500, deeds: [], jailCards: 0 }, receive: { ...EMPTY },
    }) }, 0)).toBe("INSUFFICIENT_FUNDS");
  });

  it("חוסמת סחר בשטר שיש בנייה בקבוצת הצבע שלו", () => {
    // חוק חד-משמעי: לא רק על השטר עצמו, אלא בכל הקבוצה.
    let s = newGame(2);
    for (const p of [6, 8, 9]) s = own(s, p, 0);
    s = own(s, 8, 0, { houses: 1 });
    s = setPhase(s, "awaiting_end");
    expect(fail(s, { type: "propose_trade", offer: offer({
      give: { cash: 0, deeds: [6], jailCards: 0 }, receive: { ...EMPTY },
    }) }, 0)).toBe("HAS_BUILDINGS");
  });

  it("דוחה עסקה עם עצמך", () => {
    const s = setPhase(newGame(2), "awaiting_end");
    expect(fail(s, { type: "propose_trade", offer: offer({ toSeat: 0 }) }, 0))
      .toBe("INVALID_TRADE");
  });

  it("דוחה הצעה בשם מישהו אחר", () => {
    const s = setPhase(newGame(3), "awaiting_end");
    expect(fail(s, { type: "propose_trade", offer: offer({ fromSeat: 1 }) }, 0))
      .toBe("NOT_YOUR_TURN");
  });

  it("חוסמת עסקאות בזמן מכרז או גיוס כספים", () => {
    const s = setPhase(newGame(2), "debt");
    expect(fail(s, { type: "propose_trade", offer: offer({}) }, 0)).toBe("WRONG_PHASE");
  });
});

describe("קבלה ודחייה", () => {
  it("רק היעד יכול לקבל", () => {
    let s = setPhase(newGame(3), "awaiting_end");
    s = act(s, { type: "propose_trade", offer: offer({}) }, 0);
    expect(fail(s, { type: "accept_trade" }, 2)).toBe("NOT_TRADE_TARGET");
  });

  it("שני הצדדים יכולים לדחות", () => {
    let s = setPhase(newGame(2), "awaiting_end");
    s = act(s, { type: "propose_trade", offer: offer({}) }, 0);
    s = act(s, { type: "reject_trade" }, 0);
    expect(s.trade).toBeNull();
  });

  it("ההצעה פוקעת אחרי דקה", () => {
    let s = setPhase(newGame(2), "awaiting_end");
    s = act(s, { type: "propose_trade", offer: offer({}) }, 0);
    expect(fail(s, { type: "accept_trade" }, 1, T0 + 61_000)).toBe("NO_TRADE");
  });

  it("מאמתת מחדש בקבלה — המצב יכול היה להשתנות מאז ההצעה", () => {
    let s = own(setPhase(newGame(2), "awaiting_end"), 39, 0);
    s = act(s, { type: "propose_trade", offer: offer({
      give: { cash: 0, deeds: [39], jailCards: 0 }, receive: { ...EMPTY },
    }) }, 0);
    // המציע מימש את הנכס בינתיים
    s = structuredClone(s);
    s.deeds[39]!.owner = null;
    expect(fail(s, { type: "accept_trade" }, 1)).toBe("INVALID_TRADE");
    expect(s.deeds[39]!.owner).toBeNull();
  });

  it("המקבל משלם 10% על כל שטר משוכן שקיבל", () => {
    let s = own(setPhase(newGame(2), "awaiting_end"), 39, 0, { mortgaged: true });
    s = act(s, { type: "propose_trade", offer: offer({
      give: { cash: 0, deeds: [39], jailCards: 0 }, receive: { ...EMPTY },
    }) }, 0);
    const before = s.players[1]!.cash;
    s = act(s, { type: "accept_trade" }, 1);
    expect(s.players[1]!.cash).toBe(before - 21);   // 210,000 × 10%
    expect(s.deeds[39]!.mortgaged).toBe(true);          // נשאר משוכן
  });
});
