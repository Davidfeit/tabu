import { describe, expect, it } from "vitest";
import type { PeerState } from "@/net/mesh";

/**
 * השיוך המקוון: משבצת → עמית, לפי מזהה המשתמש.
 *
 * הבאג שהיה במקביל במסלול המקומי: העמית נבחר לפי אינדקס המושב, כך שעמית
 * יחיד ישב באינדקס 0 בזמן שהמושב השני חיפש את peers[1]. הזרם היה שם ולא
 * הוצג לעולם. כאן נבדק שהשיוך מבוסס זהות ולא מיקום.
 */
function pickStream(
  players: { seat: number; userId: string }[],
  peers: PeerState[],
  mySeat: number,
  local: MediaStream | null,
): (MediaStream | null)[] {
  const byUser = new Map(peers.map((p) => [p.id, p]));
  return players.map((p) =>
    p.seat === mySeat ? local : byUser.get(p.userId)?.stream ?? null);
}

const stream = (tag: string) => ({ tag } as unknown as MediaStream);
const peer = (id: string, s: MediaStream | null): PeerState =>
  ({ id, stream: s, connection: "connected", relayed: false });

describe("שיוך זרמים למושבים במשחק מקוון", () => {
  const players = [
    { seat: 0, userId: "u-alice" },
    { seat: 1, userId: "u-bob" },
    { seat: 2, userId: "u-carol" },
  ];

  it("כל אחד רואה את עצמו במקומי ואת האחרים בזרם שלהם", () => {
    const local = stream("me");
    const got = pickStream(players, [
      peer("u-bob", stream("bob")),
      peer("u-carol", stream("carol")),
    ], 0, local);
    expect(got[0]).toBe(local);
    expect((got[1] as unknown as { tag: string }).tag).toBe("bob");
    expect((got[2] as unknown as { tag: string }).tag).toBe("carol");
  });

  it("סדר העמיתים לא משנה — השיוך לפי זהות", () => {
    const reversed = pickStream(players, [
      peer("u-carol", stream("carol")),
      peer("u-bob", stream("bob")),
    ], 0, null);
    expect((reversed[1] as unknown as { tag: string }).tag).toBe("bob");
    expect((reversed[2] as unknown as { tag: string }).tag).toBe("carol");
  });

  it("עמית חסר משאיר את המשבצת בלי זרם, ולא גונב זרם של אחר", () => {
    const got = pickStream(players, [peer("u-carol", stream("carol"))], 0, null);
    expect(got[1]).toBeNull();
    expect((got[2] as unknown as { tag: string }).tag).toBe("carol");
  });

  it("עמית מחובר בלי זרם אינו מזליג זרם ממשבצת אחרת", () => {
    const got = pickStream(players, [
      peer("u-bob", null), peer("u-carol", stream("carol")),
    ], 0, null);
    expect(got[1]).toBeNull();
  });
});
