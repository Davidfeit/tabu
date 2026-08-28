import type { PeerState } from "@/net/mesh";
import type { SignalStats } from "@/net/transport";

/**
 * שורות האבחון של הווידאו.
 *
 * הפונקציה טהורה בכוונה: זה מה שאפשר לבדוק, ובלי זה כל תקלת וידאו נראית
 * מהמסך אותו דבר בדיוק — ריבוע שחור. כל שורה כאן מפרידה בין שלב לשלב
 * בשרשרת: מי בכלל מבוקש, האם נוצר חיבור, האם הסיגנלינג יצא, האם הוא
 * חזר, והאם ICE הצליח.
 */
export interface DiagInput {
  selfId: string;
  /** מזהי העמיתים שהמצב החי אומר שצריך להתחבר אליהם. */
  wanted: string[];
  peers: PeerState[];
  stats?: SignalStats;
  relayError?: string | null;
}

/** ארבעה תווים מספיקים לזיהוי, ומזהה מלא לא נכנס למסך. */
export const short = (id: string): string => id.slice(0, 4);

export function diagLines(d: DiagInput): string[] {
  const lines: string[] = [];
  lines.push(`אני ${short(d.selfId)} · מבוקשים: ${
    d.wanted.length ? d.wanted.map(short).join(", ") : "אין"}`);

  if (d.wanted.length === 0) {
    lines.push("אין עמיתים ברשימה — אף אחד אחר לא נמצא במצב המשחק");
  } else if (d.peers.length === 0) {
    lines.push("הרשימה לא הגיעה למנוע החיבורים — לא נוצר אף RTCPeerConnection");
  }

  for (const p of d.peers) {
    const track = p.stream ? "יש מסלול וידאו" : "בלי מסלול";
    lines.push(`${short(p.id)}: ${p.connection} · ${track}${p.relayed ? " · דרך ממסר" : ""}`);
  }

  if (d.stats) {
    const { sent, failed, received, forMe } = d.stats;
    lines.push(`סיגנלינג: נשלחו ${sent}${failed ? `, נכשלו ${failed}` : ""}` +
               ` · התקבלו ${received} (אליי ${forMe})`);
    // ההבחנה החשובה: יצא ולא חזר כלום = הממסר או השידור; חזר אבל לא אליי
    // = הצד השני משדר, והנמען לא תואם.
    if (sent > 0 && received === 0) {
      lines.push("יצאו הודעות ולא חזרה אף אחת — השידור מהשרת לא מגיע לערוץ");
    } else if (received > 0 && forMe === 0) {
      lines.push("מגיעות הודעות, אף אחת לא ממוענת אליי — המזהים לא תואמים");
    }
  }

  if (d.relayError) lines.push(d.relayError);
  return lines;
}

/** האם בכלל להציג — ברגע שכל מי שמבוקש משדר, אין מה לאבחן. */
export function needsDiag(d: Pick<DiagInput, "wanted" | "peers">): boolean {
  if (d.wanted.length === 0) return false;
  return d.wanted.some((id) => !d.peers.find((p) => p.id === id)?.stream);
}
