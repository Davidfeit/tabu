import { describe, expect, it } from "vitest";
import { BOARD } from "@/lib/board";
import { reduce } from "./reduce";
import { startingCash } from "./setup";
import { act, fail, newGame, setPhase, T0 } from "./testkit";

const joiner = { type: "add_player" as const, userId: "u-new", name: "רן", token: "boat" };

describe("הצטרפות למשחק שכבר התחיל", () => {
  it("מקבל מושב חדש בסוף השולחן, עם מזומן פתיחה ובלי נכסים", () => {
    const before = newGame(2);
    const s = act(before, joiner, 0);
    expect(s.players).toHaveLength(3);

    const p = s.players[2]!;
    expect(p.seat).toBe(2);
    expect(p.userId).toBe("u-new");
    expect(p.cash).toBe(startingCash(s.settings));
    expect(p.pos).toBe(0);
    expect(p.bankrupt).toBe(false);
    // חלוקת נכסים בפתיחה כבר קרתה; לתת אותם עכשיו היה מתגמל איחור.
    const owned = Object.values(s.deeds).filter((d) => d.owner === 2);
    expect(owned).toHaveLength(0);
  });

  it("לא משבש את התור שרץ", () => {
    const before = newGame(2);
    const s = act(before, joiner, 0);
    expect(s.currentSeat).toBe(before.currentSeat);
    expect(s.phase).toBe(before.phase);
  });

  it("אותו משתמש לא מצטרף פעמיים", () => {
    const s = act(newGame(2), joiner, 0);
    expect(fail(s, joiner, 0)).toBe("ALREADY_IN_GAME");
  });

  it("לא מעבר למספר המושבים", () => {
    let s = newGame(BOARD.meta.maxPlayers);
    expect(fail(s, joiner, 0)).toBe("ROOM_FULL");
  });

  it("נרשם ביומן, כדי שהשולחן יראה מי נכנס", () => {
    const r = reduce(newGame(2), joiner, { seat: 0, now: T0, seed: "s" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.map((e) => e.type)).toContain("player_joined");
  });

  it("המצטרף נכנס לסבב התורים", () => {
    // אחרי הוספתו, סיום תור מגיע אליו בסופו של הסבב — כלומר הוא באמת
    // בשולחן ולא רק ברשימה.
    let s = act(newGame(2), joiner, 0);
    const seen = new Set<number>();
    for (let guard = 0; guard < 10 && seen.size < 3; guard++) {
      seen.add(s.currentSeat);
      s = act(setPhase(s, "awaiting_end"), { type: "end_turn" }, s.currentSeat);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
