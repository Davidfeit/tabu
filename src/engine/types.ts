import type { DeckKey } from "@/lib/types";

/** שלב התור. קובע אילו פעולות חוקיות. */
export type Phase =
  | "awaiting_roll"    // השחקן בתור חייב לגלגל (או לשלם ערובה / לממש כרטיס)
  | "awaiting_buy"     // נחת על שטר פנוי — לקנות או לוותר
  | "auction"          // מכרז פעיל
  | "awaiting_end"     // המשבצת נפתרה; אפשר לבנות/לסחור ואז לסיים תור
  | "debt"             // חוב שאין לו כיסוי במזומן — גיוס כספים
  | "finished";

export interface Player {
  seat: number;
  userId: string;
  name: string;
  token: string;
  cash: number;
  pos: number;
  inJail: boolean;
  /** מספר ניסיונות הכפולים שנכשלו. 0–3. */
  jailTurns: number;
  getOutCards: number;
  bankrupt: boolean;
  skipNextTurn: boolean;
}

export interface DeedState {
  owner: number | null;   // seat
  /** 0 עד settings.hotelThreshold. מלון הוא שדה נפרד. */
  houses: number;
  /**
   * מלון מיוצג בנפרד ולא כ-"houses = 5".
   * במצב מהיר הסף הוא 3 בתים, ו-5 מול 3 היה שובר את חוק הבנייה השווה
   * (max − min ≤ 1). ליחידות בנייה משתמשים ב-buildingUnits().
   */
  hotel: boolean;
  mortgaged: boolean;
}

export interface Auction {
  pos: number;
  /** ההצעה הגבוהה, או null אם עוד לא הוצעה. */
  bid: number | null;
  bidderSeat: number | null;
  passed: number[];
  /** מי הגיע לכאן ע"י ויתור, או null אם זו חלוקת עיזבון. */
  declinedBy: number | null;
  /** תור מכרזי נוסף (חיסול עיזבון), במיקומים עולים. */
  queue: number[];
  deadline: number | null;
}

export interface TradeOffer {
  fromSeat: number;
  toSeat: number;
  give: { cash: number; deeds: number[]; jailCards: number };
  receive: { cash: number; deeds: number[]; jailCards: number };
  expiresAt: number;
}

export interface Debt {
  debtorSeat: number;
  /** null = לבנק. אחרת מושב הנושה. */
  creditorSeat: number | null;
  amount: number;
  deadline: number | null;
}

export interface Settings {
  mode: "full" | "quick" | "blitz";
  auctions: boolean;
  hotelThreshold: number;
  turnSeconds: number;
  hardLimitMinutes: number | null;
  rentSurgeAfterMinutes: number | null;
  rentSurgeMultiplier: number;
  /** חוקי בית שמאריכים משחקים. כבויים כברירת מחדל — ראה spec §5.9. */
  eilatJackpot: boolean;
  doubleOnStart: boolean;
}

export interface GameState {
  seq: number;
  phase: Phase;
  players: Player[];
  currentSeat: number;
  dice: [number, number] | null;
  /** כפולים רצופים בתור הנוכחי. שלושה ← מעצר בית. */
  doublesCount: number;
  /** מיקום → מצב השטר. רק מיקומים שאפשר להחזיק בבעלות. */
  deeds: Record<number, DeedState>;
  bank: { houses: number; hotels: number };
  /** מזהי קלפים בסדר החפיסה. נמשכים מהראש, חוזרים לתחתית. */
  decks: Record<DeckKey, string[]>;
  /** קלף שנמשך וממתין לאישור השחקן. */
  drawnCard: { deck: DeckKey; id: string } | null;
  auction: Auction | null;
  trade: TradeOffer | null;
  debt: Debt | null;
  /**
   * סכום קוביות שממתין להחלה אחרי פתרון חוב.
   *
   * התרחיש: הניסיון השלישי לגלגל כפולים נכשל, השחקן חייב לשלם ערובה, אבל
   * אין לו מזומן ויש לו נכסים. הוא נכנס לגיוס כספים, והתנועה שכבר גולגלה
   * חייבת להישמר — אחרת הגלגול נעלם.
   */
  pendingMove: number | null;
  /** קופת חופשה באילת. תמיד 0 אלא אם eilatJackpot דלוק. */
  pot: number;
  turnDeadline: number | null;
  startedAt: number;
  finishedAt: number | null;
  winnerSeat: number | null;
  settings: Settings;
}

// ── פעולות ────────────────────────────────────────────────────────────────

export type Action =
  | { type: "roll" }
  | { type: "buy_property" }
  | { type: "decline_property" }
  | { type: "auction_bid"; amount: number }
  | { type: "auction_pass" }
  | { type: "build_house"; pos: number }
  | { type: "sell_house"; pos: number }
  | { type: "mortgage"; pos: number }
  | { type: "unmortgage"; pos: number }
  | { type: "pay_jail_fine" }
  | { type: "use_jail_card" }
  | { type: "acknowledge_card" }
  | { type: "propose_trade"; offer: Omit<TradeOffer, "expiresAt"> }
  | { type: "accept_trade" }
  | { type: "reject_trade" }
  | { type: "end_turn" }
  | { type: "declare_bankruptcy" }
  | { type: "claim_timeout" };

export type ActionType = Action["type"];

/** פעולה בהקשר: מי ביצע, ומתי לפי שעון השרת. */
export interface Ctx {
  seat: number;
  now: number;
  /** זרע השרת. לעולם לא נחשף ללקוח עד סיום המשחק. */
  seed: string;
}

// ── אירועים ───────────────────────────────────────────────────────────────

export interface GameEvent {
  seq: number;
  type: string;
  seat: number | null;
  /** מפתח הודעה + פרמטרים. הלוקליזציה ב-UI, לא כאן. */
  payload: Record<string, unknown>;
}

/** קודי שגיאה מכונתיים. הניסוח העברי חי ב-UI. */
export type ErrorCode =
  | "NOT_YOUR_TURN" | "WRONG_PHASE" | "INSUFFICIENT_FUNDS" | "NOT_OWNER"
  | "NOT_FOR_SALE" | "ALREADY_OWNED" | "NOT_A_DEED" | "GROUP_INCOMPLETE"
  | "UNEVEN_BUILD" | "NO_HOUSES_LEFT" | "NO_HOTELS_LEFT" | "HAS_BUILDINGS"
  | "ALREADY_MORTGAGED" | "NOT_MORTGAGED" | "MAX_DEVELOPED" | "NO_BUILDINGS"
  | "NOT_IN_JAIL" | "NO_JAIL_CARD" | "BID_TOO_LOW" | "ALREADY_PASSED"
  | "NO_AUCTION" | "NO_TRADE" | "NOT_TRADE_TARGET" | "INVALID_TRADE"
  | "GAME_OVER" | "PLAYER_BANKRUPT" | "DEADLINE_NOT_REACHED" | "NO_DEBT"
  | "CAN_PAY" | "UNKNOWN_ACTION";

export type Result =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ErrorCode };
