import { describe, expect, it } from "vitest";
import type { PeerState } from "@/net/mesh";
import { fakePeer } from "@/net/peer-fixture";
import { peerHint } from "./VideoTiles";

const peer = (connection: RTCPeerConnectionState): PeerState =>
  fakePeer({ id: "p", connection });

/**
 * מה שכתוב על משבצת בלי וידאו.
 *
 * הטקסט הזה נקרא ע"י מי שיושב לשחק, ולכן הוא בשפה שלו: "ICE נכשל —
 * נדרש ממסר TURN" נכון לגמרי ולא עוזר לאף אחד. ההבחנות הטכניות חיות
 * בשורות האבחון, שמופיעות רק כשמדליקים אותן במפורש.
 */
describe("מה כתוב על משבצת בלי וידאו", () => {
  it("בזמן ההתחברות — מתחבר, בלי ז'רגון", () => {
    for (const c of ["new", "connecting"] as RTCPeerConnectionState[]) {
      expect(peerHint(peer(c))).toBe("מתחבר…");
    }
    expect(peerHint(undefined)).toBe("מתחבר…");
  });

  it("חיבור שנוצר בלי תמונה — זו המצלמה שלו, וזה מה שנאמר", () => {
    expect(peerHint(peer("connected"))).toBe("המצלמה שלו כבויה");
  });

  it("כשל אמיתי נאמר בפשטות, בלי ICE ובלי TURN", () => {
    const failed = peerHint(peer("failed"))!;
    expect(failed).toBe("אין חיבור וידאו");
    expect(failed).not.toMatch(/ICE|TURN/);
  });

  it("כשל ממסר גובר על מצב החיבור — הוא הסיבה, לא התסמין", () => {
    expect(peerHint(peer("new"), "השרת ישן")).toBe("השרת ישן");
  });

  it("כל מצב מקבל טקסט, בלי undefined שקט", () => {
    const all: RTCPeerConnectionState[] =
      ["new", "connecting", "connected", "disconnected", "failed", "closed"];
    for (const c of all) expect(peerHint(peer(c))).toBeTruthy();
  });
});
