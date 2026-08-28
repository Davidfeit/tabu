import { describe, it, expect } from "vitest";
import { BOARD } from "@/lib/board";
import { reduce } from "./reduce";
import { createGame, defaultSettings, DEED_POSITIONS } from "./setup";
import { buildingUnits } from "./selectors";
import { seats } from "./testkit";
import type { Action, GameState, Settings } from "./types";

/**
 * שחקן אוטומטי פשוט: קונה כשאפשר, בונה כשיש עודף, מציע במכרז עד חצי מהמחיר.
 * לא אמור לשחק טוב — אמור להפעיל כל מסלול בקוד.
 */
function pickAction(s: GameState, seat: number, r: () => number): Action | null {
  if (s.drawnCard) return { type: "acknowledge_card" };

  if (s.phase === "auction" && s.auction) {
    const a = s.auction;
    if (a.passed.includes(seat)) return null;
    const price = BOARD.board[a.pos]!;
    const cap = ("price" in price ? price.price : 0) / 2;
    const next = (a.bid ?? 0) + 10;
    if (next <= cap && next <= s.players[seat]!.cash && r() < 0.6) {
      return { type: "auction_bid", amount: next };
    }
    return { type: "auction_pass" };
  }

  if (s.phase === "debt" && s.debt?.debtorSeat === seat) {
    // מנסה לגייס; אם אין מה למכור, מוותר.
    for (const pos of DEED_POSITIONS) {
      const d = s.deeds[pos]!;
      if (d.owner !== seat) continue;
      if (buildingUnits(s, d) > 0) return { type: "sell_house", pos };
      if (!d.mortgaged) return { type: "mortgage", pos };
    }
    return { type: "declare_bankruptcy" };
  }

  if (seat !== s.currentSeat) return null;

  switch (s.phase) {
    case "awaiting_roll": {
      const p = s.players[seat]!;
      if (p.inJail) {
        if (p.getOutCards > 0) return { type: "use_jail_card" };
        if (p.cash > 200 && r() < 0.5) return { type: "pay_jail_fine" };
      }
      return { type: "roll" };
    }
    case "awaiting_buy": {
      const price = BOARD.board[s.players[seat]!.pos]!;
      const cost = "price" in price ? price.price : 0;
      return s.players[seat]!.cash > cost * 2
        ? { type: "buy_property" }
        : { type: "decline_property" };
    }
    case "awaiting_end": {
      if (s.players[seat]!.cash > 600 && r() < 0.4) {
        for (const pos of DEED_POSITIONS) {
          const probe = reduce(s, { type: "build_house", pos }, { seat, now: 0, seed: "x" });
          if (probe.ok) return { type: "build_house", pos };
        }
      }
      return { type: "end_turn" };
    }
    default:
      return null;
  }
}

/** אינוריאנטים שחייבים להתקיים אחרי כל מהלך יחיד. */
function checkInvariants(s: GameState, where: string): void {
  for (const p of s.players) {
    if (p.cash < 0) throw new Error(`${where}: מזומן שלילי אצל מושב ${p.seat} (${p.cash})`);
    if (p.pos < 0 || p.pos >= 40) throw new Error(`${where}: מיקום לא חוקי ${p.pos}`);
    if (p.bankrupt && p.cash !== 0) throw new Error(`${where}: לשחקן שפשט רגל יש מזומן`);
  }

  // מלאי הבנק לעולם לא שלילי ולא חורג מההיצע ההתחלתי.
  let housesOnBoard = 0, hotelsOnBoard = 0;
  for (const pos of DEED_POSITIONS) {
    const d = s.deeds[pos]!;
    if (d.hotel) hotelsOnBoard++;
    housesOnBoard += d.houses;
    if (d.owner !== null && s.players[d.owner]!.bankrupt) {
      throw new Error(`${where}: שטר ${pos} בבעלות שחקן שפשט רגל`);
    }
    if (d.houses > s.settings.hotelThreshold) {
      throw new Error(`${where}: ${d.houses} בתים על ${pos}, מעל הסף`);
    }
    if (d.hotel && d.houses > 0) throw new Error(`${where}: ${pos} מלון ובתים יחד`);
  }
  if (s.bank.houses < 0 || s.bank.hotels < 0) {
    throw new Error(`${where}: מלאי בנק שלילי`);
  }
  if (s.bank.houses + housesOnBoard !== BOARD.meta.houseSupply) {
    throw new Error(`${where}: אבדו בתים — ${s.bank.houses} בבנק + ${housesOnBoard} על הלוח`);
  }
  if (s.bank.hotels + hotelsOnBoard !== BOARD.meta.hotelSupply) {
    throw new Error(`${where}: אבדו מלונות — ${s.bank.hotels} + ${hotelsOnBoard}`);
  }

  // אין יותר משני כרטיסי יציאה בכל הכלכלה.
  const heldCards = s.players.reduce((n, p) => n + p.getOutCards, 0);
  const inDecks = Object.values(s.decks).flat()
    .filter((id) => id === "kg15" || id === "yg16").length;
  if (heldCards + inDecks > 2) {
    throw new Error(`${where}: ${heldCards + inDecks} כרטיסי יציאה — נוצר כרטיס יש מאין`);
  }
}

/** PRNG קטן לבחירות הבוט. לא חלק מהמנוע. */
function lcg(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

interface RunResult { state: GameState; moves: number; }

function runGame(gameSeed: string, botSeed: number, players: number,
                 settings: Settings): RunResult {
  let s = createGame(seats(players), settings, gameSeed, 0);
  const r = lcg(botSeed);
  let now = 0;
  let moves = 0;

  for (; moves < 4000 && s.phase !== "finished"; moves++) {
    let acted = false;
    for (const p of s.players) {
      if (p.bankrupt) continue;
      const a = pickAction(s, p.seat, r);
      if (!a) continue;
      const res = reduce(s, a, { seat: p.seat, now, seed: gameSeed });
      if (res.ok) {
        s = res.state;
        checkInvariants(s, `${a.type}@${moves}`);
        acted = true;
        break;
      }
    }
    // אם איש לא הצליח לפעול, מקדמים את השעון מעבר לדדליין כדי לשבור תקיעות.
    if (!acted) {
      now = Math.max(now, (s.turnDeadline ?? now) + 1, (s.auction?.deadline ?? now) + 1);
      const res = reduce(s, { type: "claim_timeout" },
                         { seat: s.currentSeat, now, seed: gameSeed });
      if (!res.ok) throw new Error(`תקיעה: אין פעולה חוקית (${res.error}) בשלב ${s.phase}`);
      s = res.state;
      checkInvariants(s, `timeout@${moves}`);
    }
    now += 1000;
  }
  return { state: s, moves };
}

describe("סימולציית משחקים שלמים", () => {
  it("שומר על כל האינוריאנטים לאורך 40 משחקים מלאים", () => {
    for (let i = 0; i < 40; i++) {
      const players = 2 + (i % 5);
      const { state } = runGame(`g${i}`, i * 7919, players, defaultSettings("full"));
      expect(["finished", "awaiting_roll", "awaiting_end", "awaiting_buy", "auction", "debt"])
        .toContain(state.phase);
    }
  });

  it("משחקים מסתיימים במנצח יחיד", () => {
    let finished = 0;
    for (let i = 0; i < 25; i++) {
      const { state } = runGame(`f${i}`, i * 104729, 2, defaultSettings("full"));
      if (state.phase === "finished") {
        finished++;
        expect(state.winnerSeat).not.toBeNull();
        expect(state.players.filter((p) => !p.bankrupt)).toHaveLength(1);
      }
    }
    // ב-2 שחקנים כמעט כל משחק אמור להסתיים בגבול המהלכים.
    expect(finished).toBeGreaterThan(20);
  });

  it("מצב מהיר נגמר בזמן ומכריז מנצח לפי שווי נקי", () => {
    let byTime = 0;
    for (let i = 0; i < 15; i++) {
      const { state } = runGame(`q${i}`, i * 31337, 4, defaultSettings("quick"));
      expect(state.phase).toBe("finished");
      expect(state.winnerSeat).not.toBeNull();
      if (state.players.filter((p) => !p.bankrupt).length > 1) byTime++;
    }
    expect(byTime).toBeGreaterThan(0);   // לפחות אחד נגמר בתקרת הזמן
  });

  it("דטרמיניסטי: אותו זרע נותן בדיוק אותו משחק", () => {
    const a = runGame("determinism", 42, 3, defaultSettings("full"));
    const b = runGame("determinism", 42, 3, defaultSettings("full"));
    expect(a.moves).toBe(b.moves);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it("לא משנה את מצב הקלט — הרדוקר טהור", () => {
    const s = createGame(seats(2), defaultSettings("full"), "pure", 0);
    const snapshot = JSON.stringify(s);
    reduce(s, { type: "roll" }, { seat: s.currentSeat, now: 0, seed: "pure" });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
