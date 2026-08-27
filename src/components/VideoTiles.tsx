import type { PeerState } from "@/net/mesh";
import type { MediaErrorKind } from "@/net/media";
import type { GameState } from "@/engine/types";
import { seatColor, Token } from "./Token";
import { VideoFrame } from "./VideoPanel";

const MEDIA_ERRORS: Record<MediaErrorKind, string> = {
  denied: "הגישה למצלמה נדחתה. אפשר לשנות זאת בהגדרות האתר בדפדפן.",
  no_device: "לא נמצאה מצלמה מחוברת.",
  in_use: "המצלמה תפוסה בידי תוכנה אחרת — נסו לסגור זום או טימס.",
  unsupported: "הדפדפן הזה לא תומך בשיחת וידאו. נסו כרום, ספארי או פיירפוקס.",
  constraints: "המצלמה לא תומכת בהגדרות הנדרשות.",
  unknown: "לא הצלחנו להפעיל את המצלמה.",
};

export function VideoTiles({
  state, mySeat, local, peers, error,
}: {
  state: GameState;
  mySeat: number | null;
  local: MediaStream | null;
  peers: PeerState[];
  error: MediaErrorKind | null;
}) {
  const active = state.players.filter((p) => !p.bankrupt);
  const byUser = new Map(peers.map((p) => [p.id, p]));
  const cols = Math.min(active.length, 3);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {active.map((p) => {
          const isMe = p.seat === mySeat;
          const peer = byUser.get(p.userId);
          const stream = isMe ? local : peer?.stream ?? null;
          const live = stream !== null;
          return (
            <div key={p.seat}
                 className={`relative aspect-[4/3] w-[7rem] overflow-hidden rounded-md border
                             bg-black/40 ${p.seat === state.currentSeat
                               ? "border-amber-400/80 ring-1 ring-amber-400/40"
                               : "border-white/10"}`}>
              {live ? (
                <VideoFrame stream={stream} mirrored={isMe} />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                  <Token token={p.token} seat={p.seat} size={24} />
                  {peer && peer.connection !== "connected" && (
                    <span className="text-[0.55rem] text-parchment/40">מתחבר…</span>
                  )}
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1
                               py-0.5 text-center text-[0.58rem] font-medium"
                    style={{ color: seatColor(p.seat), unicodeBidi: "plaintext" }}>
                {p.name}{isMe && " (את/ה)"}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="max-w-[22rem] text-center text-[0.66rem] leading-snug text-amber-200/80">
          {MEDIA_ERRORS[error]}
        </p>
      )}
    </div>
  );
}
