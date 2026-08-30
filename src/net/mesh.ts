import { capSender, MAX_BITRATE } from "./media";
import { IceBatcher, isPolite, type SignalMessage } from "./signaling";

/**
 * רשת WebRTC מלאה בין 2–6 שחקנים.
 *
 * ── למה mesh ולא SFU ──
 * המשבצות במרכז הלוח קטנות וכולן באותו גודל, ולכן אין צורך ב-simulcast —
 * מה שבדרך כלל הורג mesh. בדסקטופ גם מחסום ה-CPU (5 סשני קידוד במקביל)
 * לא מהווה בעיה. התמורה: ישראלים מדברים עם ישראלים ישירות, ~5–20ms,
 * לעומת 100–130ms דרך פרנקפורט בכל SFU מנוהל. ראה docs/spec.md §3.5.
 *
 * ── perfect negotiation ──
 * ב-15 חיבורים במקביל, glare (שני צדדים מציעים בו-זמנית) הוא ודאות ולא
 * תקלה נדירה. ההכרעה דטרמיניסטית לפי השוואת מזהים, ולכן שני הצדדים
 * מגיעים לאותה מסקנה בלי סיבוב תקשורת נוסף.
 */

/**
 * מה באמת קורה במסלול הווידאו שהתקבל.
 *
 * זרם שהגיע אינו אומר שרואים משהו: מסלול יכול להיות live אבל muted,
 * כלומר לא זורמים בו פריימים. על המסך זה ריבוע שחור בדיוק כמו חיבור
 * שלא נוצר, ולכן זה נמדד ולא מנוחש.
 */
export interface VideoTrackInfo { tracks: number; live: boolean; muted: boolean }

/** ספירת הודעות סיגנלינג לפי סוג, לכיוון אחד. */
export interface SignalCount { offer: number; answer: number; ice: number }

export interface PeerState {
  id: string;
  stream: MediaStream | null;
  connection: RTCPeerConnectionState;
  /** האם החיבור נדרש לעבור דרך ממסר TURN. לניטור עלות. */
  relayed: boolean;
  /** מצב המשא ומתן. "new" בחיבור פירושו שתיאור מרוחק לא הוחל. */
  signaling: RTCSignalingState;
  polite: boolean;
  in: SignalCount;
  out: SignalCount;
  /** מועמדי ICE שנדחו. בודדים הם שגרה; רבים פירושם מסלול שלא נבדק. */
  iceDropped: number;
  /** כמה פעמים החיבור הוקם מחדש אחרי שנתקע. */
  resets: number;
  /**
   * השגיאה האחרונה בטיפול בהודעה.
   *
   * חיבור בודד שנכשל באמת לא צריך להפיל את השאר, אבל הבליעה השקטה הפכה
   * "ה-SDP נדחה" ל"ריבוע שחור" — בלי שום דרך להבדיל בינו לבין NAT.
   */
  lastError: string | null;
  video: VideoTrackInfo;
}

const noCount = (): SignalCount => ({ offer: 0, answer: 0, ice: 0 });

export interface MeshOptions {
  selfId: string;
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  send: (peerId: string, message: SignalMessage) => void;
  onPeersChanged: (peers: PeerState[]) => void;
  iceBatchMs?: number;
  /** כמה להמתין לתשובה לפני הקמה מחדש. לבדיקות. */
  stuckMs?: number;
  /** כמה לסבול חיבור בלי פריימים. לבדיקות. */
  staleMs?: number;
}

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  stream: MediaStream | null;
  relayed: boolean;
  in: SignalCount;
  out: SignalCount;
  iceDropped: number;
  resets: number;
  lastError: string | null;
  /**
   * מועמדי ICE שהגיעו לפני התיאור המרוחק.
   *
   * שני הצדדים שולחים במקביל, ואין שום הבטחה שההצעה תקדים את המועמדים.
   * addIceCandidate לפני setRemoteDescription נכשל, וכל מועמד שנזרק כך
   * הוא מסלול שלא ייבדק — כלומר חיבור שנכשל בלי סיבה נראית.
   */
  pendingIce: RTCIceCandidateInit[];
  /**
   * שעון תקיעה: הצעה יצאה ולא חזר עליה כלום.
   *
   * הניסיון הקודם כאן היה לגלגל את ההצעה שלנו לאחור ולענות על שלו. זו
   * הייתה טעות: התשובה שלו *כן* בדרך, רק אטית — הממסר עובר Edge Function
   * ובסיס נתונים — וכשהיא הגיעה כבר היינו stable. אז כל צד החזיק תיאור
   * אחר של אותו חיבור, ולא הייתה דרך לתקן.
   *
   * מה שבטוח במקום זה: להקים את החיבור מחדש. אין מצב ביניים שאפשר
   * להיתקע בו, שני הצדדים מתחילים מאותו מקום, וזה עובד גם כשהצד השני
   * מתנהג אחרת ממה שהנחנו.
   */
  stuckTimer: ReturnType<typeof setTimeout> | null;
  /** חיבור מוצלח שלא זורמים בו פריימים — ראה armStale. */
  staleTimer: ReturnType<typeof setTimeout> | null;
  /** ממתין לראות אם ניתוק זמני מתאושש מעצמו לפני שמאתחלים ICE. */
  dropTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * כמה להמתין לתשובה לפני הקמה מחדש.
 *
 * הרבה יותר מזמן הלוך-ושוב של הממסר (נמדד: עד ~3 שניות), כי כל המתנה
 * שנקטעת מוקדם מדי מייצרת בדיוק את התקלה שהיא נועדה לפתור.
 */
export const STUCK_MS = 8000;
/** כמה זמן לסבול חיבור מחובר שאין בו פריימים לפני הקמה מחדש. */
export const STALE_MS = 10_000;
/** אחרי כמה הקמות מחדש מפסיקים לנסות ואומרים את זה. */
const MAX_RESETS = 2;

export function videoInfo(stream: MediaStream | null): VideoTrackInfo {
  const tracks = stream?.getVideoTracks?.() ?? [];
  return {
    tracks: tracks.length,
    live: tracks.some((t) => t.readyState === "live"),
    // muted מהצד המקבל פירושו שכרגע לא מגיעים פריימים.
    muted: tracks.length > 0 && tracks.every((t) => t.muted),
  };
}

/** הודעת שגיאה קריאה, גם כשמה שנזרק אינו Error. */
const errText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export class PeerMesh {
  private peers = new Map<string, Peer>();
  private batcher: IceBatcher;
  private closed = false;

  constructor(private readonly opts: MeshOptions) {
    this.batcher = new IceBatcher(opts.iceBatchMs ?? 200, (peerId, candidates) => {
      const peer = this.peers.get(peerId);
      if (peer) peer.out.ice++;
      opts.send(peerId, { kind: "ice", from: opts.selfId, candidates });
    });
  }

  /** מיישר את קבוצת החיבורים מול רשימת השחקנים הנוכחית בחדר. */
  sync(peerIds: string[]): void {
    if (this.closed) return;
    const wanted = new Set(peerIds.filter((id) => id !== this.opts.selfId));

    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.drop(id);
    }
    for (const id of wanted) {
      if (!this.peers.has(id)) this.connect(id);
    }
    this.emit();
  }

  private connect(peerId: string): void {
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers });
    const peer: Peer = {
      pc, polite: isPolite(this.opts.selfId, peerId),
      makingOffer: false, ignoreOffer: false, stream: null, relayed: false,
      in: noCount(), out: noCount(), iceDropped: 0, resets: 0,
      lastError: null, pendingIce: [], stuckTimer: null, staleTimer: null,
      dropTimer: null,
    };
    this.peers.set(peerId, peer);

    for (const track of this.opts.localStream.getTracks()) {
      const sender = pc.addTrack(track, this.opts.localStream);
      if (track.kind === "video") void capSender(sender);
    }

    pc.ontrack = ({ streams, track }) => {
      peer.stream = streams[0] ?? null;
      // mute/unmute הם השינוי היחיד שמבדיל בין "מסלול קיים" לבין
      // "פריימים באמת זורמים", והם קורים אחרי ontrack.
      track.onunmute = () => { this.disarmStale(peer); this.emit(); };
      track.onmute = () => { this.armStale(peerId, peer); this.emit(); };
      if (track.muted) this.armStale(peerId, peer);
      this.emit();
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      // usernameFragment נזרק בכוונה. הוא מקשר את המועמד לסבב משא ומתן
      // מסוים, ואחרי גלגול לאחור (התנגשות) הסבב אצל הצד השני כבר אחר —
      // ואז addIceCandidate זורק "Error processing ICE candidate" ומסלול
      // תקין לגמרי נזרק. בלעדיו המועמד מוחל על הסבב הנוכחי.
      const { usernameFragment: _drop, ...c } = candidate.toJSON();
      this.batcher.add(peerId, c);
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        peer.out.offer++;
        this.opts.send(peerId, {
          kind: "offer", from: this.opts.selfId, sdp: pc.localDescription!.sdp,
        });
        this.armStuck(peerId, peer);
      } catch (e) { peer.lastError = `הצעה נכשלה: ${errText(e)}`; }
      finally { peer.makingOffer = false; this.emit(); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();

      // "disconnected" הוא לרוב זמני ומתאושש לבד, ולכן לא מאתחלים מיד —
      // אבל אם הוא נשאר, אף אחד לא יעשה זאת במקומנו, והמסך פשוט קופא
      // על תמונה מתה. שנייתיים המתנה, ואז אתחול ICE.
      if (peer.dropTimer) { clearTimeout(peer.dropTimer); peer.dropTimer = null; }
      if (pc.connectionState === "disconnected") {
        peer.dropTimer = setTimeout(() => {
          peer.dropTimer = null;
          if (pc.connectionState === "disconnected") pc.restartIce();
        }, 2500);
      }

      // מחובר אבל שקט — ראה armStale.
      if (pc.connectionState === "connected" && videoInfo(peer.stream).muted) {
        this.armStale(peerId, peer);
      } else if (pc.connectionState !== "connected") {
        this.disarmStale(peer);
      }

      void this.checkRelay(peerId, peer);
      this.emit();
    };

    // ── אין יצירת הצעה ידנית כאן, בכוונה ──
    // הוספת המסלולים למעלה מפעילה negotiationneeded בעצמה. גרסה קודמת
    // יצרה בנוסף הצעה ידנית לצד ה"יוזם", ושתי ההצעות התנגשו:
    // "the order of m-lines in subsequent offer doesn't match".
    // בדפוס perfect negotiation אין יוזם — שני הצדדים מציעים, והנימוס
    // הוא שמכריע את ההתנגשות.
  }

  /** הודעת סיגנלינג נכנסת מעמית. */
  async handle(message: SignalMessage): Promise<void> {
    if (this.closed) return;
    const peerId = message.from;
    if (!this.peers.has(peerId)) this.connect(peerId);
    const peer = this.peers.get(peerId);
    if (!peer) return;
    const { pc } = peer;

    try {
      if (message.kind === "ice") {
        peer.in.ice++;
        // בלי תיאור מרוחק אין למועמד למה להתייחס. שומרים ומחילים אחר כך.
        if (!pc.remoteDescription) { peer.pendingIce.push(...message.candidates); }
        else await this.addIce(peer, message.candidates);
        this.emit();
        return;
      }

      const description = { type: message.kind, sdp: message.sdp } as RTCSessionDescriptionInit;

      if (message.kind === "offer") {
        peer.in.offer++;
        // glare: שני הצדדים הציעו. המנומס נסוג, הלא-מנומס מתעלם וממתין
        // לתשובה על ההצעה שלו.
        const collision = peer.makingOffer || pc.signalingState !== "stable";
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) { this.emit(); return; }
        await pc.setRemoteDescription(description);
        await this.drainIce(peer);
        await pc.setLocalDescription();
        peer.out.answer++;
        this.opts.send(peerId, {
          kind: "answer", from: this.opts.selfId, sdp: pc.localDescription!.sdp,
        });
        this.disarmStuck(peer);
      } else {
        peer.in.answer++;
        // תשובה שאיחרה למסיבה: ההצעה שלה כבר לא קיימת (הוקם חיבור חדש,
        // או שהמשא ומתן נסגר בדרך אחרת). החלתה תזרוק "wrong state" ותשאיר
        // את שני הצדדים עם תיאור שונה של אותו חיבור — גרוע בהרבה
        // מהתעלמות שקטה.
        if (pc.signalingState !== "have-local-offer") { this.emit(); return; }
        await pc.setRemoteDescription(description);
        await this.drainIce(peer);
        this.disarmStuck(peer);
      }
      peer.lastError = null;
    } catch (e) {
      // חיבור בודד שנכשל לא מפיל את השאר — אבל הוא כן אומר למה.
      peer.lastError = `${message.kind}: ${errText(e)}`;
    }
    this.emit();
  }

  /**
   * הצעה יצאה — עכשיו מצפים לתשובה.
   *
   * אם לא הגיעה כלום אחרי STUCK_MS, החיבור מוקם מחדש. לא מגלגלים לאחור
   * ולא עונים במקומו: כל תיקון חלקי כזה משאיר את שני הצדדים עם תיאור
   * שונה של אותו חיבור, ואין ממנו דרך חזרה. התחלה נקייה תמיד עובדת.
   */
  private armStuck(peerId: string, peer: Peer): void {
    if (peer.stuckTimer) return;
    peer.stuckTimer = setTimeout(() => {
      peer.stuckTimer = null;
      if (this.closed || peer.pc.remoteDescription) return;
      this.resetPeer(peerId, peer);
    }, this.opts.stuckMs ?? STUCK_MS);
  }

  /**
   * חיבור שהצליח אבל לא מגיעים בו פריימים.
   *
   * זה נראה על המסך בדיוק כמו כשלון חיבור — ריבוע שחור — אבל מבפנים
   * הכול "תקין": ICE הצליח, יש מסלול, והוא פשוט שקט. קורה אחרי משא ומתן
   * חוזר או אחרי אתחול ICE שלא הביא מדיה. אף אחד לא יתקן את זה מעצמו,
   * ולכן אחרי STALE_MS מקימים מחדש — עד תקרת הניסיונות, כדי שמצלמה
   * שכבויה בכוונה בצד השני לא תייצר לולאה.
   */
  private armStale(peerId: string, peer: Peer): void {
    if (peer.staleTimer) return;
    peer.staleTimer = setTimeout(() => {
      peer.staleTimer = null;
      if (this.closed) return;
      if (peer.pc.connectionState !== "connected") return;
      if (!videoInfo(peer.stream).muted) return;      // בינתיים התחיל לזרום
      this.resetPeer(peerId, peer);
    }, this.opts.staleMs ?? STALE_MS);
  }

  private disarmStale(peer: Peer): void {
    if (peer.staleTimer) { clearTimeout(peer.staleTimer); peer.staleTimer = null; }
  }

  /** הקמה מחדש מאפס. אין בה מצב ביניים, ולכן היא בטוחה מכל תיקון חלקי. */
  private resetPeer(peerId: string, peer: Peer): void {
    if (peer.resets >= MAX_RESETS) {
      peer.lastError = "לא הצלחנו להקים חיבור אחרי כמה ניסיונות";
      this.emit();
      return;
    }
    const resets = peer.resets + 1;
    this.drop(peerId);
    this.connect(peerId);
    const fresh = this.peers.get(peerId);
    if (fresh) fresh.resets = resets;
    this.emit();
  }

  private disarmStuck(peer: Peer): void {
    if (peer.stuckTimer) { clearTimeout(peer.stuckTimer); peer.stuckTimer = null; }
  }

  private async addIce(peer: Peer, candidates: RTCIceCandidateInit[]): Promise<void> {
    for (const c of candidates) {
      try { await peer.pc.addIceCandidate(c); }
      catch { peer.iceDropped++; }
    }
  }

  private async drainIce(peer: Peer): Promise<void> {
    if (!peer.pendingIce.length) return;
    const queued = peer.pendingIce;
    peer.pendingIce = [];
    await this.addIce(peer, queued);
  }

  /** האם החיבור עובר דרך ממסר. המדד שקובע אם TURN מתחיל לעלות כסף. */
  private async checkRelay(peerId: string, peer: Peer): Promise<void> {
    if (peer.pc.connectionState !== "connected") return;
    try {
      const stats = await peer.pc.getStats();
      for (const report of stats.values()) {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          const local = stats.get(report.localCandidateId);
          peer.relayed = local?.candidateType === "relay";
        }
      }
    } catch { /* לא קריטי */ }
    void peerId;
  }

  private drop(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.onconnectionstatechange = null;
    if (peer.dropTimer) { clearTimeout(peer.dropTimer); peer.dropTimer = null; }
    this.disarmStuck(peer);
    this.disarmStale(peer);
    peer.pc.close();
    this.peers.delete(peerId);
    this.batcher.flush(peerId);
  }

  private emit(): void {
    this.opts.onPeersChanged(this.snapshot());
  }

  snapshot(): PeerState[] {
    return [...this.peers.entries()].map(([id, p]) => ({
      id, stream: p.stream, connection: p.pc.connectionState, relayed: p.relayed,
      signaling: p.pc.signalingState, polite: p.polite,
      in: { ...p.in }, out: { ...p.out }, iceDropped: p.iceDropped,
      resets: p.resets, lastError: p.lastError,
      video: videoInfo(p.stream),
    }));
  }

  close(): void {
    this.closed = true;
    this.batcher.dispose();
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.peers.clear();
  }
}

export { MAX_BITRATE };
