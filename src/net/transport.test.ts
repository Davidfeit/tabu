import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BroadcastTransport, SupabaseTransport } from "./transport";
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

describe("SupabaseTransport — ערוצים פרטיים", () => {
  interface Opened { topic: string; opts?: { config?: { private?: boolean } } }

  function fakeRealtime() {
    const opened: Opened[] = [];
    const sent: unknown[] = [];
    const sb = {
      channel(topic: string, opts?: Opened["opts"]) {
        opened.push({ topic, opts });
        return {
          on() { return this; },
          subscribe() { return this; },
          send(m: unknown) { sent.push(m); return Promise.resolve("ok"); },
          unsubscribe() { return Promise.resolve("ok"); },
        };
      },
      removeChannel() { return Promise.resolve("ok"); },
    };
    return { sb, opened, sent };
  }

  // הבאג שהיה: subscribe פתח ערוץ פרטי ו-send פתח ערוץ רגיל באותו שם.
  // אלה שני ערוצים שונים אצל Supabase, וההודעה נעלמה בלי שגיאה.
  it("גם השליחה וגם ההאזנה פותחות ערוץ פרטי", () => {
    const { sb, opened } = fakeRealtime();
    const t = new SupabaseTransport(sb as never);
    t.subscribe("me", () => {});
    t.send("you", { kind: "ice", from: "me", candidates: [] });

    expect(opened).toHaveLength(2);
    for (const ch of opened) {
      expect(ch.opts?.config?.private).toBe(true);
    }
  });

  it("שולחת אל תיבת הדואר של הנמען, ומאזינה לשלה", () => {
    const { sb, opened } = fakeRealtime();
    const t = new SupabaseTransport(sb as never);
    t.subscribe("me", () => {});
    t.send("you", { kind: "ice", from: "me", candidates: [] });
    expect(opened.map((c) => c.topic)).toEqual(["sig:me", "sig:you"]);
  });
});
