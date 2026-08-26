/**
 * פרוטוקול הסיגנלינג ל-WebRTC.
 *
 * ── מלכודת המכסה ──
 * סיגנלינג נאיבי דרך broadcast לחדר שלם: 15 חיבורים × (offer + answer +
 * ~15 מועמדי ICE), וכל הודעה מתפוצצת ל-5 נמענים ≈ ~1,900 הודעות מחויבות
 * בהקמת משחק אחד. השכבה החינמית של Supabase נותנת 2M הודעות בחודש, כלומר
 * ~1,050 משחקים — לפני קוביה אחת.
 *
 * לכן שני דברים, מהיום הראשון:
 *   1. ערוץ פרטי לכל שחקן (`sig:{playerId}`). הודעה לעמית אחד עולה מסירה
 *      אחת, לא חמש.
 *   2. איגוד מועמדי ICE לחבילות. מועמד בודד להודעה הוא הרוב המכריע של
 *      התעבורה.
 *
 * יחד: ~75 הודעות להקמת חדר במקום ~1,900.
 */

export type SignalMessage =
  | { kind: "offer"; from: string; sdp: string }
  | { kind: "answer"; from: string; sdp: string }
  | { kind: "ice"; from: string; candidates: RTCIceCandidateInit[] };

export const signalTopic = (playerId: string): string => `sig:${playerId}`;

/**
 * מי "מנומס" בזוג — צד אחד חייב לוותר כששני הצדדים מציעים בו-זמנית (glare).
 * ב-15 חיבורים במקביל זה קורה, ולכן הכרעה דטרמיניסטית ולא הגרלה: השוואת
 * מזהים נותנת לשני הצדדים את אותה תשובה בלי סיבוב תקשורת נוסף.
 */
export function isPolite(myId: string, peerId: string): boolean {
  if (myId === peerId) throw new Error("אי אפשר להתחבר לעצמך");
  return myId < peerId;
}

/** מי יוזם את ההצעה בזוג — הצד הלא-מנומס, כדי שלא שניהם ייזמו. */
export function isInitiator(myId: string, peerId: string): boolean {
  return !isPolite(myId, peerId);
}

/**
 * צובר מועמדי ICE וזורק אותם בחבילה.
 *
 * הזמן קצר בכוונה: השהיה ארוכה מדי דוחה את זמן ההתחברות, קצרה מדי מחזירה
 * אותנו למועמד-להודעה. 200ms תופס את רוב הרצף בלי שההצטרפות תורגש איטית.
 */
export class IceBatcher {
  private pending = new Map<string, RTCIceCandidateInit[]>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly flushMs: number,
    private readonly send: (peerId: string, candidates: RTCIceCandidateInit[]) => void,
  ) {}

  add(peerId: string, candidate: RTCIceCandidateInit): void {
    const queue = this.pending.get(peerId) ?? [];
    queue.push(candidate);
    this.pending.set(peerId, queue);
    if (!this.timers.has(peerId)) {
      this.timers.set(peerId, setTimeout(() => this.flush(peerId), this.flushMs));
    }
  }

  flush(peerId: string): void {
    const timer = this.timers.get(peerId);
    if (timer) { clearTimeout(timer); this.timers.delete(peerId); }
    const queue = this.pending.get(peerId);
    if (!queue?.length) return;
    this.pending.delete(peerId);
    this.send(peerId, queue);
  }

  flushAll(): void {
    for (const peerId of [...this.pending.keys()]) this.flush(peerId);
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.pending.clear();
  }

  /** כמה מועמדים ממתינים לעמית. לבדיקות ולניטור. */
  pendingCount(peerId: string): number {
    return this.pending.get(peerId)?.length ?? 0;
  }
}

/** כמה הודעות סיגנלינג עולה הקמת חדר, לפי מספר המשתתפים. */
export function estimateSignalMessages(
  peers: number, candidatesPerPeer: number, batchSize: number, perPeerChannel: boolean,
): number {
  const links = (peers * (peers - 1)) / 2;
  const iceMessages = links * 2 * Math.ceil(candidatesPerPeer / batchSize);
  const sdpMessages = links * 2;
  const fanout = perPeerChannel ? 1 : peers - 1;
  return (sdpMessages + iceMessages) * fanout;
}
