import { describe, expect, it } from "vitest";
import type { PeerState } from "@/net/mesh";
import { fakePeer } from "@/net/peer-fixture";
import { meshPeers } from "@/ui/useMesh";
import { gridClass, visibleVideoPlayers } from "./VideoTiles";

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
  fakePeer({ id, stream: s, connection: "connected" });

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

/**
 * מי נכנס לרשת הווידאו.
 *
 * הבאג שהיה כאן: הרשימה נגזרה מ-initial, המצב שנטען כשהמסך עלה. שחקן
 * שנכנס אחר כך — וזה בדיוק מה שקורה כשפותחים משחק ואז שולחים קישור —
 * לא נכנס לרשת אף פעם.
 */
describe("רשימת העמיתים לווידאו", () => {
  const p = (userId: string) => ({ userId });

  it("כוללת את כל השאר, בלי עצמי", () => {
    expect(meshPeers([p("a"), p("b"), p("c")], "b")).toEqual(["a", "c"]);
  });

  it("קולטת מצטרף חדש ברגע שהוא במצב", () => {
    const before = meshPeers([p("a")], "a");
    const after = meshPeers([p("a"), p("b")], "a");
    expect(before).toEqual([]);
    expect(after).toEqual(["b"]);
  });

  it("מסננת מזהים ריקים — שחקן בלי משתמש אינו עמית", () => {
    expect(meshPeers([p("a"), p(""), p("c")], "a")).toEqual(["c"]);
  });
});

/**
 * מי מקבל משבצת וידאו.
 *
 * שחקן טלפון (שלט) לא מריץ מצלמה, ומשבצת שחורה קבועה על שמו רק מקטינה
 * את הווידאו של אלה שכן.
 */
describe("משבצות וידאו דינמיות", () => {
  const P = (seat: number, userId: string) => ({ seat, userId });
  const all = [P(0, "me"), P(1, "pc"), P(2, "phone")];

  it("בזמן החסד כולם מוצגים — מי שנטען לאט לא נעלם", () => {
    expect(visibleVideoPlayers(all, "me", 0, [], true)).toHaveLength(3);
  });

  it("אחרי החסד: אני, ומי שנשמעו ממנו סימני חיים", () => {
    const peers = [
      fakePeer({ id: "pc", in: { offer: 1, answer: 0, ice: 2 } }),
      fakePeer({ id: "phone" }),               // קיים, ושותק לגמרי
    ];
    const shown = visibleVideoPlayers(all, "me", 0, peers, false);
    expect(shown.map((p) => p.userId)).toEqual(["me", "pc"]);
  });

  it("זרם נחשב סימן חיים גם בלי סיגנלינג שנספר", () => {
    const peers = [fakePeer({ id: "phone", stream: {} as MediaStream })];
    expect(visibleVideoPlayers(all, "me", 0, peers, false).map((p) => p.userId))
      .toContain("phone");
  });

  it("הרשת קבועה 2×2 ולא זזה עם מספר המשתתפים", () => {
    // מקום קבוע לכל מושב: משבצות שמשנות גודל בכל הצטרפות או עזיבה מבלבלות
    // יותר ממה שהן חוסכות בשטח.
    for (const n of [1, 2, 3, 4]) expect(gridClass(n)).toBe("grid-cols-2 grid-rows-2");
  });

  it("מי ששולח תמונות סטילס נשאר על המסך גם בלי סיגנלינג", () => {
    const shown = visibleVideoPlayers(all, "me", 0, [], false, new Set(["phone"]));
    expect(shown.map((p) => p.userId)).toEqual(["me", "phone"]);
  });
});
