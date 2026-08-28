import { describe, expect, it } from "vitest";
import type { PeerState } from "@/net/mesh";
import { peerHint } from "./VideoTiles";

const peer = (connection: RTCPeerConnectionState): PeerState =>
  ({ id: "p", stream: null, connection, relayed: false });

describe("סיבת היעדר וידאו", () => {
  // שלושת המצבים נראו זהים על המסך, ולכן כל תקלה נראתה כמו אותה תקלה.
  it("אין עמית בכלל — הסיגנלינג לא הגיע", () => {
    expect(peerHint(undefined)).toMatch(/סיגנלינג/);
  });

  it("החיבור נכשל — חסר ממסר", () => {
    expect(peerHint(peer("failed"))).toMatch(/ממסר/);
  });

  it("מחובר אבל בלי מסלול וידאו", () => {
    expect(peerHint(peer("connected"))).toMatch(/בלי וידאו/);
  });

  it("בדרך", () => {
    expect(peerHint(peer("connecting"))).toBe("מתחבר…");
    expect(peerHint(peer("new"))).toBe("מתחבר…");
  });

  it("כל מצב מקבל טקסט, בלי undefined שקט", () => {
    const all: RTCPeerConnectionState[] =
      ["new", "connecting", "connected", "disconnected", "failed", "closed"];
    for (const c of all) expect(peerHint(peer(c))).toBeTruthy();
  });
});
