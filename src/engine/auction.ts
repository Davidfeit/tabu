import { charge, emit } from "./economy";
import { activePlayers, deedAt, player } from "./selectors";
import type { GameEvent, GameState } from "./types";

export const AUCTION_OPENING = 10_000;
export const AUCTION_INCREMENT = 10_000;
const BASE_MS = 12_000;
const FLOOR_MS = 4_000;

/** הטיימר מתקצר ככל שיש יותר הצעות, כדי שמכרז ער לא יימשך לנצח. */
function timerFor(bidCount: number): number {
  return Math.max(FLOOR_MS, BASE_MS - bidCount * 1_500);
}

export function openAuction(
  s: GameState, events: GameEvent[], pos: number, declinedBy: number | null,
  queue: number[], now: number,
): void {
  s.auction = {
    pos, bid: null, bidderSeat: null, passed: [], declinedBy, queue,
    deadline: now + BASE_MS,
  };
  s.phase = "auction";
  emit(s, events, "auction_opened", declinedBy, { pos, name: deedAt(pos).name });
}

export function bid(
  s: GameState, events: GameEvent[], seat: number, amount: number, now: number,
): "BID_TOO_LOW" | "ALREADY_PASSED" | "INSUFFICIENT_FUNDS" | null {
  const a = s.auction!;
  if (a.passed.includes(seat)) return "ALREADY_PASSED";

  const minimum = a.bid === null ? AUCTION_OPENING : a.bid + AUCTION_INCREMENT;
  if (!Number.isInteger(amount) || amount < minimum) return "BID_TOO_LOW";
  // תקרת ההצעה היא מזומן ביד. אין משכון באמצע מכרז.
  if (player(s, seat).cash < amount) return "INSUFFICIENT_FUNDS";

  a.bid = amount;
  a.bidderSeat = seat;
  a.deadline = now + timerFor(a.passed.length + 1);
  emit(s, events, "auction_bid", seat, { pos: a.pos, amount });
  return null;
}

export function pass(
  s: GameState, events: GameEvent[], seat: number, now: number,
): "ALREADY_PASSED" | null {
  const a = s.auction!;
  if (a.passed.includes(seat)) return "ALREADY_PASSED";
  a.passed.push(seat);
  emit(s, events, "auction_pass", seat, { pos: a.pos });
  maybeSettle(s, events, now);
  return null;
}

/** מי עדיין רשאי להציע. */
function contenders(s: GameState): number[] {
  const a = s.auction!;
  return activePlayers(s).map((p) => p.seat).filter((seat) => !a.passed.includes(seat));
}

/** האם המכרז הבשיל לסגירה — כולם פסחו חוץ מאחד, או שהטיימר פג. */
export function maybeSettle(
  s: GameState, events: GameEvent[], now: number, force = false,
): void {
  const a = s.auction;
  if (!a) return;
  const left = contenders(s);
  const timedOut = a.deadline !== null && now >= a.deadline;
  const decided = left.length <= 1 && (a.bid !== null || left.length === 0);
  if (!force && !timedOut && !decided) return;
  settle(s, events, now);
}

function settle(s: GameState, events: GameEvent[], now: number): void {
  const a = s.auction!;
  if (a.bidderSeat !== null && a.bid !== null) {
    s.deeds[a.pos]!.owner = a.bidderSeat;
    s.deeds[a.pos]!.mortgaged = false;
    charge(s, events, a.bidderSeat, a.bid, null, "auction");
    emit(s, events, "auction_won", a.bidderSeat, { pos: a.pos, amount: a.bid });
  } else {
    // כולם פסחו במחיר הפתיחה: השטר חוזר לבנק ויוצע שוב רק בנחיתה הבאה.
    emit(s, events, "auction_unsold", null, { pos: a.pos });
  }

  const next = a.queue.shift();
  if (next !== undefined) {
    openAuction(s, events, next, null, a.queue, now);
    return;
  }
  s.auction = null;
  if (s.phase === "auction") s.phase = "awaiting_end";
}
