import { describe, expect, it } from "vitest";
import type { PeerState } from "@/net/mesh";
import { peerHint } from "./VideoTiles";

const peer = (connection: RTCPeerConnectionState): PeerState =>
  ({ id: "p", stream: null, connection, relayed: false });

describe("סיבת היעדר וידאו", () => {
  // שלושת המצבים נראו זהים על המסך, ולכן כל תקלה נראתה כמו אותה תקלה.
  it("אין עמית בכלל", () => {
    expect(peerHint(undefined)).toMatch(/לא נוצר חיבור/);
  });

  // ההבחנה המכריעה: new פירושו שאף הודעת סיגנלינג לא הגיעה מהצד השני,
  // ואילו connecting פירושו שההודעות עברו ו-ICE כבר מנסה. שני העולמות
  // האלה נראו "מתחבר…" ולכן היו בלתי ניתנים להבחנה.
  it("new = הסיגנלינג לא הגיע; connecting = הגיע ו-ICE מנסה", () => {
    expect(peerHint(peer("new"))).toMatch(/הסיגנלינג לא הגיע/);
    expect(peerHint(peer("connecting"))).toMatch(/ICE/);
    expect(peerHint(peer("new"))).not.toBe(peerHint(peer("connecting")));
  });

  it("כשל ממסר גובר על מצב החיבור — הוא הסיבה, לא התסמין", () => {
    expect(peerHint(peer("new"), "השרת ישן")).toBe("השרת ישן");
  });

  it("החיבור נכשל — חסר ממסר", () => {
    expect(peerHint(peer("failed"))).toMatch(/ממסר/);
  });

  it("מחובר אבל בלי מסלול וידאו", () => {
    expect(peerHint(peer("connected"))).toMatch(/בלי וידאו/);
  });



  it("כל מצב מקבל טקסט, בלי undefined שקט", () => {
    const all: RTCPeerConnectionState[] =
      ["new", "connecting", "connected", "disconnected", "failed", "closed"];
    for (const c of all) expect(peerHint(peer(c))).toBeTruthy();
  });
});
