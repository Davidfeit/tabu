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

export interface PeerState {
  id: string;
  stream: MediaStream | null;
  connection: RTCPeerConnectionState;
  /** האם החיבור נדרש לעבור דרך ממסר TURN. לניטור עלות. */
  relayed: boolean;
}

export interface MeshOptions {
  selfId: string;
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  send: (peerId: string, message: SignalMessage) => void;
  onPeersChanged: (peers: PeerState[]) => void;
  iceBatchMs?: number;
}

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  stream: MediaStream | null;
  relayed: boolean;
}

export class PeerMesh {
  private peers = new Map<string, Peer>();
  private batcher: IceBatcher;
  private closed = false;

  constructor(private readonly opts: MeshOptions) {
    this.batcher = new IceBatcher(opts.iceBatchMs ?? 200, (peerId, candidates) => {
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
    };
    this.peers.set(peerId, peer);

    for (const track of this.opts.localStream.getTracks()) {
      const sender = pc.addTrack(track, this.opts.localStream);
      if (track.kind === "video") void capSender(sender);
    }

    pc.ontrack = ({ streams }) => {
      peer.stream = streams[0] ?? null;
      this.emit();
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.batcher.add(peerId, candidate.toJSON());
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.opts.send(peerId, {
          kind: "offer", from: this.opts.selfId, sdp: pc.localDescription!.sdp,
        });
      } catch { /* יטופל ב-connectionstatechange */ }
      finally { peer.makingOffer = false; }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
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
        for (const c of message.candidates) {
          try { await pc.addIceCandidate(c); }
          catch { if (!peer.ignoreOffer) throw new Error("ICE נדחה"); }
        }
        return;
      }

      const description = { type: message.kind, sdp: message.sdp } as RTCSessionDescriptionInit;

      if (message.kind === "offer") {
        // glare: שני הצדדים הציעו. המנומס נסוג, הלא-מנומס מתעלם.
        const collision = peer.makingOffer || pc.signalingState !== "stable";
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        await pc.setLocalDescription();
        this.opts.send(peerId, {
          kind: "answer", from: this.opts.selfId, sdp: pc.localDescription!.sdp,
        });
      } else {
        await pc.setRemoteDescription(description);
      }
    } catch {
      /* חיבור בודד שנכשל לא מפיל את השאר */
    }
    this.emit();
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
