import type { GameEvent } from "@/engine/types";

/** צד בתנועת כסף. "bank" הוא הבנק, כולל מסים וקנסות. */
export type Party = number | "bank";

export interface Transfer {
  seq: number;
  from: Party;
  to: Party;
  amount: number;
  /** מפתח קצר לתווית שמופיעה על השטר המעופף. */
  reason: string;
}

const seatOf = (e: GameEvent): Party => (e.seat === null ? "bank" : e.seat);
const num = (v: unknown): number => Math.abs(Number(v ?? 0));

/**
 * ממפה אירוע משחק לתנועת כסף להנפשה.
 *
 * לא כל אירוע כספי מיוצג: `rent_due` מקדים את `pay` על אותו סכום, ולכן
 * שניהם יחד היו מציגים את אותו תשלום פעמיים.
 */
export function transferFor(e: GameEvent): Transfer | null {
  const mk = (from: Party, to: Party, amount: number, reason: string): Transfer | null =>
    amount > 0 ? { seq: e.seq, from, to, amount, reason } : null;

  const me = seatOf(e);
  const p = e.payload;

  switch (e.type) {
    case "pay": {
      const to = p.to === null || p.to === undefined ? "bank" : Number(p.to);
      return mk(me, to, num(p.amount), String(p.reason ?? "pay"));
    }
    case "debt_settled": {
      const to = p.to === null || p.to === undefined ? "bank" : Number(p.to);
      return mk(me, to, num(p.amount), "debt");
    }
    case "pass_start":          return mk("bank", me, num(p.amount), "start");
    case "start_landing_bonus": return mk("bank", me, num(p.amount), "start");
    case "card_cash":           return mk("bank", me, num(p.amount), "card");
    case "pot_collected":       return mk("bank", me, num(p.amount), "pot");
    case "mortgaged":           return mk("bank", me, num(p.amount), "mortgage");
    case "house_sold":
    case "hotel_sold":          return mk("bank", me, num(p.refund), "sell");
    case "bought":              return mk(me, "bank", num(p.price), "buy");
    case "auction_won":         return mk(me, "bank", num(p.amount), "auction");
    case "unmortgaged":         return mk(me, "bank", num(p.cost), "unmortgage");
    case "house_built":
    case "hotel_built":         return mk(me, "bank", num(p.cost), "build");
    case "jail_paid":           return mk(me, "bank", num(p.amount), "jail");
    default:                    return null;
  }
}

/** תוויות עבריות קצרות לשטר המעופף. */
export const TRANSFER_LABEL: Record<string, string> = {
  rent: "שכר דירה",
  tax: "מס",
  buy: "קנייה",
  auction: "מכרז",
  build: "בנייה",
  sell: "מכירה",
  mortgage: "משכון",
  unmortgage: "פדיון",
  start: "זינוק",
  card: "קלף",
  jail: "ערובה",
  jail_fine: "ערובה",
  pot: "קופה",
  debt: "חוב",
  card_repairs: "שיפוצים",
  mortgage_transfer_fee: "ריבית",
  pay: "תשלום",
};
