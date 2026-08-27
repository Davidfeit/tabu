import { useEffect, useMemo, useRef, useState } from "react";
import { diagnosisLine, type MediaErrorKind } from "@/net/media";
import type { PeerState } from "@/net/mesh";
import { BroadcastTransport, type SignalTransport } from "@/net/transport";
import { useGame } from "@/ui/GameContext";
import { useMesh } from "@/ui/useMesh";
import { Button } from "./Button";
import { seatColor, Token } from "./Token";

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

export function VideoFrame({ stream, mirrored }: {
  stream: MediaStream | null; mirrored: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    // ספארי חוסם הפעלה קולית עד למחוות משתמש; כישלון כאן אינו חריג.
    void el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream]);

  return (
    <video ref={ref}
           // playsinline חובה — בלעדיו ספארי כופה מסך מלא.
           playsInline autoPlay
           // התצוגה העצמית מושתקת תמיד, אחרת נוצר משוב אקוסטי.
           muted={mirrored}
           className="h-full w-full object-cover"
           // מראה רק על עצמך. לעולם לא על המשתתפים האחרים.
           style={mirrored ? { transform: "scaleX(-1)" } : undefined} />
  );
}

function Tile({ label, color, stream, mirrored, active, hint }: {
  label: string; color?: string; stream: MediaStream | null;
  mirrored: boolean; active: boolean; hint?: string;
}) {
  return (
    <div className={`relative aspect-[4/3] w-[7.5rem] overflow-hidden rounded-md border
                     bg-black/35 ${active ? "border-amber-400/75 ring-1 ring-amber-400/30"
                                          : "border-white/12"}`}>
      {stream ? <VideoFrame stream={stream} mirrored={mirrored} /> : (
        <div className="flex h-full w-full items-center justify-center
                        text-[0.58rem] text-parchment/35">
          {hint ?? "מתחבר…"}
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5
                       text-center text-[0.58rem] font-medium"
            style={{ color: color ?? "#e8e0cd", unicodeBidi: "plaintext" }}>
        {label}
      </span>
    </div>
  );
}

/**
 * וידאו במשחק המקומי.
 *
 * ── מה זה באמת מריץ ──
 * הסיגנלינג עובר ב-BroadcastChannel בין כרטיסיות של אותו דפדפן, אבל
 * החיבור עצמו הוא WebRTC אמיתי — אותו PeerMesh שירוץ בפרודקשן, עם אותה
 * negotiation ואותן תקרות קצב. פתיחת כרטיסייה שנייה של העמוד מדגימה את
 * הרשת המלאה בלי להעמיד תשתית.
 *
 * במשחק מקוון התעבורה מוחלפת ב-Supabase Realtime, וכל שחקן מקבל משבצת.
 */
/**
 * מוצא מהמסגרת.
 *
 * מסגרת מבודדת חוסמת גם window.open, ולכן הכפתור לבדו אינו מספיק: אם
 * הוא נחסם, מציגים את הכתובת להעתקה במקום להשאיר לחיצה שלא עשתה כלום.
 */
function EscapeFrame() {
  const [blocked, setBlocked] = useState(false);
  const url = typeof location === "undefined" ? "" : location.href;

  if (blocked) {
    return (
      <div className="space-y-1">
        <p className="text-[0.6rem] text-parchment/50">פתחו את הכתובת בחלון חדש:</p>
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
               aria-label="כתובת המשחק"
               dir="ltr"
               className="w-full rounded bg-black/50 px-2 py-1 text-center text-[0.6rem]
                          text-parchment/80 ring-1 ring-white/10" />
      </div>
    );
  }
  return (
    <Button className="!px-2 !py-0.5 !text-[0.66rem]"
            onClick={() => {
              const w = window.open(url, "_blank", "noopener");
              if (!w) setBlocked(true);
            }}>
      פתיחה בחלון נפרד
    </Button>
  );
}

export function LocalVideo() {
  const { state } = useGame();
  const [on, setOn] = useState(false);
  const [transport, setTransport] = useState<SignalTransport | null>(null);
  const selfId = useMemo(
    () => `tab-${Math.random().toString(36).slice(2, 9)}`, []);

  useEffect(() => {
    if (!on) { transport?.close(); setTransport(null); return; }
    if (typeof BroadcastChannel === "undefined") return;
    const t = new BroadcastTransport("tabu-local-video");
    setTransport(t);
    return () => t.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const mesh = useMesh(selfId, null, transport);
  const active = state.players.filter((p) => !p.bankrupt);
  const current = state.players[state.currentSeat]!;

  if (!on) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="font-logo text-3xl tracking-tight text-parchment/80 drop-shadow">
          טאבו
        </div>
        <div className="grid gap-2"
             style={{ gridTemplateColumns: `repeat(${Math.min(active.length, 3)}, minmax(0,1fr))` }}>
          {active.map((p) => (
            <div key={p.seat}
                 className={`flex aspect-[4/3] w-[7.5rem] flex-col items-center justify-center
                             gap-1.5 rounded-md border bg-black/25
                             ${p.seat === state.currentSeat
                               ? "border-amber-400/75 ring-1 ring-amber-400/30"
                               : "border-dashed border-white/12"}`}>
              <Token token={p.token} seat={p.seat} size={30} />
              <span className="max-w-full truncate px-1 text-[0.66rem] font-medium"
                    style={{ color: seatColor(p.seat), unicodeBidi: "plaintext" }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
        <Button onClick={() => setOn(true)}>הפעלת מצלמה</Button>
        <p className="max-w-[22rem] text-[0.6rem] leading-snug text-parchment/25">
          הווידאו עובר ישירות בין המחשבים, בלי שרת באמצע. כאן אפשר לראות
          את עצמכם; פתיחת כרטיסייה נוספת של העמוד מדגימה את החיבור המלא.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Tile label={`${current.name} · אתם`} color={seatColor(state.currentSeat)}
              stream={mesh.local} mirrored active hint="מבקש הרשאה…" />
        {mesh.peers.map((peer: PeerState) => (
          <Tile key={peer.id} label="משתתף נוסף" stream={peer.stream} mirrored={false}
                active={false}
                hint={peer.connection === "connected" ? "ממתין לווידאו" : "מתחבר…"} />
        ))}
      </div>

      {mesh.error && (
        <div role="alert" className="max-w-[24rem] space-y-1.5 text-center">
          <p className="text-[0.66rem] leading-snug text-amber-200/85">
            {MEDIA_ERRORS[mesh.error]}
          </p>
          {mesh.diagnosis?.embedded && <EscapeFrame />}
          {mesh.diagnosis && (
            // שורת האבחון מוצגת בכוונה: ההודעה הקודמת האשימה את הדפדפן
            // בלי בסיס, וזה מה שנמדד בפועל.
            <p className="text-[0.55rem] text-parchment/25" dir="rtl">
              {diagnosisLine(mesh.diagnosis)}
            </p>
          )}
        </div>
      )}
      {!mesh.error && mesh.peers.length === 0 && (
        <p className="text-[0.6rem] text-parchment/25">
          פתחו כרטיסייה נוספת של העמוד כדי לראות חיבור בין שני משתתפים
        </p>
      )}

      <Button className="!px-2 !py-0.5 !text-[0.66rem]" onClick={() => setOn(false)}>
        כיבוי מצלמה
      </Button>
    </div>
  );
}
