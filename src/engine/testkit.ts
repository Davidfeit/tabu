import { rollDice } from "./rng";
import { createGame, defaultSettings, type SeatSpec } from "./setup";
import { reduce } from "./reduce";
import type { Action, GameState, Settings } from "./types";

export const T0 = 1_700_000_000_000;
export const SEED = "test-seed";

export function seats(n: number): SeatSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    userId: `u${i}`, name: `שחקן ${i}`, token: `t${i}`,
  }));
}

export function newGame(n = 2, overrides: Partial<Settings> = {}): GameState {
  return createGame(seats(n), { ...defaultSettings("full"), ...overrides }, SEED, T0);
}

/** מריץ פעולה ומצפה להצלחה; זורק עם קוד השגיאה אם נכשלה. */
export function act(s: GameState, a: Action, seat = s.currentSeat, now = T0): GameState {
  const r = reduce(s, a, { seat, now, seed: SEED });
  if (!r.ok) throw new Error(`הפעולה ${a.type} נכשלה: ${r.error}`);
  return r.state;
}

/** מריץ פעולה ומצפה לכישלון; מחזיר את קוד השגיאה. */
export function fail(s: GameState, a: Action, seat = s.currentSeat, now = T0): string {
  const r = reduce(s, a, { seat, now, seed: SEED });
  if (r.ok) throw new Error(`הפעולה ${a.type} הצליחה למרות שהיה עליה להיכשל`);
  return r.error;
}

/** מציב שחקן במיקום ומצב ידועים, לבידוד תרחיש. */
export function place(
  s: GameState, seat: number, pos: number, patch: Partial<GameState["players"][0]> = {},
): GameState {
  const c = structuredClone(s);
  Object.assign(c.players[seat]!, { pos, ...patch });
  return c;
}

export function own(
  s: GameState, pos: number, seat: number,
  patch: Partial<GameState["deeds"][0]> = {},
): GameState {
  const c = structuredClone(s);
  Object.assign(c.deeds[pos]!, { owner: seat, ...patch });
  return c;
}

export function setCash(s: GameState, seat: number, cash: number): GameState {
  const c = structuredClone(s);
  c.players[seat]!.cash = cash;
  return c;
}

export function setPhase(s: GameState, phase: GameState["phase"]): GameState {
  const c = structuredClone(s);
  c.phase = phase;
  return c;
}

/** מכריח תוצאת קוביות ידועה ע"י חיפוש seq שמפיק אותה. */
export function seqForRoll(
  want: (d1: number, d2: number) => boolean, seed = SEED,
): number {
  for (let seq = 0; seq < 200_000; seq++) {
    const [a, b] = rollDice(seed, seq);
    if (want(a, b)) return seq;
  }
  throw new Error("לא נמצא seq שמפיק את הגלגול המבוקש");
}

/** מכין מצב שבו הגלגול הבא ייתן בדיוק את הקוביות המבוקשות. */
export function withRoll(s: GameState, d1: number, d2: number): GameState {
  const c = structuredClone(s);
  c.seq = seqForRoll((a, b) => a === d1 && b === d2);
  return c;
}

export function totalCash(s: GameState): number {
  return s.players.reduce((n, p) => n + p.cash, 0);
}

/**
 * מנווט מצב כלשהו אל סוף התור: מוותר על קניות, פוסח על מכרזים, מאשר קלפים.
 * חוסך מכל טסט לדעת מה בדיוק יש במשבצת שאליה נחת הגלגול.
 */
export function toEndOfTurn(s: GameState, now = T0): GameState {
  for (let guard = 0; guard < 60; guard++) {
    if (s.drawnCard) { s = act(s, { type: "acknowledge_card" }, s.currentSeat, now); continue; }
    switch (s.phase) {
      case "awaiting_buy":
        s = act(s, { type: "decline_property" }, s.currentSeat, now);
        continue;
      case "auction": {
        const open = s.players.find(
          (p) => !p.bankrupt && !s.auction!.passed.includes(p.seat),
        );
        if (!open) return s;
        s = act(s, { type: "auction_pass" }, open.seat, now);
        continue;
      }
      case "debt":
        s = act(s, { type: "declare_bankruptcy" }, s.debt!.debtorSeat, now);
        continue;
      default:
        return s;
    }
  }
  throw new Error("toEndOfTurn לא התכנס");
}
