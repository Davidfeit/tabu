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
  /** על איזו משבצת מדובר, אם יש כזו. זהו ה"על מה" של התשלום. */
  pos: number | null;
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
  const me = seatOf(e);
  const p = e.payload;
  const pos = typeof p?.pos === "number" ? p.pos : null;
  const mk = (from: Party, to: Party, amount: number, reason: string): Transfer | null =>
    amount > 0 ? { seq: e.seq, from, to, amount, reason, pos } : null;

  switch (e.type) {
    case "pay": {
      const to = p.to === null || p.to === undefined ? "bank" : Number(p.to);
      return mk(me, to, num(p.amount), String(p.reason ?? "pay"));
    }
    case "debt_settled": {
      const to = p.to === null || p.to === undefined ? "bank" : Number(p.to);
      // סגירת חוב נושאת את הסיבה המקורית, כדי שגם היא תדע לומר על מה.
      return mk(me, to, num(p.amount), String(p.reason ?? "debt"));
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
/**
 * ניסוח מלא של תנועת כסף: על מה, ולא רק כמה.
 *
 * `deedName` מסופק ע"י הקורא כדי ש-money.ts יישאר בלי תלות בנתוני הלוח,
 * וכך ניתן לבדיקה בלי לטעון אותם.
 */
export function transferTitle(t: Transfer, deedName: (pos: number) => string): string {
  const label = TRANSFER_LABEL[t.reason] ?? "תשלום";
  if (t.pos === null) return label;
  const place = deedName(t.pos);
  if (!place) return label;
  switch (t.reason) {
    case "rent":       return `שכר דירה על ${place}`;
    case "buy":        return `קניית ${place}`;
    case "auction":    return `${place} במכרז`;
    case "build":      return `בנייה ב${place}`;
    case "sell":       return `מכירת בנייה ב${place}`;
    case "mortgage":   return `משכון ${place}`;
    case "unmortgage": return `פדיון ${place}`;
    case "tax":        return place;
    case "jail_fine":
    case "jail":       return "ערובה למעצר בית";
    case "mortgage_transfer_fee": return `ריבית משכון על ${place}`;
    default:           return `${label} · ${place}`;
  }
}

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
