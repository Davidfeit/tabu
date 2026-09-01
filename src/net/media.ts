/**
 * מדיה מקומית.
 *
 * ── למה זרם אחד לכל אורך החיים ──
 * קריאה שנייה ל-getUserMedia עבור סוג מדיה שכבר מוחזק **משתיקה לצמיתות**
 * את הזרם הקודם בספארי, בלי דרך תוכנתית לבטל; אפל מחשיבה זאת להתנהגות
 * תקינה. בכרום זה פחות חמור אבל הדפוס נכון בכל מקרה. לכן תופסים פעם אחת
 * ומחזיקים, ולהחלפת מצלמה משתמשים ב-replaceTrack.
 */

/**
 * מצלמים ישר ברזולוציית היעד, ולא 720p עם הקטנה.
 *
 * אין כאן simulcast — כל המשבצות באותו גודל, ולכן אין למי לשלוח איכות
 * שונה — וצילום גדול והקטנה פר-שולח עולה פי חמש בעבודת שינוי גודל.
 *
 * ‏320×180 נבחר כשהיעד היה משבצת של כ-320 פיקסלים במסך רגיל. במסך Retina
 * אותה משבצת היא 650 פיקסלים אמיתיים, והמשבצת גם חותכת מהרוחב — כלומר
 * החלק הנראה של פריים 320 נמתח פי שניים ומעלה. 640×360 מכסה את זה,
 * ועדיין זעום מבחינת רוחב פס.
 */
export const CAPTURE: MediaStreamConstraints = {
  video: {
    width: { ideal: 640 }, height: { ideal: 360 },
    frameRate: { ideal: 15, max: 20 },
  },
  audio: {
    echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  },
};

/**
 * תקרת קצב לשולח יחיד.
 *
 * ‏400kb/s ל-640×360 ב-15 פריימים לשנייה זה נוח לקודק, ובמשחק של שעתיים
 * עם שלושה משתתפים זה פחות מגיגה-בייט דרך הממסר — שבריר מהמכסה החינמית.
 */
export const MAX_BITRATE = 400_000;

/**
 * תקציב ההעלאה הכולל.
 *
 * ב-mesh כל אחד שולח עותק נפרד לכל שאר המשתתפים, ולכן ההעלאה גדלה
 * לינארית איתם — וקו ביתי שנחנק לא נראה כמו עומס אלא כמו וידאו מקוטע.
 * התקציב קבוע, והאיכות לשולח נגזרת ממנו: שניים־שלושה מקבלים את המקסימום,
 * שולחן מלא מקבל פחות לכל אחד.
 */
export const UPLINK_BUDGET = 1_000_000;

/** הקצב לכל עמית, בהינתן כמה עמיתים יש כרגע. */
export function bitrateFor(peers: number): number {
  return Math.min(MAX_BITRATE, Math.round(UPLINK_BUDGET / Math.max(1, peers)));
}

export type MediaErrorKind =
  | "denied" | "no_device" | "in_use" | "constraints" | "unknown"
  /** נחסם ע"י מדיניות הרשאות — עמוד מוטמע במסגרת בלי allow="camera". */
  | "blocked_embed";

/** קודי שגיאה מכונתיים. הנוסח העברי חי ב-UI, כמו בכל השאר. */
export function classifyMediaError(err: unknown): MediaErrorKind {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError": return "denied";
    // ב-iframe עם מקור אטום, getUserMedia זורק SecurityError ולא
    // NotAllowedError — זו חסימת מדיניות, לא סירוב של המשתמש.
    case "SecurityError": return "blocked_embed";
    case "NotFoundError": case "DevicesNotFoundError": return "no_device";
    // נפוץ מאוד בווינדוס: זום או טימס מחזיקים את המצלמה.
    case "NotReadableError": case "TrackStartError": return "in_use";
    case "OverconstrainedError": case "ConstraintNotSatisfiedError": return "constraints";
    default: return "unknown";
  }
}

export type MediaBlock = "ok" | "no_webrtc" | "insecure" | "embedded" | "no_api";

export interface MediaDiagnosis {
  block: MediaBlock;
  embedded: boolean;
  secure: boolean;
  /** תוצאת Permissions Policy, או null אם הדפדפן לא חושף אותה. */
  policy: boolean | null;
  hasApi: boolean;
  hasRtc: boolean;
}

/**
 * למה אי אפשר להפעיל מצלמה — בדיוק.
 *
 * ── למה לא סתם "הדפדפן לא נתמך" ──
 * זו הייתה ההודעה הקודמת, והיא הופיעה בכרום עדכני. היא גם האשימה את
 * הגורם הלא נכון וגם לא הובילה לשום פעולה. הסיבה האמיתית הייתה שהעמוד
 * רץ בתוך מסגרת עם מקור אטום: שם navigator.mediaDevices דווקא קיים
 * וההקשר מאובטח, אבל Permissions Policy חוסם, ו-getUserMedia זורק
 * SecurityError.
 */
export function diagnoseMedia(): MediaDiagnosis {
  const hasRtc = typeof RTCPeerConnection !== "undefined";
  const hasApi = typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia;
  const secure = typeof window === "undefined" ? false : window.isSecureContext !== false;
  const embedded = typeof window !== "undefined" && window.self !== window.top;

  let policy: boolean | null = null;
  try {
    const fp = (document as unknown as {
      featurePolicy?: { allowsFeature: (f: string) => boolean };
    }).featurePolicy;
    policy = fp ? fp.allowsFeature("camera") : null;
  } catch { policy = null; }

  const block: MediaBlock =
    !hasRtc ? "no_webrtc"
    : !secure ? "insecure"
    : policy === false ? "embedded"
    : !hasApi ? "no_api"
    : "ok";

  return { block, embedded, secure, policy, hasApi, hasRtc };
}

/** שורת אבחון קצרה, לתמיכה. אומרת מה באמת נמדד ולא מה שוער. */
export function diagnosisLine(d: MediaDiagnosis): string {
  return [
    `secure=${d.secure ? "כן" : "לא"}`,
    `מוטמע=${d.embedded ? "כן" : "לא"}`,
    `מדיניות=${d.policy === null ? "לא ידוע" : d.policy ? "מותר" : "חסום"}`,
    `API=${d.hasApi ? "יש" : "אין"}`,
    `WebRTC=${d.hasRtc ? "יש" : "אין"}`,
  ].join(" · ");
}

export function mediaSupported(): boolean {
  return diagnoseMedia().block === "ok";
}

let held: MediaStream | null = null;

/** תופס את הזרם המקומי פעם אחת ומחזיר את אותו אובייקט בכל קריאה נוספת. */
export async function acquireLocalStream(): Promise<MediaStream> {
  if (held && held.getTracks().some((t) => t.readyState === "live")) return held;
  held = await navigator.mediaDevices.getUserMedia(CAPTURE);
  return held;
}

export function releaseLocalStream(): void {
  held?.getTracks().forEach((t) => t.stop());
  held = null;
}

/** מקבע תקרת קצב לשולח, כדי שכמה זרמים לא יחנקו את ההעלאה. */
export async function capSender(sender: RTCRtpSender, peers = 5): Promise<void> {
  const params = sender.getParameters();
  if (!params.encodings?.length) params.encodings = [{}];
  params.encodings[0]!.maxBitrate = bitrateFor(peers);
  params.encodings[0]!.maxFramerate = 15;
  try { await sender.setParameters(params); } catch { /* לא קריטי */ }
}

/**
 * צילום סטילס מהמצלמה, לתמונות מצב מהמוצא האחרון.
 *
 * וידאו נסתר שמנגן את הזרם המקומי, וקנבס שמצלם ממנו. ImageCapture היה
 * חוסך את שניהם, אבל הוא קיים רק בכרום — והטלפונים כאן הם כל הסיפור.
 */
export class FrameGrabber {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;

  constructor(stream: MediaStream) {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    void this.video.play().catch(() => { /* מושתק — לא אמור להיחסם */ });
    this.canvas = document.createElement("canvas");
  }

  /** JPEG קטן כ-data URL, או null אם עוד אין פריים לצלם. */
  grab(): string | null {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    if (!vw || !vh) return null;
    const w = 320, h = Math.round((320 * vh) / vw);
    this.canvas.width = w; this.canvas.height = h;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, w, h);
    // איכות 0.5: ‏6–12KB לתמונה. מספיק לפנים, קטן מספיק לערוץ.
    try { return this.canvas.toDataURL("image/jpeg", 0.5); } catch { return null; }
  }

  dispose(): void {
    this.video.srcObject = null;
    this.video.remove();
    this.canvas.remove();
  }
}
