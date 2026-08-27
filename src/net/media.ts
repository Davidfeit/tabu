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
 * המשבצות במרכז הלוח קטנות וכולן באותו גודל — ולכן אין צורך ב-simulcast,
 * מה שבדרך כלל הורג mesh. אבל צילום גדול והקטנה פר-שולח עולה פי חמש
 * בעבודת שינוי גודל, גם בדסקטופ.
 */
export const CAPTURE: MediaStreamConstraints = {
  video: {
    width: { ideal: 320 }, height: { ideal: 180 },
    frameRate: { ideal: 15, max: 20 },
  },
  audio: {
    echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  },
};

export const MAX_BITRATE = 150_000;

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

/** מקבע תקרת קצב לכל שולח, כדי ש-6 זרמים לא יחנקו את ההעלאה. */
export async function capSender(sender: RTCRtpSender): Promise<void> {
  const params = sender.getParameters();
  if (!params.encodings?.length) params.encodings = [{}];
  params.encodings[0]!.maxBitrate = MAX_BITRATE;
  params.encodings[0]!.maxFramerate = 15;
  try { await sender.setParameters(params); } catch { /* לא קריטי */ }
}
