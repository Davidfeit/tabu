import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _resetRoomChannels } from "./roomChannel";
import { BroadcastTransport, RoomTransport } from "./transport";
import type { SignalMessage } from "./signaling";

/**
 * BroadcastChannel אינו קיים ב-environment: "node" של vitest.
 * מימוש מינימלי בזיכרון מספיק כדי לבדוק את לוגיקת התעבורה עצמה.
 */
class FakeChannel {
  static buses = new Map<string, Set<FakeChannel>>();
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public name: string) {
    const bus = FakeChannel.buses.get(name) ?? new Set<FakeChannel>();
    bus.add(this);
    FakeChannel.buses.set(name, bus);
  }
  postMessage(data: unknown) {
    for (const peer of FakeChannel.buses.get(this.name) ?? []) {
      // BroadcastChannel אמיתי לא מחזיר לשולח עצמו.
      if (peer !== this) peer.onmessage?.({ data: structuredClone(data) });
    }
  }
  close() { FakeChannel.buses.get(this.name)?.delete(this); }
}

beforeEach(() => {
  FakeChannel.buses.clear();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const offer = (from: string): SignalMessage => ({ kind: "offer", from, sdp: "v=0" });

describe("תעבורה בין כרטיסיות", () => {
  it("מעבירה הודעה לעמית הנכון בלבד", () => {
    const a = new BroadcastTransport("t1");
    const b = new BroadcastTransport("t1");
    const c = new BroadcastTransport("t1");
    const gotB: SignalMessage[] = [], gotC: SignalMessage[] = [];
    b.subscribe("B", (m) => gotB.push(m));
    c.subscribe("C", (m) => gotC.push(m));

    a.send("B", offer("A"));
    expect(gotB).toHaveLength(1);
    expect(gotC).toHaveLength(0);   // הודעה ממוענת, לא שידור לכולם
    a.close(); b.close(); c.close();
  });

  it("לא מחזירה הודעה לשולח עצמו", () => {
    const a = new BroadcastTransport("t2");
    const got: SignalMessage[] = [];
    a.subscribe("A", (m) => got.push(m));
    a.send("A", offer("A"));
    expect(got).toHaveLength(0);
    a.close();
  });

  it("מגלה עמיתים דרך presence", () => {
    vi.useFakeTimers();
    const a = new BroadcastTransport("t3");
    const b = new BroadcastTransport("t3");
    let peersOfA: string[] = [];
    a.presence("A", (ids) => { peersOfA = ids; });
    b.presence("B", () => {});
    vi.advanceTimersByTime(1600);
    expect(peersOfA).toContain("B");
    a.close(); b.close();
  });

  it("שוכחת עמית שנעלם", () => {
    vi.useFakeTimers();
    const a = new BroadcastTransport("t4");
    const b = new BroadcastTransport("t4");
    let peers: string[] = [];
    a.presence("A", (ids) => { peers = ids; });
    const stopB = b.presence("B", () => {});
    vi.advanceTimersByTime(1600);
    expect(peers).toContain("B");

    stopB(); b.close();
    vi.advanceTimersByTime(6000);
    expect(peers).not.toContain("B");
    a.close();
  });

  it("ניתוק מפסיק לקבל הודעות", () => {
    const a = new BroadcastTransport("t5");
    const b = new BroadcastTransport("t5");
    const got: SignalMessage[] = [];
    const stop = b.subscribe("B", (m) => got.push(m));
    a.send("B", offer("A"));
    expect(got).toHaveLength(1);
    stop();
    a.send("B", offer("A"));
    expect(got).toHaveLength(1);
    a.close(); b.close();
  });
});

describe("RoomTransport — סיגנלינג על ערוץ החדר", () => {
  // ערוץ החדר משותף בין צרכנים, ולכן הוא נשמר במפה ברמת המודול.
  beforeEach(_resetRoomChannels);

  function fake() {
    const opened: { topic: string; opts?: { config?: { private?: boolean } } }[] = [];
    const handlers: ((m: { payload: unknown }) => void)[] = [];
    const removed: unknown[] = [];
    const sb = {
      channel(topic: string, opts?: { config?: { private?: boolean } }) {
        opened.push({ topic, opts });
        const ch = {
          on(_e: string, _f: unknown, cb: (m: { payload: unknown }) => void) {
            handlers.push(cb); return ch;
          },
          subscribe() { return ch; },
          send() { return Promise.resolve("ok"); },
        };
        return ch;
      },
      removeChannel(ch: unknown) { removed.push(ch); return Promise.resolve("ok"); },
    };
    return { sb, opened, handlers, removed };
  }

  const msg: SignalMessage = { kind: "ice", from: "me", candidates: [] };

  it("מאזין לערוץ החדר, פרטי — אותו ערוץ שמצב המשחק כבר זורם עליו", () => {
    const { sb, opened } = fake();
    new RoomTransport(sb as never, "room-1", async () => {}).subscribe("me", () => {});
    expect(opened).toEqual([{ topic: "room:room-1",
      // presence מופעל מראש: המאזין נוסף רק כשהווידאו עולה, ואז מאוחר מדי.
      opts: { config: { private: true, presence: { enabled: true } } } }]);
  });

  it("מוסר רק הודעות שמיועדות לי", () => {
    const { sb, handlers } = fake();
    const got: unknown[] = [];
    new RoomTransport(sb as never, "r", async () => {}).subscribe("me", (m) => got.push(m));
    // השידור מגיע לכל חברי החדר, ולכן הסינון חייב לקרות אצל המקבל.
    handlers[0]!({ payload: { to: "someone-else", message: msg } });
    handlers[0]!({ payload: { to: "me", message: msg } });
    expect(got).toEqual([msg]);
  });

  it("מתעלם משידור בלי גוף הודעה, בלי לזרוק", () => {
    const { sb, handlers } = fake();
    const got: unknown[] = [];
    new RoomTransport(sb as never, "r", async () => {}).subscribe("me", (m) => got.push(m));
    expect(() => handlers[0]!({ payload: { to: "me" } })).not.toThrow();
    expect(() => handlers[0]!({ payload: undefined })).not.toThrow();
    expect(got).toEqual([]);
  });

  it("שולח דרך הממסר, אל הנמען", async () => {
    const { sb } = fake();
    const sent: [string, unknown][] = [];
    const t = new RoomTransport(sb as never, "r", async (to, m) => { sent.push([to, m]); });
    t.send("you", msg);
    await Promise.resolve();
    expect(sent).toEqual([["you", msg]]);
  });

  it("כשל בממסר לא מפיל את הלקוח — perfect negotiation מתאושש", async () => {
    const { sb } = fake();
    const t = new RoomTransport(sb as never, "r", async () => { throw new Error("500"); });
    expect(() => t.send("you", msg)).not.toThrow();
    await Promise.resolve();
  });
});
