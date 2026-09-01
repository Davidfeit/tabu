import type { PeerState } from "./mesh";

/**
 * מסלול התמונות — מתי הוא נכנס לפעולה.
 *
 * WebRTC מקבל הזדמנות מלאה קודם: תמונות לפני שהחיבור הישיר סיים לנסות
 * היו מסתירות וידאו אמיתי שבדרך. רק אחרי תקופת החסד, ורק כלפי עמיתים
 * שחיים בערוץ (נשמעו מהם הודעות או תמונות) אבל הווידאו מהם לא זורם,
 * מתחילים לצלם. עמית שותק לגמרי הוא שחקן טלפון — אין לו מסך וידאו,
 * ואין טעם לשלוח אליו.
 */
export const FRAME_GRACE_MS = 12_000;
/** תמונה כל כמה זמן. מהיר יותר = יותר קריאות שרת; איטי יותר = פחות פנים. */
export const FRAME_MS = 2_500;
/** תמונה שלא התחדשה נחשבת מתה — הצד השני כנראה סגר או שהווידאו חזר. */
export const FRAME_TTL_MS = 8_000;

/** האם הווידאו האמיתי מהעמית הזה זורם. */
export function flowing(p: PeerState): boolean {
  return p.stream !== null && p.video.live && !p.video.muted;
}

/** למי לשלוח עכשיו תמונה. */
export function framePlan(
  peers: readonly PeerState[],
  framesFrom: readonly string[],
  elapsedMs: number,
): string[] {
  if (elapsedMs < FRAME_GRACE_MS) return [];
  return peers
    .filter((p) => {
      const heard = p.in.offer + p.in.answer + p.in.ice > 0
        || framesFrom.includes(p.id);
      return heard && !flowing(p);
    })
    .map((p) => p.id);
}
