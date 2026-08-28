import type { PeerState } from "@/net/mesh";
import type { MediaErrorKind } from "@/net/media";
import type { GameState } from "@/engine/types";
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
  state, mySeat, local, peers, error,
}: {
  state: GameState;
  mySeat: number | null;
  local: MediaStream | null;
  peers: PeerState[];
  error: MediaErrorKind | null;
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
          const connecting = !isMe && peer !== undefined && peer.connection !== "connected";
          return (
            <SeatTile key={seat}
                      name={p.name + (isMe ? " (את/ה)" : "")}
                      seat={p.seat}
                      token={p.token}
                      stream={stream}
                      mirrored={isMe}
                      dimmed={p.bankrupt}
                      active={p.seat === state.currentSeat && !p.bankrupt}
                      hint={connecting ? "מתחבר…" : undefined} />
          );
        })}
      </div>

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
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
          <Token token={token} seat={seat} size="26%" dimmed={dimmed} />
          {hint && <span className="text-[0.6rem] text-parchment/40">{hint}</span>}
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
