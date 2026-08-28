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
  /** השחקנים שעל הלוח, לבדיקת השיוך למשבצות. */
  players?: { name: string; userId: string }[];
  stats?: SignalStats;
  relayError?: string | null;
}

/**
 * מזהה מקוצר לתצוגה.
 *
 * שישה תווים ולא ארבעה: עם ארבעה שני מזהים שונים יכולים להיראות זהים
 * על המסך, וזה בדיוק מה שהופך "המזהים לא תואמים" לבלתי ניתן לזיהוי.
 */
export const short = (id: string): string => id.slice(0, 6);

export function diagLines(d: DiagInput): string[] {
  const lines: string[] = [];
  lines.push(`אני ${short(d.selfId)} · מבוקשים: ${
    d.wanted.length ? d.wanted.map(short).join(", ") : "אין"}`);

  // השיוך משבצת→עמית נעשה לפי מזהה משתמש, ואם הוא לא תואם רואים בו-זמנית
  // "מחובר" באבחון ו"לא נוצר חיבור" על המשבצת. בלי השורה הזו הסתירה הזו
  // בלתי ניתנת לפענוח מהמסך.
  for (const p of d.players ?? []) {
    if (p.userId === d.selfId) continue;
    const match = d.peers.find((x) => x.id === p.userId);
    lines.push(`משבצת ${p.name} (${short(p.userId)}): ${
      !match ? "אין עמית תואם" : match.stream ? "עמית עם זרם" : "עמית בלי זרם"}`);
  }

  if (d.wanted.length === 0) {
    lines.push("אין עמיתים ברשימה — אף אחד אחר לא נמצא במצב המשחק");
  } else if (d.peers.length === 0) {
    lines.push("הרשימה לא הגיעה למנוע החיבורים — לא נוצר אף RTCPeerConnection");
  }

  for (const p of d.peers) {
    const track = !p.stream ? "בלי מסלול"
      : p.video.tracks === 0 ? "זרם בלי מסלול וידאו"
      : p.video.muted ? "מסלול קיים אבל לא זורמים פריימים"
      : p.video.live ? "וידאו זורם" : "מסלול לא פעיל";
    lines.push(`${short(p.id)}: ${p.connection}/${p.signaling} · ${track}` +
               `${p.relayed ? " · דרך ממסר" : ""} · ${p.polite ? "מנומס" : "לא מנומס"}`);
    // הכיוונים בנפרד: "שלחתי הצעה ולא קיבלתי תשובה" ו"קיבלתי הצעה ולא
    // עניתי" הן שתי תקלות הפוכות, ובלי הפירוט הן נראות אותו דבר.
    lines.push(`   ↑ הצעה ${p.out.offer} תשובה ${p.out.answer} ICE ${p.out.ice}` +
               ` · ↓ הצעה ${p.in.offer} תשובה ${p.in.answer} ICE ${p.in.ice}`);
    if (p.lastError) lines.push(`   ✗ ${p.lastError}`);
    // חיבור מוצלח שלא מציג כלום הוא תקלה אחרת לגמרי מכל מה שמעליו:
    // המשא ומתן הצליח, והבעיה היא בצד המשדר או בניגון אצלנו.
    if (p.connection === "connected" && p.stream && p.video.muted) {
      lines.push("   החיבור תקין והמסלול ריק — המצלמה שלו כבויה, "
        + "או שהחלון שלו ברקע ובלי מצלמה פעילה");
    }
    // תיאור מרוחק שלא הוחל הוא הגבול המדויק בין סיגנלינג ל-ICE.
    if (p.connection === "new" && p.in.offer + p.in.answer > 0 && !p.lastError) {
      lines.push("   הגיע SDP ולא הוחל — המשא ומתן נעצר, לא ICE");
    }
  }

  if (d.stats) {
    const { sent, failed, received, forMe, online } = d.stats;
    const others = online.filter((id) => id !== d.selfId);
    lines.push(`בערוץ עם וידאו: ${others.length ? others.map(short).join(", ") : "רק אני"}`);
    // הבחנה שאי אפשר להסיק ממספרים: אין תנועה כי אין רשת, או אין תנועה
    // כי הצד השני לא הפעיל וידאו בכלל.
    for (const id of d.wanted) {
      if (online.includes(id)) continue;
      // אסור להאשים אותו ב"לא מריץ וידאו" כשהודעות ממנו כבר הגיעו —
      // אז הוא בבירור מריץ, ומה שחסר זו רק ההכרזה, כלומר גרסה ישנה אצלו.
      const heard = d.peers.find((p) => p.id === id);
      const talking = heard && heard.in.offer + heard.in.answer + heard.in.ice > 0;
      lines.push(talking
        ? `${short(id)} שולח אבל לא מכריז נוכחות — גרסה ישנה אצלו, שירענן`
        : `${short(id)} לא מריץ וידאו — הוא לא אישר מצלמה, או שהוא במצב שלט בטלפון`);
    }
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

/**
 * האם בכלל להציג.
 *
 * "יש זרם" לא מספיק כתנאי כיבוי: בדיוק ברגע שהחיבור הצליח והמסך נשאר
 * שחור, האבחון נעלם — כלומר הוא כיבה את עצמו במקום היחיד שבו הוא הכי
 * נחוץ. התנאי הוא פריימים שזורמים באמת.
 */
export function needsDiag(d: Pick<DiagInput, "wanted" | "peers">): boolean {
  if (d.wanted.length === 0) return false;
  return d.wanted.some((id) => {
    const p = d.peers.find((x) => x.id === id);
    return !p?.stream || p.video.muted || !p.video.live;
  });
}
