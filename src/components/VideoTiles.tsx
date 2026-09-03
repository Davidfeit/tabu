import { useEffect, useState } from "react";
import { flowing } from "@/net/frames";
import { videoInfo, type PeerState } from "@/net/mesh";
import { useDiag } from "@/ui/useDiag";
import type { MediaErrorKind } from "@/net/media";
import { iceInfo } from "@/net/supabase";
import type { SignalStats } from "@/net/transport";
import { diagLines, mediaBlocked, needsDiag } from "./videoDiag";
import { seatColor, Token } from "./Token";
import { VideoFrame } from "./VideoPanel";

const MEDIA_ERRORS: Record<MediaErrorKind, string> = {
  denied: "הגישה למצלמה נדחתה. אפשר לשנות זאת בהגדרות האתר בדפדפן.",
  no_device: "לא נמצאה מצלמה מחוברת.",
  in_use: "המצלמה תפוסה בידי תוכנה אחרת — נסו לסגור זום או טימס.",
  // המקרה הנפוץ באמת: העמוד מוצג בתוך מסגרת שאינה מתירה מצלמה.
  blocked_embed: "העמוד מוצג בתוך מסגרת שחוסמת גישה למצלמה — זו הגבלה של "
    + "המסגרת, לא של הדפדפן. פתחו את המשחק בחלון נפרד, או הריצו אותו מקומית.",
  constraints: "המצלמה לא תומכת בהגדרות הנדרשות.",
  unknown: "לא הצלחנו להפעיל את המצלמה.",
};

/** ארבעה מושבים קבועים, גם כשיושבים פחות. */
export const VIDEO_SEATS = [0, 1, 2, 3];

/**
 * מי מקבל משבצת וידאו.
 *
 * לא כל שחקן: מי שמשחק מהטלפון (שלט) לא מריץ מצלמה בכלל, ומשבצת שחורה
 * קבועה על שמו רק מקטינה את הווידאו של אלה שכן. לכן משבצת מקבלים אני,
 * וכל עמית שנשמעו ממנו סימני חיים בסיגנלינג או שיש ממנו זרם. בזמן
 * החסד הראשוני כולם מוצגים — כדי שמי שרק נטען לא ייעלם.
 */
export function visibleVideoPlayers<P extends { seat: number; userId: string }>(
  players: readonly P[], selfId: string, mySeat: number | null,
  peers: readonly PeerState[], patient: boolean,
  framesFrom?: ReadonlySet<string>,
): P[] {
  return players.filter((p) => {
    if (selfId ? p.userId === selfId : p.seat === mySeat) return true;
    if (patient) return true;
    if (framesFrom?.has(p.userId)) return true;   // תמונות = סימן חיים
    const peer = peers.find((x) => x.id === p.userId);
    if (!peer) return false;
    return peer.stream !== null
      || peer.in.offer + peer.in.answer + peer.in.ice > 0;
  });
}

/**
 * פריסת הרשת: תמיד 2×2, לא משנה כמה משתתפים יש.
 *
 * ניסינו לגזור את הפריסה ממספר המשתתפים, וזה נראה טוב יותר לרגע ורע יותר
 * בפועל: המשבצות זזות ומשנות גודל בכל הצטרפות, עזיבה או פשיטת רגל — בדיוק
 * ברגע שבו כולם מסתכלים על המסך — ואף אחד כבר לא יודע איפה לחפש את מי.
 * מקום קבוע לכל מושב שווה יותר מניצול מלא של השטח.
 *
 * המחיר ידוע ומקובל: המשבצת יוצאת כמעט ריבועית, המצלמה רחבה, ולכן נחתך
 * ממנה חלק מהרוחב.
 */
export function gridClass(_n?: number): string {
  return "grid-cols-2 grid-rows-2";
}

/**
 * ארבעת חלונות הווידאו, ממלאים את מרכז הלוח.
 *
 * הרשת 2×2 קבועה ולא נגזרת ממספר השחקנים: מסגרת שמשנה גודל כשמישהו מצטרף
 * או פושט רגל מזיזה את כל מה שסביבה, וזה בדיוק הרגע שבו מסתכלים על המסך.
 * מושב ריק נשאר ריק.
 */
/** מה שהמשבצות צריכות לדעת על המשחק — משותף למונופול ולשחמט. */
export interface VideoSeats {
  players: readonly {
    seat: number; userId: string; name: string; token: string; bankrupt?: boolean;
  }[];
  currentSeat: number;
}

export function VideoTiles({
  state, mySeat, local, peers, error, relayError, wanted = [], selfId = "", stats,
  videoOn = true, onToggleVideo, frames, seats = VIDEO_SEATS, grid = gridClass(),
  diagBelow = false,
}: {
  state: VideoSeats;
  /** אילו מושבים מקבלים משבצת. ברירת המחדל: ארבעת הראשונים. */
  seats?: number[];
  /** מחלקות הרשת. ברירת המחדל: 2×2 קבוע. */
  grid?: string;
  /**
   * להציג את האבחון *מתחת* למשבצות ולא מעליהן.
   *
   * במרכז לוח המונופול יש מקום, ושכבה תחתונה שקופה לא מסתירה פנים. בשחמט
   * העמודה צרה וגבוהה, ואותה שכבה כיסתה משבצת שלמה — כלומר האבחון הסתיר
   * בדיוק את מה שבאנו לאבחן.
   */
  diagBelow?: boolean;
  mySeat: number | null;
  local: MediaStream | null;
  peers: PeerState[];
  error: MediaErrorKind | null;
  /** תקלה בממסר הסיגנלינג, אם הייתה. */
  relayError?: string | null;
  /** מי אמור להיות מחובר, לפי המצב החי. לאבחון. */
  wanted?: string[];
  selfId?: string;
  stats?: SignalStats;
  /** האם המצלמה דולקת. כשהיא כבויה אין מה לאבחן. */
  videoOn?: boolean;
  onToggleVideo?: () => void;
  /** תמונות סטילס מהעמיתים — המסלול העוקף כשוידאו ישיר לא נסגר. */
  frames?: Map<string, string>;
}) {
  const byUser = new Map(peers.map((p) => [p.id, p]));
  // האבחון כבוי כברירת מחדל — הוא כלי לפתרון תקלה, לא חלק מהמשחק.
  const diag = useDiag();

  // תקופת חסד: רבע דקה שבה כולם מקבלים משבצת, כי חיבור וידאו לוקח כמה
  // שניות ומשבצת שנעלמת ומופיעה גרועה ממשבצת ריקה. אחריה, מי שלא נשמע
  // ממנו דבר — שחקן טלפון, או מי שוויתר על מצלמה — משאיר את המשבצת שלו
  // ריקה במקום להציג בה תקלה שאינה תקלה.
  const [patient, setPatient] = useState(true);
  useEffect(() => {
    if (!videoOn) return;
    setPatient(true);
    const t = setTimeout(() => setPatient(false), 15_000);
    return () => clearTimeout(t);
  }, [videoOn]);

  const seated = seats.map((s) => state.players[s])
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const shown = visibleVideoPlayers(seated, selfId, mySeat, peers, patient,
                                    new Set(frames?.keys() ?? []));

  return (
    <div className={`relative h-full w-full ${diagBelow ? "flex flex-col gap-1" : ""}`}>
      <div className={`grid w-full gap-[3%] ${diagBelow ? "min-h-0 flex-1" : "h-full"} ${grid}`}>
        {seats.map((seat) => {
          // המשבצת שייכת למושב, לא למקום ברשימה: כך שחקן שמוותר על מצלמה
          // או יוצא מהמשחק לא מזיז את כל מי שיושב אחריו.
          const p = shown.find((x) => x.seat === seat);
          if (!p) {
            const sitting = seated.find((x) => x.seat === seat);
            return <EmptySeat key={seat} name={sitting?.name} seat={seat} />;
          }
          // לפי מזהה ולא לפי מושב: כשהמספור מתפצל, "אני" נופל על המשבצת
          // של מישהו אחר — ואז המצלמה שלי מוצגת שם, והזרם שלו לא מוצג בכלל.
          const isMe = selfId ? p.userId === selfId : p.seat === mySeat;
          const peer = byUser.get(p.userId);
          // וידאו זורם עדיף תמיד; כשאין — תמונת סטילס; ורק בהיעדר שתיהן,
          // הרמז הטקסטואלי.
          const live = isMe || (peer !== undefined && flowing(peer));
          const stream = isMe ? local : live ? peer!.stream : null;
          const frame = !isMe && !live ? frames?.get(p.userId) ?? null : null;
          return (
            <SeatTile key={seat}
                      name={p.name + (isMe ? " (את/ה)" : "")}
                      seat={p.seat}
                      token={p.token}
                      stream={stream}
                      frame={frame}
                      mirrored={isMe}
                      dimmed={p.bankrupt}
                      active={p.seat === state.currentSeat && !p.bankrupt}
                      hint={isMe || !videoOn || frame ? undefined
                            : peerHint(peer, relayError)} />
          );
        })}
      </div>

      {onToggleVideo && (
        <button onClick={onToggleVideo}
                className="toy-btn absolute right-1 top-1 z-10 !px-2.5 !py-1 !text-[0.66rem]">
          {videoOn ? "כיבוי מצלמה" : "הפעלת מצלמה"}
        </button>
      )}

      {videoOn && diag && (
        <VideoDiag selfId={selfId} wanted={wanted} peers={peers} below={diagBelow}
                   players={state.players.map((p) => ({ name: p.name, userId: p.userId }))}
                   stats={stats} relayError={relayError} />
      )}

      {videoOn && error && (
        <p className="pointer-events-none absolute inset-x-[8%] bottom-[2%] rounded
                      bg-black/75 px-2 py-1 text-center text-[0.62rem] leading-snug
                      text-amber-200/90">
          {MEDIA_ERRORS[error]}
        </p>
      )}
    </div>
  );
}

/**
 * מה קרה לחיבור של העמית הזה.
 *
 * "מתחבר…" לבדו לא הבחין בין שלושה מצבים שונים לגמרי: עמית שלא נוצר לו
 * חיבור בכלל (סיגנלינג חסום), חיבור שמנסה ונכשל (NAT בלי ממסר), וחיבור
 * מוצלח שפשוט לא הביא מסלול וידאו. בלי ההבחנה הזו כל תקלה נראתה זהה.
 */
/**
 * מה לומר לשחקן על משבצת בלי וידאו.
 *
 * בשפה שלו ולא בשפה שלי: "ICE נכשל — נדרש ממסר TURN" נכון לגמרי, ולא
 * עוזר לאף אחד שיושב לשחק. ההבחנות הטכניות עברו לשורות האבחון, שמופיעות
 * רק כשמדליקים אותן; כאן נשאר מה שיש לשחקן מה לעשות איתו, או לפחות
 * להבין ממנו.
 */
export function peerHint(peer: PeerState | undefined, relayError?: string | null): string | undefined {
  if (relayError) return relayError;
  if (!peer) return "מתחבר…";
  switch (peer.connection) {
    case "connected":
      // ההבחנה היחידה שהמדידה קונה לנו, והיא שווה אמירה: אנחנו משדרים
      // ולא מגיע דבר, כלומר הרשת חוסמת ולא המצלמה שלו.
      return mediaBlocked(peer) ? "הרשת חוסמת את הווידאו" : "המצלמה שלו כבויה";
    case "failed":       return "אין חיבור וידאו";
    case "disconnected": return "החיבור נותק";
    case "closed":       return "אין וידאו";
    default:             return "מתחבר…";
  }
}

export function SeatTile({ name, seat, token, stream, frame, mirrored, active, dimmed, hint }: {
  name: string; seat: number; token: string;
  stream: MediaStream | null; frame?: string | null; mirrored: boolean;
  active: boolean; dimmed?: boolean; hint?: string;
}) {
  return (
    <div className={`relative min-h-0 min-w-0 overflow-hidden rounded-2xl border-[3px]
                     bg-black/45 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)]
                     ${dimmed ? "opacity-40" : ""}
                     ${active ? "border-toy-sun ring-4 ring-toy-sun/40"
                              : "border-white/85"}`}>
      {stream ? <VideoFrame stream={stream} mirrored={mirrored} /> : frame ? (
        <>
          <img src={frame} alt={`תמונה מ${name}`}
               className="h-full w-full object-cover" />
          {/* שיהיה ברור שזה לא וידאו תקוע אלא מסלול אחר, חי */}
          <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5
                           text-[0.6rem] text-amber-200/90">
            תמונות · הרשת חוסמת וידאו
          </span>
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
          <Token token={token} seat={seat} size="22%" dimmed={dimmed} />
          {/* קריא בצילום מסך, בכוונה: זו השורה שאומרת למה אין וידאו, ובלי
              שאפשר לקרוא אותה היא לא שווה כלום. */}
          {hint && (
            <span className="max-w-full rounded bg-black/70 px-2 py-1 text-center
                             text-[0.8rem] leading-snug text-amber-200/95">
              {hint}
            </span>
          )}
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-1
                       text-center font-display text-[0.7rem] font-bold"
            style={{ color: seatColor(seat), unicodeBidi: "plaintext" }}>
        {name}
      </span>
    </div>
  );
}

/**
 * משבצת בלי וידאו.
 *
 * שני מצבים שונים שנראו פעם זהים: מושב שאין בו אף אחד, ומושב שיש בו שחקן
 * שפשוט לא משדר — בשלט מהטלפון, או עם מצלמה כבויה. השני הוא לא תקלה, ולכן
 * הוא מקבל את השם ולא הודעת שגיאה.
 */
export function EmptySeat({ name, seat }: { name?: string; seat?: number } = {}) {
  return (
    <div className="flex min-h-0 min-w-0 items-center justify-center rounded-2xl border-[3px]
                    border-dashed border-white/40 px-2 text-center text-[0.68rem] text-white/45">
      {name
        ? <span className="font-display font-bold" style={{
            color: seat === undefined ? undefined : seatColor(seat),
            opacity: 0.75, unicodeBidi: "plaintext",
          }}>{name}</span>
        : "מושב פנוי"}
    </div>
  );
}

/**
 * אבחון חי מתחת לחלונות.
 *
 * המונים ומצב המסלולים משתנים מחוץ ל-React, ולכן רענון בשעון — וגם
 * ההחלטה אם להציג בכלל מתקבלת כאן, על נתונים טריים. כשהיא התקבלה
 * למעלה, על צילום המצב האחרון של ה-mesh, השורה נשארה תקועה על
 * "לא זורמים פריימים" בזמן שהווידאו כבר זרם: אירוע ה-unmute יכול
 * להקדים את ההאזנה לו, ואז אין מה שיעדכן.
 */
function VideoDiag({ selfId, wanted, peers, players, stats, relayError, below }: {
  selfId: string; wanted: string[]; peers: PeerState[];
  players: { name: string; userId: string }[];
  stats?: SignalStats; relayError?: string | null; below?: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // נקרא מהמסלולים עצמם עכשיו, ולא מצילום מצב ישן.
  const live = peers.map((p) => ({ ...p, video: videoInfo(p.stream) }));
  if (!needsDiag({ wanted, peers: live })) return null;

  return (
    <div dir="rtl"
         className={`space-y-0.5 bg-black/70 px-2 py-1 text-[0.6rem] leading-tight
                     text-amber-200/90 ${below
                       ? "max-h-40 shrink-0 overflow-y-auto rounded-xl"
                       : "pointer-events-none absolute inset-x-0 bottom-0"}`}>
      {diagLines({ selfId, wanted, peers: live, players, stats, relayError, ice: iceInfo() })
        .map((l) => (
          <div key={l} style={{ unicodeBidi: "plaintext" }}>{l}</div>
        ))}
    </div>
  );
}
