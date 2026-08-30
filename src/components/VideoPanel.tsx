import { useEffect, useMemo, useRef, useState } from "react";
import { diagnosisLine, type MediaErrorKind } from "@/net/media";
import type { PeerState } from "@/net/mesh";
import { BroadcastTransport, type SignalTransport } from "@/net/transport";
import { useGame } from "@/ui/GameContext";
import { EmptySeat, peerHint, SeatTile, VIDEO_SEATS } from "./VideoTiles";
import { useMesh } from "@/ui/useMesh";
import { Button } from "./Button";

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
  const [silenced, setSilenced] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    setSilenced(false);

    // מדיניות ה-autoplay חוסמת ניגון *עם קול* בלי מחוות משתמש. הבליעה
    // השקטה של הכישלון הזו הותירה ריבוע שחור בדיוק כשהחיבור הצליח:
    // הזרם הגיע, האלמנט פשוט לא ניגן. וידאו מושתק תמיד מותר, ולכן
    // נסיגה להשתקה — עדיף תמונה בלי קול על מסך שחור.
    void el.play().catch(() => {
      el.muted = true;
      void el.play().then(() => setSilenced(true)).catch(() => setSilenced(true));
    });

    return () => { el.srcObject = null; };
  }, [stream]);

  const unmute = () => {
    const el = ref.current;
    if (!el) return;
    el.muted = false;
    void el.play().then(() => setSilenced(false)).catch(() => {});
  };

  return (
    <>
      <video ref={ref}
             // playsinline חובה — בלעדיו ספארי כופה מסך מלא.
             playsInline autoPlay
             // התצוגה העצמית מושתקת תמיד, אחרת נוצר משוב אקוסטי.
             muted={mirrored}
             className="h-full w-full object-cover"
             // מראה רק על עצמך. לעולם לא על המשתתפים האחרים.
             style={mirrored ? { transform: "scaleX(-1)" } : undefined} />
      {silenced && !mirrored && (
        <button onClick={unmute}
                className="absolute inset-x-1 bottom-5 mx-auto w-fit rounded bg-black/80
                           px-2 py-1 text-[0.62rem] text-amber-200/90 ring-1 ring-white/15">
          הדפדפן חסם קול — לחצו להפעלה
        </button>
      )}
    </>
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

  // אותה רשת 2×2 כמו במשחק מקוון. שתי פריסות שונות לאותו שטח פירושן ששינוי
  // באחת נבדק רק בחצי מהמקרים — וזה בדיוק מה שקרה כאן.
  // מקומית יש מצלמה אחת — של מי שתורו — ולכרטיסיות נוספות אין מושב משלהן.
  // לכן העמיתים משויכים לפי הסדר למושבים *שאינם* הנוכחי. השיוך הקודם לקח
  // את peers[index-of-seat], כך שעמית יחיד נחת באינדקס 0 בזמן שהמושב השני
  // חיפש את peers[1] — והזרם היה שם אבל לא הוצג לעולם.
  const others = VIDEO_SEATS.filter((seat) => seat !== state.currentSeat);
  const peerBySeat = new Map<number, PeerState>();
  others.forEach((seat, i) => {
    const peer = mesh.peers[i];
    if (peer) peerBySeat.set(seat, peer);
  });

  return (
    <div className="relative h-full w-full">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[3%]">
        {VIDEO_SEATS.map((seat) => {
          const p = state.players[seat];
          if (!p) return <EmptySeat key={seat} />;
          const isCurrent = p.seat === state.currentSeat;
          const peer = peerBySeat.get(seat);
          return (
            <SeatTile key={seat} name={p.name} seat={p.seat} token={p.token}
                      stream={!on ? null : isCurrent ? mesh.local : peer?.stream ?? null}
                      mirrored={isCurrent}
                      dimmed={p.bankrupt}
                      active={isCurrent && !p.bankrupt}
                      hint={!on ? undefined
                            : isCurrent ? (mesh.local ? undefined : "מבקש הרשאה…")
                            : peerHint(peer)} />
          );
        })}
      </div>

      <button onClick={() => setOn((v) => !v)}
              className="toy-btn absolute right-1 top-1 z-10 !px-2.5 !py-1 !text-[0.66rem]">
        {on ? "כיבוי מצלמה" : "הפעלת מצלמה"}
      </button>

      {on && mesh.error && (
        <div role="alert"
             className="absolute inset-x-[6%] bottom-[2%] space-y-1 rounded bg-black/85
                        px-2 py-1.5 text-center">
          <p className="text-[0.62rem] leading-snug text-amber-200/90">
            {MEDIA_ERRORS[mesh.error]}
          </p>
          {mesh.diagnosis?.embedded && <EscapeFrame />}
          {mesh.diagnosis && (
            // שורת האבחון מוצגת בכוונה: ההודעה הקודמת האשימה את הדפדפן
            // בלי בסיס, וזה מה שנמדד בפועל.
            <p className="text-[0.53rem] text-parchment/30" dir="rtl">
              {diagnosisLine(mesh.diagnosis)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
