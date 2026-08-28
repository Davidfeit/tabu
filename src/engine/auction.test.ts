import { describe, it, expect } from "vitest";
import { AUCTION_OPENING } from "./auction";
import { act, fail, newGame, place, setCash, withRoll, T0 } from "./testkit";

/** מביא את השחקן בתור לנחיתה על תל אביב ומוותר, כדי לפתוח מכרז. */
function openAuctionAt39(players = 3) {
  let s = place(withRoll(newGame(players), 3, 4), 0, 32);
  s.currentSeat = 0;
  s = act(s, { type: "roll" }, 0);
  return act(s, { type: "decline_property" }, 0);
}

describe("פתיחת מכרז", () => {
  it("ויתור מוציא את השטר למכרז", () => {
    const s = openAuctionAt39();
    expect(s.phase).toBe("auction");
    expect(s.auction!.pos).toBe(39);
    expect(s.auction!.declinedBy).toBe(0);
    expect(s.auction!.bid).toBeNull();
  });

  it("כשמכרזים כבויים, השטר פשוט חוזר לבנק", () => {
    let s = place(withRoll(newGame(2, { auctions: false }), 3, 4), 0, 32);
    s.currentSeat = 0;
    s = act(s, { type: "roll" }, 0);
    s = act(s, { type: "decline_property" }, 0);
    expect(s.phase).toBe("awaiting_end");
    expect(s.deeds[39]!.owner).toBeNull();
  });
});

describe("הצעות", () => {
  it("גם מי שוויתר רשאי להשתתף", () => {
    let s = openAuctionAt39();
    s = act(s, { type: "auction_bid", amount: AUCTION_OPENING }, 0);
    expect(s.auction!.bidderSeat).toBe(0);
  });

  it("דוחה הצעה מתחת למחיר הפתיחה", () => {
    const s = openAuctionAt39();
    expect(fail(s, { type: "auction_bid", amount: 5 }, 1)).toBe("BID_TOO_LOW");
  });

  it("דורשת מדרגה מינימלית מעל ההצעה הקודמת", () => {
    let s = openAuctionAt39();
    s = act(s, { type: "auction_bid", amount: 50 }, 1);
    expect(fail(s, { type: "auction_bid", amount: 55 }, 2)).toBe("BID_TOO_LOW");
    s = act(s, { type: "auction_bid", amount: 60 }, 2);
    expect(s.auction!.bid).toBe(60);
  });

  it("תקרת ההצעה היא מזומן ביד — אין משכון באמצע מכרז", () => {
    let s = openAuctionAt39();
    s = setCash(s, 1, 30);
    expect(fail(s, { type: "auction_bid", amount: 40 }, 1)).toBe("INSUFFICIENT_FUNDS");
  });

  it("פאס הוא בלתי הפיך", () => {
    let s = openAuctionAt39();
    s = act(s, { type: "auction_pass" }, 1);
    expect(fail(s, { type: "auction_bid", amount: 100 }, 1)).toBe("ALREADY_PASSED");
    expect(fail(s, { type: "auction_pass" }, 1)).toBe("ALREADY_PASSED");
  });
});

describe("סגירת מכרז", () => {
  it("נסגר כשנשאר מציע אחד, ומעביר בעלות תמורת ההצעה", () => {
    let s = openAuctionAt39();
    const before = s.players[1]!.cash;
    s = act(s, { type: "auction_bid", amount: 100 }, 1);
    s = act(s, { type: "auction_pass" }, 0);
    s = act(s, { type: "auction_pass" }, 2);
    expect(s.deeds[39]!.owner).toBe(1);
    expect(s.players[1]!.cash).toBe(before - 100);
    expect(s.auction).toBeNull();
    expect(s.phase).toBe("awaiting_end");
  });

  it("כשכולם פוסחים, השטר נשאר של הבנק", () => {
    let s = openAuctionAt39();
    for (const seat of [0, 1, 2]) s = act(s, { type: "auction_pass" }, seat);
    expect(s.deeds[39]!.owner).toBeNull();
    expect(s.phase).toBe("awaiting_end");
  });

  it("נסגר בטיימאאוט לטובת ההצעה הגבוהה", () => {
    let s = openAuctionAt39();
    s = act(s, { type: "auction_bid", amount: 80 }, 2);
    const late = s.auction!.deadline! + 1;
    s = act(s, { type: "claim_timeout" }, 1, late);
    expect(s.deeds[39]!.owner).toBe(2);
  });

  it("השטר הנרכש תמיד לא משוכן", () => {
    let s = openAuctionAt39();
    s.deeds[39]!.mortgaged = true;
    s = act(s, { type: "auction_bid", amount: AUCTION_OPENING }, 1);
    s = act(s, { type: "auction_pass" }, 0);
    s = act(s, { type: "auction_pass" }, 2);
    expect(s.deeds[39]!.mortgaged).toBe(false);
  });
});

describe("טיימר המכרז", () => {
  it("מתקצר ככל שיש יותר משתתפים שפסחו", () => {
    let s = openAuctionAt39(4);
    s = act(s, { type: "auction_bid", amount: 10 }, 1);
    const first = s.auction!.deadline! - T0;
    s = act(s, { type: "auction_pass" }, 2);
    s = act(s, { type: "auction_bid", amount: 20 }, 3);
    const second = s.auction!.deadline! - T0;
    expect(second).toBeLessThan(first);
  });
});
