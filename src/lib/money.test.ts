import { describe, it, expect } from "vitest";
import { transferFor, TRANSFER_LABEL } from "./money";
import type { GameEvent } from "@/engine/types";

const ev = (type: string, seat: number | null, payload: Record<string, unknown> = {}): GameEvent =>
  ({ seq: 1, type, seat, payload });

describe("מיפוי אירוע לתנועת כסף", () => {
  it("תשלום לשחקן אחר", () => {
    expect(transferFor(ev("pay", 0, { amount: 30_000, to: 2, reason: "rent" })))
      .toMatchObject({ from: 0, to: 2, amount: 30_000, reason: "rent" });
  });

  it("תשלום לבנק כש-to הוא null", () => {
    expect(transferFor(ev("pay", 1, { amount: 200_000, to: null, reason: "tax" })))
      .toMatchObject({ from: 1, to: "bank", amount: 200_000 });
  });

  it("מעבר בזינוק זורם מהבנק לשחקן", () => {
    expect(transferFor(ev("pass_start", 3, { amount: 200_000 })))
      .toMatchObject({ from: "bank", to: 3, amount: 200_000 });
  });

  it("קנייה, בנייה ופדיון זורמים אל הבנק", () => {
    for (const [type, key] of [["bought", "price"], ["house_built", "cost"],
                               ["unmortgaged", "cost"], ["auction_won", "amount"]] as const) {
      expect(transferFor(ev(type, 0, { [key]: 50_000 })))
        .toMatchObject({ from: 0, to: "bank", amount: 50_000 });
    }
  });

  it("משכון ומכירת בתים זורמים מהבנק", () => {
    expect(transferFor(ev("mortgaged", 1, { amount: 90_000 })))
      .toMatchObject({ from: "bank", to: 1 });
    expect(transferFor(ev("house_sold", 1, { refund: 25_000 })))
      .toMatchObject({ from: "bank", to: 1, amount: 25_000 });
  });

  it("מתעלם מ-rent_due — הוא מקדים את pay על אותו סכום", () => {
    // אחרת אותו תשלום היה מוצג פעמיים.
    expect(transferFor(ev("rent_due", 0, { amount: 30_000, to: 1 }))).toBeNull();
  });

  it("מתעלם מאירועים שאינם כספיים", () => {
    for (const t of ["rolled", "landed", "jailed", "turn_started", "auction_pass"]) {
      expect(transferFor(ev(t, 0, {}))).toBeNull();
    }
  });

  it("מתעלם מסכום אפס — אין מה להנפיש", () => {
    expect(transferFor(ev("pay", 0, { amount: 0, to: 1 }))).toBeNull();
    expect(transferFor(ev("card_cash", 0, {}))).toBeNull();
  });

  it("סכום שלילי מוצג בערכו המוחלט — הכיוון כבר מקודד ב-from/to", () => {
    expect(transferFor(ev("card_cash", 0, { amount: -50_000 })))
      .toMatchObject({ amount: 50_000, from: "bank", to: 0 });
  });

  it("לכל סיבה שהמנוע פולט יש תווית עברית", () => {
    const reasons = ["rent", "tax", "buy", "auction", "build", "sell", "mortgage",
                     "unmortgage", "start", "card", "jail_fine", "pot", "debt",
                     "card_repairs", "mortgage_transfer_fee"];
    for (const r of reasons) expect(TRANSFER_LABEL[r]).toBeTruthy();
  });
});
