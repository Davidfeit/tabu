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
  | "denied" | "no_device" | "in_use" | "unsupported" | "constraints" | "unknown";

/** קודי שגיאה מכונתיים. הנוסח העברי חי ב-UI, כמו בכל השאר. */
export function classifyMediaError(err: unknown): MediaErrorKind {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError": case "SecurityError": return "denied";
    case "NotFoundError": case "DevicesNotFoundError": return "no_device";
    // נפוץ מאוד בווינדוס: זום או טימס מחזיקים את המצלמה.
    case "NotReadableError": case "TrackStartError": return "in_use";
    case "OverconstrainedError": case "ConstraintNotSatisfiedError": return "constraints";
    case "TypeError": return "unsupported";
    default: return "unknown";
  }
}

/**
 * דפדפן שמסוגל בכלל ל-WebRTC.
 * getUserMedia זמין רק בהקשר מאובטח (https או localhost).
 */
export function mediaSupported(): boolean {
  return typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof RTCPeerConnection !== "undefined";
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
