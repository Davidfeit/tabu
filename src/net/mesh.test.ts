import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PeerMesh, type PeerState } from "./mesh";
import type { SignalMessage } from "./signaling";

/**
 * RTCPeerConnection מזויף — מספיק נאמן כדי לבדוק את המשא ומתן.
 *
 * זה מה שחסר כדי לבדוק את שכבת הווידאו בכלל: בלעדיו כל תקלה במשא ומתן
 * מתגלה רק בדפדפן של מישהו אחר, ונראית שם כמו ריבוע שחור. הכללים כאן הם
 * אלה שבאמת מכתיבים את ההתנהגות: מה מותר בכל signalingState, ושמועמד
 * ICE לפני תיאור מרוחק נדחה.
 */
class FakePC {
  static instances: FakePC[] = [];
  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addedIce: RTCIceCandidateInit[] = [];
  /** דוחה כל תיאור מרוחק — כדי לבדוק שהשגיאה מדווחת ולא נבלעת. */
  rejectRemote = false;

  constructor() { FakePC.instances.push(this); }

  private queued = false;
  addTrack() {
    // כמו בדפדפן: כל המסלולים שנוספים ברצף מפיקים אירוע אחד, והוא נורה
    // רק כשאפשר להציע. שני אירועים היו מייצרים כאן תקלה שלא קיימת.
    if (!this.queued) {
      this.queued = true;
      queueMicrotask(() => {
        this.queued = false;
        if (this.signalingState === "stable") this.onnegotiationneeded?.();
      });
    }
    return { getParameters: () => ({ encodings: [{}] }), setParameters: async () => {} };
  }

  async setLocalDescription(d?: { type: string }) {
    if (d?.type === "rollback") {
      if (this.signalingState !== "have-local-offer") {
        throw new Error(`גלגול לאחור ב-${this.signalingState}`);
      }
      this.localDescription = null;
      this.signalingState = "stable";
      return;
    }
    if (this.signalingState === "stable") {
      this.localDescription = { type: "offer", sdp: "local-offer" };
      this.signalingState = "have-local-offer";
    } else if (this.signalingState === "have-remote-offer") {
      this.localDescription = { type: "answer", sdp: "local-answer" };
      this.signalingState = "stable";
      this.settle();
    } else {
      throw new Error(`setLocalDescription ב-${this.signalingState}`);
    }
  }

  async setRemoteDescription(d: { type: string; sdp: string }) {
    if (this.rejectRemote) throw new Error("Failed to parse SessionDescription");
    if (d.type === "offer") {
      // גלגול לאחור מרומז, כמו בדפדפן: הצעה נכנסת מבטלת הצעה מקומית.
      this.remoteDescription = d;
      this.signalingState = "have-remote-offer";
      return;
    }
    if (this.signalingState !== "have-local-offer") {
      throw new Error(`תשובה ב-${this.signalingState}`);
    }
    this.remoteDescription = d;
    this.signalingState = "stable";
    this.settle();
  }

  async addIceCandidate(c: RTCIceCandidateInit) {
    if (!this.remoteDescription) throw new Error("אין תיאור מרוחק");
    this.addedIce.push(c);
  }

  /** שני התיאורים הוחלו — כאן ICE מתחיל, וכאן גם מגיע הזרם. */
  private settle() {
    this.connectionState = "connecting";
    this.onconnectionstatechange?.();
    this.ontrack?.({ streams: [{ id: "remote" } as MediaStream] });
  }

  /** ICE הצליח. בדפדפן זה קורה מעצמו; כאן מפורשות. */
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }

  emitCandidate(id: string) {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: id }) } as RTCIceCandidate });
  }

  async getStats() { return new Map(); }
  restartIce() {}
  close() { this.connectionState = "closed"; }
}

const stream = () => ({
  getTracks: () => [{ kind: "video" }, { kind: "audio" }],
} as unknown as MediaStream);

beforeEach(() => {
  FakePC.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePC);
});
afterEach(() => vi.unstubAllGlobals());

/** זוג רשתות שמדברות זו עם זו, עם שליטה על סדר המסירה. */
function pair(opts: { deliver?: boolean; glareMs?: number } = {}) {
  const queue: { to: string; msg: SignalMessage }[] = [];
  const meshes: Record<string, PeerMesh> = {};
  const states: Record<string, PeerState[]> = { a: [], b: [] };

  const make = (id: string) => new PeerMesh({
    selfId: id, localStream: stream(), iceServers: [],
    iceBatchMs: 0, glareMs: opts.glareMs ?? 20,
    send: (to, msg) => {
      queue.push({ to, msg });
      if (opts.deliver !== false) void flush();
    },
    onPeersChanged: (p) => { states[id] = p; },
  });

  const flush = async () => {
    while (queue.length) {
      const { to, msg } = queue.shift()!;
      await meshes[to]?.handle(msg);
    }
  };

  meshes.a = make("a");   // "a" < "b", ולכן a מנומס
  meshes.b = make("b");
  return { meshes, states, queue, flush };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe("משא ומתן בין שני עמיתים", () => {
  it("מחליפים הצעה ותשובה ומגיעים לזרם", async () => {
    const { meshes, states, flush } = pair();
    meshes.a.sync(["b"]);
    meshes.b.sync(["a"]);
    await settle();
    await flush();
    await settle();

    expect(states.a[0]!.stream).not.toBeNull();
    expect(states.b[0]!.stream).not.toBeNull();
    expect(states.a[0]!.lastError).toBeNull();
    expect(states.b[0]!.lastError).toBeNull();
    // בהתנגשות אחד מהם עונה. מה שאסור הוא ששניהם יתעלמו.
    expect(states.a[0]!.out.answer + states.b[0]!.out.answer).toBeGreaterThan(0);
  });

  it("מועמד ICE שהקדים את ההצעה לא הולך לאיבוד", async () => {
    // זה הסדר שקורה באמת: שני הצדדים שולחים במקביל, ואין הבטחה שההצעה
    // תגיע ראשונה. עד עכשיו כל מועמד כזה נזרק בשקט.
    const { meshes, states, flush } = pair({ deliver: false });
    meshes.a.sync(["b"]);
    await settle();

    await meshes.b.handle({ kind: "ice", from: "a", candidates: [{ candidate: "c1" }] });
    expect(states.b[0]!.in.ice).toBe(1);
    const pc = FakePC.instances.find((p) => p.addedIce.length === 0)!;
    expect(pc.addedIce).toHaveLength(0);          // עדיין לא הוחל

    await meshes.b.handle({ kind: "offer", from: "a", sdp: "x" });
    await settle();
    await flush();
    await settle();

    const applied = FakePC.instances.some((p) =>
      p.addedIce.some((c) => c.candidate === "c1"));
    expect(applied).toBe(true);
    expect(states.b[0]!.lastError).toBeNull();
  });

  it("SDP שנדחה מדווח במקום להיבלע", async () => {
    // הבליעה השקטה כאן היא בדיוק מה שהפך "ה-SDP נדחה" ל"ריבוע שחור":
    // אין חריגה, אין לוג, והחיבור פשוט נשאר new לנצח.
    const { meshes, states } = pair({ deliver: false });
    meshes.a.sync(["b"]);                  // a מנומס, ולכן לא יתעלם מההצעה
    await settle();
    FakePC.instances[0]!.rejectRemote = true;

    await meshes.a.handle({ kind: "offer", from: "b", sdp: "broken" });
    expect(states.a[0]!.lastError).toContain("Failed to parse SessionDescription");
    expect(states.a[0]!.connection).toBe("new");
  });

  it("סופר את שני הכיוונים בנפרד", async () => {
    const { meshes, states, flush } = pair();
    meshes.a.sync(["b"]);
    meshes.b.sync(["a"]);
    await settle();
    await flush();
    await settle();

    const a = states.a[0]!, b = states.b[0]!;
    expect(a.out.offer).toBeGreaterThan(0);
    expect(b.in.offer).toBe(a.out.offer);        // מה שיצא הוא מה שנכנס
    expect(a.in.answer + b.in.answer).toBeGreaterThan(0);
    // ומה שהאבחון מציג הוא זה: תשובה שיצאה מול תשובה שנכנסה.
    expect(a.out.answer + b.out.answer).toBe(a.in.answer + b.in.answer);
  });
});

describe("התנגשות שבה הצד השני לא עונה", () => {
  it("הצד הלא-מנומס נסוג בעצמו ועונה, במקום להיתקע לנצח", async () => {
    // בדיוק מה שנראה על המסך: שני הצדדים עם הצעה מקומית פתוחה, אף אחד
    // לא ענה, והחיבור נשאר new. הדפוס הקלאסי מניח שהמנומס יענה — וכשהוא
    // לא (גרסה ישנה, הודעה שאבדה), זה תקוע לתמיד.
    const sent: { to: string; msg: SignalMessage }[] = [];
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "d189", localStream: stream(), iceServers: [], iceBatchMs: 0, glareMs: 10,
      send: (to, msg) => sent.push({ to, msg }),
      onPeersChanged: (p) => states.push(p),
    });

    mesh.sync(["35eb"]);                       // "35eb" < "d189" → אני לא מנומס
    await settle();
    expect(sent.filter((m) => m.msg.kind === "offer")).toHaveLength(1);

    await mesh.handle({ kind: "offer", from: "35eb", sdp: "his-offer" });
    const ignored = states[states.length - 1]![0]!;
    expect(ignored.in.offer).toBe(1);
    expect(ignored.out.answer).toBe(0);        // התעלמנו, כמצופה

    await new Promise((r) => setTimeout(r, 40));
    await settle();

    const after = states[states.length - 1]![0]!;
    expect(after.out.answer).toBe(1);          // נסוגנו וענינו
    expect(after.lastError).toBeNull();
    expect(sent.some((m) => m.msg.kind === "answer")).toBe(true);
  });

  it("תשובה שהגיעה בזמן מבטלת את הנסיגה", async () => {
    const sent: { to: string; msg: SignalMessage }[] = [];
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "d189", localStream: stream(), iceServers: [], iceBatchMs: 0, glareMs: 10,
      send: (to, msg) => sent.push({ to, msg }),
      onPeersChanged: (p) => states.push(p),
    });
    mesh.sync(["35eb"]);
    await settle();

    await mesh.handle({ kind: "offer", from: "35eb", sdp: "his-offer" });
    await mesh.handle({ kind: "answer", from: "35eb", sdp: "his-answer" });
    await new Promise((r) => setTimeout(r, 40));
    await settle();

    const after = states[states.length - 1]![0]!;
    expect(after.out.answer).toBe(0);          // אין צורך — התשובה הגיעה
    expect(after.lastError).toBeNull();
    expect(after.connection).toBe("connecting");
  });
});
