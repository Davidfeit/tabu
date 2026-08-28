import { describe, it, expect } from "vitest";
import type { PeerState } from "@/net/mesh";
import { diagLines, needsDiag } from "./videoDiag";

const peer = (p: Partial<PeerState> & { id: string }): PeerState =>
  ({ stream: null, connection: "new", relayed: false, ...p });

describe("אבחון וידאו", () => {
  it("אומר כשאין בכלל מי להתחבר אליו", () => {
    const l = diagLines({ selfId: "abcd1234", wanted: [], peers: [] });
    expect(l[0]).toContain("מבוקשים: אין");
    expect(l.join(" ")).toContain("אף אחד אחר לא נמצא במצב המשחק");
  });

  it("מבחין בין 'לא נוצר חיבור' לבין 'חיבור שלא הצליח'", () => {
    const none = diagLines({ selfId: "me00", wanted: ["you0"], peers: [] });
    expect(none.join(" ")).toContain("לא נוצר אף RTCPeerConnection");

    const some = diagLines({ selfId: "me00", wanted: ["you0"],
                             peers: [peer({ id: "you0", connection: "failed" })] });
    expect(some.join(" ")).not.toContain("RTCPeerConnection");
    expect(some.join(" ")).toContain("failed");
  });

  it("יצא ולא חזר — מצביע על השידור, לא על ICE", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"],
                          peers: [peer({ id: "you0" })],
                          stats: { sent: 6, failed: 0, received: 0, forMe: 0 } });
    expect(l.join(" ")).toContain("השידור מהשרת לא מגיע לערוץ");
  });

  it("חזר אבל לא אליי — מצביע על המזהים", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"],
                          peers: [peer({ id: "you0" })],
                          stats: { sent: 6, failed: 0, received: 4, forMe: 0 } });
    expect(l.join(" ")).toContain("המזהים לא תואמים");
  });

  it("כשהכל זורם אין מה להציג", () => {
    const stream = {} as MediaStream;
    expect(needsDiag({ wanted: ["you0"], peers: [peer({ id: "you0", stream })] })).toBe(false);
    expect(needsDiag({ wanted: ["you0"], peers: [peer({ id: "you0" })] })).toBe(true);
    expect(needsDiag({ wanted: [], peers: [] })).toBe(false);
  });

  it("כשל ממסר מוצג כמות שהוא", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"], peers: [],
                          relayError: "הממסר נכשל: 500" });
    expect(l[l.length - 1]).toBe("הממסר נכשל: 500");
  });
});
