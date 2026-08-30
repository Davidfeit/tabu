import { BOARD, SQUARES } from "@/lib/board";
import { isDeed, type DeckKey } from "@/lib/types";
import { shuffle } from "./rng";
import type { GameState, Player, Settings } from "./types";

export interface SeatSpec { userId: string; name: string; token: string }

const MODE_DEFAULTS: Record<Settings["mode"], Partial<Settings>> = {
  // turnSeconds: null בכל המצבים — שעון על התור הפך משחק משפחתי ללחוץ.
  full:  { auctions: true,  hotelThreshold: 4, turnSeconds: null, hardLimitMinutes: null,
           rentSurgeAfterMinutes: null },
  quick: { auctions: false, hotelThreshold: 3, turnSeconds: null, hardLimitMinutes: 60,
           rentSurgeAfterMinutes: 45 },
  blitz: { auctions: false, hotelThreshold: 2, turnSeconds: null, hardLimitMinutes: 30,
           rentSurgeAfterMinutes: 20 },
};

/**
 * הכלכלה נגזרת מ-data/board.json ולא משוכפלת כאן.
 *
 * שכפול הערכים אכן היה כאן, ובשינוי קנה המידה של הסכומים הוא התפצל מהמקור
 * בשקט: הלוח אמר 1,500 והמנוע המשיך לחלק 1,500,000. מקור אמת אחד מונע את
 * החזרה של זה.
 */
const MODE_CASH: Record<Settings["mode"], { cash: number; pass: number; dealt: number }> = {
  full:  modeCash("full"),
  quick: modeCash("quick"),
  blitz: modeCash("blitz"),
};

function modeCash(mode: Settings["mode"]): { cash: number; pass: number; dealt: number } {
  const m = BOARD.modes[mode] ?? {};
  return {
    cash: m.startingCash ?? BOARD.meta.startingCash,
    pass: m.passStartBonus ?? BOARD.meta.passStartBonus,
    dealt: m.dealtProperties ?? 0,
  };
}

export function defaultSettings(mode: Settings["mode"] = "quick"): Settings {
  return {
    mode,
    auctions: true,
    hotelThreshold: 4,
    turnSeconds: null,
    hardLimitMinutes: null,
    rentSurgeAfterMinutes: null,
    rentSurgeMultiplier: 1.5,
    // חוקי בית שמאריכים משחקים — כבויים כברירת מחדל, ראה spec §5.9.
    eilatJackpot: false,
    doubleOnStart: false,
    ...MODE_DEFAULTS[mode],
  };
}

/** מזומן הפתיחה של המצב. משמש גם בהצטרפות למשחק שכבר רץ. */
export function startingCash(s: Settings): number {
  return MODE_CASH[s.mode].cash;
}

export function passStartBonus(s: Settings): number {
  return MODE_CASH[s.mode].pass;
}

/** כל המיקומים שאפשר להחזיק בבעלות, בסדר עולה. */
export const DEED_POSITIONS: number[] = SQUARES.filter(isDeed).map((s) => s.pos);

/**
 * הקמת משחק.
 *
 * סדר התורות נגזר מזרע השרת ולא מגלגול אינטראקטיבי: אונליין, "כל אחד מגלגל
 * פעם אחת" הוא חמש שניות של המתנה בלי שום החלטה. התוצאה מתועדת ביומן וניתנת
 * לשחזור מהזרע.
 */
export function createGame(
  seats: SeatSpec[],
  settings: Settings,
  seed: string,
  now: number,
): GameState {
  if (seats.length < BOARD.meta.minPlayers || seats.length > BOARD.meta.maxPlayers) {
    throw new RangeError(`מספר שחקנים לא חוקי: ${seats.length}`);
  }
  const order = shuffle(seats, seed, 1);
  const { cash, dealt } = MODE_CASH[settings.mode];

  const players: Player[] = order.map((s, i) => ({
    seat: i, userId: s.userId, name: s.name, token: s.token,
    cash, pos: 0, inJail: false, jailTurns: 0, getOutCards: 0,
    bankrupt: false, skipNextTurn: false,
  }));

  const deeds: GameState["deeds"] = {};
  for (const pos of DEED_POSITIONS) deeds[pos] = { owner: null, houses: 0, hotel: false, mortgaged: false };

  // מצבים מקוצרים מחלקים נכסים בפתיחה כדי לקצר את שלב האיסוף.
  if (dealt > 0) {
    const pool = shuffle(DEED_POSITIONS, seed, 2);
    for (let i = 0; i < dealt * players.length && i < pool.length; i++) {
      deeds[pool[i]!]!.owner = players[i % players.length]!.seat;
    }
  }

  const decks = {} as Record<DeckKey, string[]>;
  for (const key of ["kupat_gemel", "yad_hagoral"] as DeckKey[]) {
    const ids = (BOARD.decks[key] as { id: string }[]).map((c) => c.id);
    decks[key] = shuffle(ids, seed, key === "kupat_gemel" ? 3 : 4);
  }

  return {
    seq: 0,
    phase: "awaiting_roll",
    players,
    currentSeat: 0,
    dice: null,
    doublesCount: 0,
    deeds,
    bank: { houses: BOARD.meta.houseSupply, hotels: BOARD.meta.hotelSupply },
    decks,
    drawnCard: null,
    auction: null,
    trade: null,
    debt: null,
    pendingMove: null,
    pot: 0,
    turnDeadline: settings.turnSeconds === null
      ? null : now + settings.turnSeconds * 1000,
    startedAt: now,
    finishedAt: null,
    winnerSeat: null,
    settings,
  };
}
