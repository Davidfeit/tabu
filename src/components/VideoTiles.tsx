import { useEffect, useState } from "react";
import { videoInfo, type PeerState } from "@/net/mesh";
import type { MediaErrorKind } from "@/net/media";
import type { SignalStats } from "@/net/transport";
import type { GameState } from "@/engine/types";
import { diagLines, needsDiag } from "./videoDiag";
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
 * ארבעת חלונות הווידאו, ממלאים את מרכז הלוח.
 *
 * הרשת 2×2 קבועה ולא נגזרת ממספר השחקנים: מסגרת שמשנה גודל כשמישהו מצטרף
 * או פושט רגל מזיזה את כל מה שסביבה, וזה בדיוק הרגע שבו מסתכלים על המסך.
 * מושב ריק נשאר ריק.
 */
export function VideoTiles({
  state, mySeat, local, peers, error, relayError, wanted = [], selfId = "", stats,
}: {
  state: GameState;
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
}) {
  const byUser = new Map(peers.map((p) => [p.id, p]));

  return (
    <div className="relative h-full w-full">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[3%]">
        {VIDEO_SEATS.map((seat) => {
          const p = state.players[seat];
          if (!p) return <EmptySeat key={seat} />;
          const isMe = p.seat === mySeat;
          const peer = byUser.get(p.userId);
          const stream = isMe ? local : peer?.stream ?? null;
          return (
            <SeatTile key={seat}
                      name={p.name + (isMe ? " (את/ה)" : "")}
                      seat={p.seat}
                      token={p.token}
                      stream={stream}
                      mirrored={isMe}
                      dimmed={p.bankrupt}
                      active={p.seat === state.currentSeat && !p.bankrupt}
                      hint={isMe ? undefined : peerHint(peer, relayError)} />
          );
        })}
      </div>

      <VideoDiag selfId={selfId} wanted={wanted} peers={peers}
                 stats={stats} relayError={relayError} />

      {error && (
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
export function peerHint(peer: PeerState | undefined, relayError?: string | null): string | undefined {
  if (relayError) return relayError;
  if (!peer) return "לא נוצר חיבור לעמית";
  switch (peer.connection) {
    case "connected":    return "מחובר, בלי וידאו";
    case "failed":       return "ICE נכשל — נדרש ממסר TURN";
    case "disconnected": return "החיבור נותק";
    case "closed":       return "החיבור נסגר";
    // ההבחנה שחסרה: new = אף הודעת סיגנלינג לא הגיעה מהצד השני, ולכן אין
    // עדיין תיאור מרוחק. connecting = ההודעות עברו ו-ICE באמת מנסה.
    case "new":          return "ממתין לתשובה מהצד השני — הסיגנלינג לא הגיע";
    default:             return "מתחבר… (ICE)";
  }
}

export function SeatTile({ name, seat, token, stream, mirrored, active, dimmed, hint }: {
  name: string; seat: number; token: string;
  stream: MediaStream | null; mirrored: boolean;
  active: boolean; dimmed?: boolean; hint?: string;
}) {
  return (
    <div className={`relative min-h-0 min-w-0 overflow-hidden rounded-lg border bg-black/45
                     ${dimmed ? "opacity-40" : ""}
                     ${active ? "border-amber-400/80 ring-2 ring-amber-400/35"
                              : "border-white/10"}`}>
      {stream ? <VideoFrame stream={stream} mirrored={mirrored} /> : (
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
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5
                       text-center text-[0.68rem] font-medium"
            style={{ color: seatColor(seat), unicodeBidi: "plaintext" }}>
        {name}
      </span>
    </div>
  );
}

export function EmptySeat() {
  return (
    <div className="flex min-h-0 min-w-0 items-center justify-center rounded-lg border
                    border-dashed border-white/10 text-[0.66rem] text-parchment/25">
      מושב פנוי
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
function VideoDiag({ selfId, wanted, peers, stats, relayError }: {
  selfId: string; wanted: string[]; peers: PeerState[];
  stats?: SignalStats; relayError?: string | null;
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
    <div dir="rtl" className="pointer-events-none absolute inset-x-0 bottom-0 space-y-0.5
                              bg-black/70 px-2 py-1 text-[0.6rem] leading-tight
                              text-amber-200/90">
      {diagLines({ selfId, wanted, peers: live, stats, relayError }).map((l) => (
        <div key={l} style={{ unicodeBidi: "plaintext" }}>{l}</div>
      ))}
    </div>
  );
}
