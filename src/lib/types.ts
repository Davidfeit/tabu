/** טיפוסי נתוני הלוח. תואמים ל-data/board.json. */

export type GroupKey =
  | "sand" | "sky" | "rose" | "copper" | "crimson" | "olive" | "green" | "azure";

export type DeckKey = "kupat_gemel" | "yad_hagoral";

export interface Group {
  key: GroupKey;
  name: string;
  color: string;
  /** צבע הטקסט שעובר ניגודיות מעל color. תכלת וזית דורשים כהה. */
  textOn: string;
  icon: IconKey;
  houseCost: number;
  size: number;
}

export type IconKey =
  | "dune" | "wave" | "peak" | "copper" | "anemone" | "olive" | "cypress" | "anchor";

export type CornerKey = "start" | "jail" | "rest" | "goto_jail";

interface SquareBase { pos: number; name: string }

export interface CornerSquare extends SquareBase {
  type: "corner";
  key: CornerKey;
  subtitle?: string;
}
export interface PropertySquare extends SquareBase {
  type: "property";
  group: GroupKey;
  region: string;
  price: number;
  /** [בסיס, 1 בית, 2, 3, 4, מלון] */
  rent: [number, number, number, number, number, number];
  mortgage: number;
}
export interface TransportSquare extends SquareBase {
  type: "transport";
  price: number;
  /** שכ"ד לפי מספר צמתים בבעלות: [1, 2, 3, 4] */
  rent: [number, number, number, number];
  mortgage: number;
}
export interface UtilitySquare extends SquareBase {
  type: "utility";
  price: number;
  /** מכפיל סכום הקוביות: [אחת בבעלות, שתיים] */
  multipliers: [number, number];
  mortgage: number;
}
export interface CardSquare extends SquareBase { type: "card"; deck: DeckKey }
export interface TaxSquare extends SquareBase { type: "tax"; amount: number }

export type Square =
  | CornerSquare | PropertySquare | TransportSquare | UtilitySquare | CardSquare | TaxSquare;

/** משבצת שאפשר להחזיק בבעלות. */
export type Deed = PropertySquare | TransportSquare | UtilitySquare;

export interface BoardMeta {
  name: string;
  locale: string;
  currency: string;
  startingCash: number;
  passStartBonus: number;
  houseSupply: number;
  hotelSupply: number;
  mortgageRate: number;
  unmortgageInterest: number;
  jailFine: number;
  maxJailTurns: number;
  minPlayers: number;
  maxPlayers: number;
}

export interface BoardData {
  meta: BoardMeta;
  groups: Group[];
  board: Square[];
  decks: Record<DeckKey, unknown[]>;
  tokens: { key: string; name: string }[];
  modes: Record<string, BoardMode>;
}

/** מה שמצב משחק רשאי לדרוס מעל meta. הכל אופציונלי — מה שחסר יורש. */
export interface BoardMode {
  name?: string;
  auctions?: boolean;
  hotelThreshold?: number;
  hardLimitMinutes?: number | null;
  startingCash?: number;
  passStartBonus?: number;
  rentSurgeAfterMinutes?: number;
  rentSurgeMultiplier?: number;
}

export function isDeed(sq: Square): sq is Deed {
  return sq.type === "property" || sq.type === "transport" || sq.type === "utility";
}
