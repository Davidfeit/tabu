import { roomChannel, type RealtimeLike, type RoomChannelHandle } from "./roomChannel";
import type { SignalMessage } from "./signaling";

/**
 * תעבורת הסיגנלינג.
 *
 * ה-mesh לא יודע דרך מה ההודעות עוברות. זה מה שמאפשר להריץ את *אותו*
 * קוד WebRTC גם מול Supabase Realtime בפרודקשן וגם מול BroadcastChannel
 * בין כרטיסיות באותו דפדפן — ובלי התעבורה המקומית, קוד ה-mesh היה נבדק
 * לראשונה רק בפרודקשן.
 */
/** מוני סיגנלינג, לאבחון. כשאין וידאו הם ההבדל בין שלוש תקלות שונות. */
export interface SignalStats {
  /** הודעות שנשלחו החוצה (כולל כאלה שנכשלו). */
  sent: number;
  failed: number;
  /** שידורי signal שהתקבלו על ערוץ החדר, לכל נמען. */
  received: number;
  /** מתוכם, כאלה שממוענים אליי. */
  forMe: number;
}

export interface SignalTransport {
  /** שולח הודעה לעמית יחיד. */
  send(peerId: string, message: SignalMessage): void;
  /** נרשם להודעות שמיועדות לי. מחזיר פונקציית ניתוק. */
  subscribe(selfId: string, onMessage: (m: SignalMessage) => void): () => void;
  /** מודיע על נוכחות ומדווח מי עוד נוכח. מחזיר פונקציית ניתוק. */
  presence(selfId: string, onPeers: (ids: string[]) => void): () => void;
  close(): void;
  /** לאבחון בלבד. */
  readonly stats?: SignalStats;
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

/**
 * סיגנלינג דרך Supabase Realtime.
 *
 * ערוץ פרטי *לכל שחקן* ולא שידור לחדר: הודעה לעמית אחד עולה מסירה אחת
 * במקום חמש. ראה src/net/signaling.ts — זה ההבדל בין ~1,050 משחקים
 * בחודש בשכבה החינמית לבין ~26,000.
 */
/**
 * סיגנלינג על ערוץ החדר.
 *
 * הגרסה הקודמת פתחה ערוץ פרטי לכל שחקן (sig:<uid>). זה חסך מסירות, אבל
 * דרש מדיניות משלו על realtime.messages — ובפועל ההודעות לא הגיעו, בזמן
 * שערוץ החדר עבד מצוין ומצב המשחק זרם עליו.
 *
 * לכן: מאזינים לאותו ערוץ שכבר עובד, ושולחים דרך ה-Edge Function שמשדר
 * אליו עם תפקיד השירות. עולה קריאת רשת לכל הודעת סיגנלינג — מדובר
 * בעשרות בודדות לכל חיבור — ובתמורה אין מסלול שני שצריך להוכיח את עצמו.
 */
export class RoomTransport implements SignalTransport {
  private handle: RoomChannelHandle | null = null;
  readonly stats: SignalStats = { sent: 0, failed: 0, received: 0, forMe: 0 };

  constructor(
    private readonly sb: RealtimeLike,
    private readonly roomId: string,
    private readonly relay: (to: string, message: SignalMessage) => Promise<unknown>,
    /** מדווח על כישלון ממסר. בלעדיו כשל שרת נראה כמו NAT. */
    private readonly onError?: (message: string) => void,
  ) {}

  send(peerId: string, message: SignalMessage): void {
    this.stats.sent++;
    void this.relay(peerId, message).catch((e: unknown) => {
      this.stats.failed++;
      // כשל בודד אינו קטלני — perfect negotiation מתאושש — אבל כשל *קבוע*
      // (שרת ישן שלא מכיר את הפעולה) נראה בדיוק כמו בעיית רשת, ולכן הוא
      // חייב לצוף.
      const raw = e instanceof Error ? e.message : String(e);
      this.onError?.(raw === "UNKNOWN_OP"
        ? "ה-Edge Function בשרת ישנה — הריצו npm run setup:supabase"
        : `ממסר הסיגנלינג נכשל: ${raw}`);
    });
  }

  subscribe(selfId: string, onMessage: (m: SignalMessage) => void): () => void {
    // ידית מונה, ולא ערוץ פרטי: מצב המשחק מאזין לאותו נושא, ו-supabase-js
    // מחזיר לשנינו את אותו אובייקט. ניתוק ישיר כאן היה מנתק גם אותו.
    const h = roomChannel(this.sb, this.roomId);
    h.on("signal", (payload) => {
      const p = payload as { to?: string; message?: SignalMessage } | undefined;
      this.stats.received++;
      // השידור מגיע לכל חברי החדר; הנמען מסונן כאן.
      if (p?.to === selfId && p.message) { this.stats.forMe++; onMessage(p.message); }
    });
    void h.join();
    this.handle = h;
    return () => { h.release(); if (this.handle === h) this.handle = null; };
  }

  /** ברשת, רשימת העמיתים מגיעה ממצב המשחק ולא מ-presence. */
  presence(): () => void {
    return () => {};
  }

  close(): void {
    this.handle?.release();
    this.handle = null;
  }
}
