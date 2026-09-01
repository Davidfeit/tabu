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
  ontrack: ((e: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addedIce: RTCIceCandidateInit[] = [];
  /** דוחה כל תיאור מרוחק — כדי לבדוק שהשגיאה מדווחת ולא נבלעת. */
  rejectRemote = false;

  constructor() { FakePC.instances.push(this); }

  private queued = false;
  /** השולחים שנוצרו, כדי ש-getSenders יחזיר משהו אמיתי לבדיקת התקרות. */
  senders: { track: { kind: string }; getParameters: () => { encodings: [{ maxBitrate?: number }] };
             setParameters: (p: { encodings: [{ maxBitrate?: number }] }) => Promise<void> }[] = [];

  getSenders() { return this.senders; }

  addTrack(track: { kind: string } = { kind: "video" }) {
    // כמו בדפדפן: כל המסלולים שנוספים ברצף מפיקים אירוע אחד, והוא נורה
    // רק כשאפשר להציע. שני אירועים היו מייצרים כאן תקלה שלא קיימת.
    if (!this.queued) {
      this.queued = true;
      queueMicrotask(() => {
        this.queued = false;
        if (this.signalingState === "stable") this.onnegotiationneeded?.();
      });
    }
    const encodings: [{ maxBitrate?: number }] = [{}];
    const sender = {
      track,
      getParameters: () => ({ encodings }),
      setParameters: async (p: { encodings: [{ maxBitrate?: number }] }) => {
        encodings[0] = p.encodings[0];
      },
    };
    this.senders.push(sender);
    return sender;
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
    // מסלול אמיתי ולא רק זרם: הקוד נרשם ל-mute/unmute עליו, כי "יש זרם"
    // אינו "זורמים פריימים".
    const track = { kind: "video", readyState: "live", muted: false,
                    onmute: null, onunmute: null } as unknown as MediaStreamTrack;
    const remote = { id: "remote", getVideoTracks: () => [track] } as unknown as MediaStream;
    this.ontrack?.({ streams: [remote], track });
  }

  /** ICE הצליח. בדפדפן זה קורה מעצמו; כאן מפורשות. */
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }

  emitCandidate(id: string) {
    this.onicecandidate?.({ candidate: {
      toJSON: () => ({ candidate: id, sdpMid: "0", usernameFragment: "abcd" }),
    } as unknown as RTCIceCandidate });
  }

  async getStats() { return new Map(); }
  restartIce() {}
  close() { this.connectionState = "closed"; }
}

const stream = () => ({
  getTracks: () => [{ kind: "video" }, { kind: "audio" }],
  getVideoTracks: () => [{ kind: "video", readyState: "live", muted: false }],
} as unknown as MediaStream);

beforeEach(() => {
  FakePC.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePC);
});
afterEach(() => vi.unstubAllGlobals());

/** זוג רשתות שמדברות זו עם זו, עם שליטה על סדר המסירה. */
function pair(opts: { deliver?: boolean; stuckMs?: number } = {}) {
  const queue: { to: string; msg: SignalMessage }[] = [];
  const meshes: Record<string, PeerMesh> = {};
  const states: Record<string, PeerState[]> = { a: [], b: [] };

  const make = (id: string) => new PeerMesh({
    selfId: id, localStream: stream(), iceServers: [],
    iceBatchMs: 0, stuckMs: opts.stuckMs ?? 5000,
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

describe("הצעה שלא חוזרת עליה תשובה", () => {
  it("החיבור מוקם מחדש, ולא מגלגלים לאחור", async () => {
    // הניסיון הקודם היה לגלגל לאחור ולענות במקומו, וזה שבר את שני
    // הצדדים כשהתשובה שלו הגיעה שנייה אחר כך: כל צד החזיק תיאור אחר
    // של אותו חיבור. הקמה מחדש היא היחידה שאין בה מצב ביניים.
    const sent: SignalMessage[] = [];
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "d189", localStream: stream(), iceServers: [], iceBatchMs: 0, stuckMs: 15,
      send: (_to, m) => sent.push(m),
      onPeersChanged: (p) => states.push(p),
    });

    mesh.sync(["35eb"]);                       // "35eb" < "d189" → אני לא מנומס
    await settle();
    await mesh.handle({ kind: "offer", from: "35eb", sdp: "his-offer" });
    expect(states[states.length - 1]![0]!.out.answer).toBe(0);   // התעלמנו, כמצופה
    const before = FakePC.instances.length;

    await new Promise((r) => setTimeout(r, 25));
    await settle();
    expect(FakePC.instances.length).toBe(before + 1);            // חיבור חדש
    expect(states[states.length - 1]![0]!.resets).toBe(1);
    expect(sent.filter((m) => m.kind === "offer").length).toBeGreaterThan(1);

    // ולא עד אינסוף: אחרי מספר ניסיונות זה נעצר ואומר את זה, במקום
    // להקים חיבורים בלולאה בשקט.
    await new Promise((r) => setTimeout(r, 80));
    await settle();
    const last = states[states.length - 1]![0]!;
    expect(last.resets).toBe(2);
    expect(last.lastError).toContain("לא הצלחנו להקים חיבור");
  });

  it("תשובה שהגיעה בזמן מבטלת את ההקמה מחדש", async () => {
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "d189", localStream: stream(), iceServers: [], iceBatchMs: 0, stuckMs: 15,
      send: () => {}, onPeersChanged: (p) => states.push(p),
    });
    mesh.sync(["35eb"]);
    await settle();

    await mesh.handle({ kind: "answer", from: "35eb", sdp: "his-answer" });
    const created = FakePC.instances.length;
    await new Promise((r) => setTimeout(r, 40));
    await settle();

    expect(FakePC.instances.length).toBe(created);               // לא הוקם מחדש
    expect(states[states.length - 1]![0]!.resets).toBe(0);
    expect(states[states.length - 1]![0]!.connection).toBe("connecting");
  });

  it("תשובה שאיחרה נבלעת בשקט, ולא משאירה שני תיאורים שונים", async () => {
    // בדיוק מה שנראה על המסך: "Failed to set remote answer sdp: Called
    // in wrong state: stable".
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "a", localStream: stream(), iceServers: [], iceBatchMs: 0, stuckMs: 5000,
      send: () => {}, onPeersChanged: (p) => states.push(p),
    });
    mesh.sync(["b"]);                          // "a" < "b" → אני מנומס
    await settle();

    // הצעה נכנסת נענית, ואנחנו ב-stable.
    await mesh.handle({ kind: "offer", from: "b", sdp: "his-offer" });
    await settle();
    expect(FakePC.instances[0]!.signalingState).toBe("stable");

    // ועכשיו מגיעה תשובה מאוחרת להצעה שכבר לא קיימת.
    await mesh.handle({ kind: "answer", from: "b", sdp: "late" });
    const st = states[states.length - 1]![0]!;
    expect(st.lastError).toBeNull();
    expect(st.in.answer).toBe(1);              // נספרה, ולא הוחלה
  });
});

describe("מועמדי ICE", () => {
  it("נשלחים בלי usernameFragment", async () => {
    // הוא קושר את המועמד לסבב משא ומתן מסוים, ואחרי גלגול לאחור הסבב
    // בצד השני כבר אחר — ואז מסלול תקין נזרק עם שגיאה.
    const sent: SignalMessage[] = [];
    const mesh = new PeerMesh({
      selfId: "a", localStream: stream(), iceServers: [], iceBatchMs: 0,
      send: (_to, m) => sent.push(m), onPeersChanged: () => {},
    });
    mesh.sync(["b"]);
    await settle();
    FakePC.instances[0]!.emitCandidate("c-1");
    await new Promise((r) => setTimeout(r, 5));

    const ice = sent.find((m) => m.kind === "ice");
    expect(ice).toBeTruthy();
    const c = (ice as unknown as { candidates: Record<string, unknown>[] }).candidates[0]!;
    expect(c.candidate).toBe("c-1");
    expect(c.sdpMid).toBe("0");
    expect("usernameFragment" in c).toBe(false);
  });

  it("מועמד שנדחה נספר ואינו נרשם כשגיאה", async () => {
    // שורה אדומה על כל מועמד שנדחה הצביעה על הבעיה הלא נכונה בדיוק
    // כשהחיבור עצמו הצליח.
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "a", localStream: stream(), iceServers: [], iceBatchMs: 0,
      send: () => {}, onPeersChanged: (p) => states.push(p),
    });
    mesh.sync(["b"]);
    await settle();
    const pc = FakePC.instances[0]!;
    pc.remoteDescription = { type: "offer", sdp: "x" };   // כדי שלא ייכנס לתור
    pc.addIceCandidate = async () => { throw new Error("Error processing ICE candidate"); };

    await mesh.handle({ kind: "ice", from: "b", candidates: [{ candidate: "bad" }] });
    const st = states[states.length - 1]![0]!;
    expect(st.iceDropped).toBe(1);
    expect(st.lastError).toBeNull();
  });
});

describe("חיבור מחובר שאין בו פריימים", () => {
  it("מוקם מחדש מעצמו, בלי שאף אחד יבקש", async () => {
    // התסמין על המסך זהה לכשלון חיבור — ריבוע שחור — אבל מבפנים ICE
    // הצליח ויש מסלול, הוא פשוט שקט. אף אחד לא מתקן את זה מעצמו.
    const states: PeerState[][] = [];
    const mesh = new PeerMesh({
      selfId: "a", localStream: stream(), iceServers: [], iceBatchMs: 0,
      stuckMs: 5000, staleMs: 15,
      send: () => {}, onPeersChanged: (p) => states.push(p),
    });
    mesh.sync(["b"]);
    await settle();

    const pc = FakePC.instances[0]!;
    // מסלול שהגיע ונשאר muted: קיים, ולא זורמים בו פריימים.
    const silent = { kind: "video", readyState: "live", muted: true,
                     onmute: null, onunmute: null } as unknown as MediaStreamTrack;
    pc.ontrack?.({
      streams: [{ getVideoTracks: () => [silent] } as unknown as MediaStream],
      track: silent,
    });
    pc.connectionState = "connected";
    pc.onconnectionstatechange?.();
    const before = FakePC.instances.length;

    await new Promise((r) => setTimeout(r, 45));
    await settle();

    expect(FakePC.instances.length).toBe(before + 1);
    expect(states[states.length - 1]![0]!.resets).toBe(1);
  });

  it("מסלול שהתחיל לזרום מבטל את ההקמה מחדש", async () => {
    const mesh = new PeerMesh({
      selfId: "a", localStream: stream(), iceServers: [], iceBatchMs: 0,
      stuckMs: 5000, staleMs: 15,
      send: () => {}, onPeersChanged: () => {},
    });
    mesh.sync(["b"]);
    await settle();

    const pc = FakePC.instances[0]!;
    const track = { kind: "video", readyState: "live", muted: true,
                    onmute: null, onunmute: null } as unknown as
                    MediaStreamTrack & { onunmute: (() => void) | null };
    pc.ontrack?.({
      streams: [{ getVideoTracks: () => [track] } as unknown as MediaStream], track,
    });
    pc.connectionState = "connected";
    pc.onconnectionstatechange?.();

    // הפריימים התחילו לזרום לפני שהשעון הספיק.
    (track as { muted: boolean }).muted = false;
    track.onunmute?.();
    const before = FakePC.instances.length;

    await new Promise((r) => setTimeout(r, 45));
    await settle();
    expect(FakePC.instances.length).toBe(before);
  });
});
