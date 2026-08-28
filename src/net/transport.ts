import { signalTopic, type SignalMessage } from "./signaling";

/**
 * תעבורת הסיגנלינג.
 *
 * ה-mesh לא יודע דרך מה ההודעות עוברות. זה מה שמאפשר להריץ את *אותו*
 * קוד WebRTC גם מול Supabase Realtime בפרודקשן וגם מול BroadcastChannel
 * בין כרטיסיות באותו דפדפן — ובלי התעבורה המקומית, קוד ה-mesh היה נבדק
 * לראשונה רק בפרודקשן.
 */
export interface SignalTransport {
  /** שולח הודעה לעמית יחיד. */
  send(peerId: string, message: SignalMessage): void;
  /** נרשם להודעות שמיועדות לי. מחזיר פונקציית ניתוק. */
  subscribe(selfId: string, onMessage: (m: SignalMessage) => void): () => void;
  /** מודיע על נוכחות ומדווח מי עוד נוכח. מחזיר פונקציית ניתוק. */
  presence(selfId: string, onPeers: (ids: string[]) => void): () => void;
  close(): void;
}

type Envelope =
  | { kind: "signal"; to: string; message: SignalMessage }
  | { kind: "hello"; from: string }
  | { kind: "bye"; from: string };

const HELLO_MS = 1500;
/** אחרי כמה זמן בלי סימן חיים עמית נחשב עזוב. */
const STALE_MS = 5000;

/**
 * סיגנלינג בין כרטיסיות של אותו דפדפן.
 *
 * לא לפרודקשן — BroadcastChannel לא חוצה מכשירים. אבל החיבור עצמו הוא
 * WebRTC אמיתי לכל דבר, ולכן זו הדרך היחידה לראות שהמימוש עובד בלי
 * להעמיד תשתית.
 */
export class BroadcastTransport implements SignalTransport {
  private channel: BroadcastChannel;
  private seen = new Map<string, number>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private handlers = new Set<(e: Envelope) => void>();

  constructor(name = "tabu-signal") {
    this.channel = new BroadcastChannel(name);
    this.channel.onmessage = (e) => {
      for (const h of this.handlers) h(e.data as Envelope);
    };
  }

  send(peerId: string, message: SignalMessage): void {
    this.channel.postMessage({ kind: "signal", to: peerId, message } satisfies Envelope);
  }

  subscribe(selfId: string, onMessage: (m: SignalMessage) => void): () => void {
    const handler = (e: Envelope) => {
      if (e.kind === "signal" && e.to === selfId) onMessage(e.message);
    };
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  presence(selfId: string, onPeers: (ids: string[]) => void): () => void {
    const emit = () => {
      const now = Date.now();
      for (const [id, at] of this.seen) if (now - at > STALE_MS) this.seen.delete(id);
      onPeers([...this.seen.keys()]);
    };

    const handler = (e: Envelope) => {
      if (e.kind === "hello" && e.from !== selfId) {
        const isNew = !this.seen.has(e.from);
        this.seen.set(e.from, Date.now());
        // עונים מיד לכרטיסייה חדשה, כדי שלא תמתין למחזור הבא.
        if (isNew) this.channel.postMessage({ kind: "hello", from: selfId } satisfies Envelope);
        emit();
      }
      if (e.kind === "bye") { this.seen.delete(e.from); emit(); }
    };
    this.handlers.add(handler);

    const announce = () =>
      this.channel.postMessage({ kind: "hello", from: selfId } satisfies Envelope);
    announce();
    this.timers.push(setInterval(announce, HELLO_MS));
    this.timers.push(setInterval(emit, HELLO_MS));

    const bye = () =>
      this.channel.postMessage({ kind: "bye", from: selfId } satisfies Envelope);
    addEventListener("pagehide", bye);

    return () => {
      bye();
      removeEventListener("pagehide", bye);
      this.handlers.delete(handler);
    };
  }

  close(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.handlers.clear();
    this.channel.close();
  }
}

interface RealtimeLike {
  channel: (name: string, opts?: unknown) => {
    on: (t: string, f: unknown, cb: (p: { payload: unknown }) => void) => unknown;
    send: (m: unknown) => Promise<unknown>;
    subscribe: () => unknown;
  };
  removeChannel: (ch: unknown) => unknown;
}

/**
 * סיגנלינג דרך Supabase Realtime.
 *
 * ערוץ פרטי *לכל שחקן* ולא שידור לחדר: הודעה לעמית אחד עולה מסירה אחת
 * במקום חמש. ראה src/net/signaling.ts — זה ההבדל בין ~1,050 משחקים
 * בחודש בשכבה החינמית לבין ~26,000.
 */
export class SupabaseTransport implements SignalTransport {
  private channels = new Map<string, ReturnType<RealtimeLike["channel"]>>();

  constructor(private readonly sb: RealtimeLike) {}

  send(peerId: string, message: SignalMessage): void {
    const topic = signalTopic(peerId);
    let ch = this.channels.get(topic);
    // private:true חייב להופיע גם בשליחה. ערוץ שנפתח בלי הדגל הוא ערוץ
    // אחר מזה שהנמען מאזין לו, וההודעה נעלמת בלי שגיאה.
    if (!ch) {
      ch = this.sb.channel(topic, { config: { private: true } });
      ch.subscribe();
      this.channels.set(topic, ch);
    }
    void ch.send({ type: "broadcast", event: "signal", payload: message });
  }

  subscribe(selfId: string, onMessage: (m: SignalMessage) => void): () => void {
    const topic = signalTopic(selfId);
    const ch = this.sb.channel(topic, { config: { private: true } });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => onMessage(payload as SignalMessage));
    ch.subscribe();
    this.channels.set(topic, ch);
    return () => { this.sb.removeChannel(ch); this.channels.delete(topic); };
  }

  /** ברשת, רשימת העמיתים מגיעה ממצב המשחק ולא מ-presence. */
  presence(): () => void {
    return () => {};
  }

  close(): void {
    for (const ch of this.channels.values()) this.sb.removeChannel(ch);
    this.channels.clear();
  }
}
