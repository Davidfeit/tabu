import { useEffect, useState } from "react";
import { framePlan, FRAME_MS, FRAME_TTL_MS } from "@/net/frames";
import {
  acquireLocalStream, classifyMediaError, diagnoseMedia, FrameGrabber,
  releaseLocalStream, type MediaDiagnosis, type MediaErrorKind,
} from "@/net/media";
import { PeerMesh, type PeerState } from "@/net/mesh";
import { iceServers } from "@/net/supabase";
import type { SignalTransport } from "@/net/transport";

/**
 * מי אמור להיות מחובר בווידאו, לפי מצב המשחק *החי*.
 *
 * מהמצב ולא מרשימת הפתיחה: שחקן שנכנס אחרי שהמסך עלה חייב להיכנס לרשת,
 * אחרת שני הצדדים רואים ריבוע שחור — הצד החדש מציע חיבור, והצד הוותיק
 * לא יודע שיש למי לענות.
 */
export function meshPeers(players: { userId: string }[], selfId: string): string[] {
  return players.map((p) => p.userId).filter((id) => id && id !== selfId);
}

export interface MeshStatus {
  local: MediaStream | null;
  peers: PeerState[];
  /**
   * תמונות סטילס מהעמיתים, לפי מזהה.
   *
   * מסלול המוצא האחרון: כשהרשת חוסמת חיבור ישיר, תמונה כל כמה שניות
   * עוברת דרך ערוץ המשחק — שעובד תמיד, כי המשחק עצמו רץ עליו.
   */
  frames: Map<string, string>;
  error: MediaErrorKind | null;
  /** מה נמדד בפועל כשאי אפשר להפעיל מצלמה. */
  diagnosis: MediaDiagnosis | null;
  ready: boolean;
}

/**
 * מרים את רשת הווידאו.
 *
 * לא יודע דרך מה הסיגנלינג עובר: `transport` מספק אותו. אותו קוד רץ מול
 * Supabase Realtime בפרודקשן ומול BroadcastChannel בין כרטיסיות בפיתוח,
 * וכך אפשר לראות שהחיבור עובד בלי להעמיד תשתית.
 *
 * `peerIds` הוא null כשרשימת העמיתים מגיעה מהתעבורה עצמה (presence),
 * ומערך כשהיא מגיעה ממצב המשחק.
 */
export function useMesh(
  selfId: string,
  peerIds: string[] | null,
  transport: SignalTransport | null,
): MeshStatus {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [frames, setFrames] = useState<Map<string, string>>(new Map());
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [error, setError] = useState<MediaErrorKind | null>(null);
  const [diagnosis, setDiagnosis] = useState<MediaDiagnosis | null>(null);
  // ב-state ולא ב-ref, בכוונה.
  //
  // ה-ref נכתב בתוך פונקציה אסינכרונית, ואילו אפקט היישור למטה מתעורר רק
  // כש-local או רשימת העמיתים משתנים. כלומר היה מרוץ: setLocal גורם
  // לרינדור, האפקט רץ, ה-ref עדיין ריק כי ה-await לא הסתיים — ואז ה-ref
  // מתמלא בלי שאף אחד יריץ sync שוב. התוצאה: אף חיבור לא נוצר, ולכן כל
  // שחקן ראה רק את עצמו. state מכריח רינדור, והאפקט תלוי בו.
  const [mesh, setMesh] = useState<PeerMesh | null>(null);

  useEffect(() => {
    if (!transport) return;
    // אבחון לפני הניסיון: אם הסביבה חוסמת, עדיף לומר *מה* חוסם מאשר
    // לבקש הרשאה שתיכשל בלי הסבר.
    const d = diagnoseMedia();
    setDiagnosis(d);
    if (d.block !== "ok") {
      setError(d.block === "embedded" ? "blocked_embed" : "unknown");
      return;
    }

    let cancelled = false;
    let created: PeerMesh | null = null;
    let unsubscribe: (() => void) | undefined;
    let unpresence: (() => void) | undefined;
    let grabber: FrameGrabber | null = null;
    let frameTimer: ReturnType<typeof setInterval> | undefined;
    // הגעת כל תמונה, לפי שולח — גם לניקוי ישנות וגם כסימן חיים.
    const frameAt = new Map<string, number>();

    (async () => {
      let stream: MediaStream;
      try {
        stream = await acquireLocalStream();
      } catch (e) {
        if (!cancelled) { setError(classifyMediaError(e)); setDiagnosis(diagnoseMedia()); }
        return;
      }
      if (cancelled) return;
      setLocal(stream);
      setError(null);

      // TURN נשלף מהשרת. הקוד הזה הצהיר בהערה ש"TURN נוסף בפרודקשן" אבל
      // מעולם לא ביקש אותו, ולכן כל חיבור מאחורי CGNAT — הרוב בסלולר
      // בישראל — נכשל בלי דרך לדעת למה.
      const ice = await iceServers();
      if (cancelled) { releaseLocalStream(); return; }

      const m = new PeerMesh({
        selfId, localStream: stream,
        iceServers: ice,
        send: (peerId, message) => transport.send(peerId, message),
        onPeersChanged: setPeers,
      });
      created = m;
      setMesh(m);

      unsubscribe = transport.subscribe(selfId, (msg) => {
        // תמונות מטופלות כאן; כל השאר שייך למנוע החיבורים.
        if (msg.kind === "frame") {
          frameAt.set(msg.from, Date.now());
          setFrames((old) => new Map(old).set(msg.from, msg.jpeg));
          return;
        }
        void m.handle(msg);
      });
      if (peerIds === null) unpresence = transport.presence(selfId, setDiscovered);

      // ── מסלול התמונות ──
      // וידאו אמיתי מקבל הזדמנות מלאה (תקופת חסד), ואז מי שחי בערוץ
      // ולא זורם ממנו וידאו מקבל תמונה כל כמה שניות דרך הממסר של
      // המשחק. seq כדי שתמונה שהגיעה באיחור לא תדרוס חדשה ממנה.
      grabber = new FrameGrabber(stream);
      const startedAt = Date.now();
      let seq = 0;
      frameTimer = setInterval(() => {
        const now = Date.now();

        // תמונה שלא התחדשה — הצד השני סגר, או שהווידאו האמיתי חזר.
        let expired = false;
        for (const [id, at] of frameAt) {
          if (now - at > FRAME_TTL_MS) { frameAt.delete(id); expired = true; }
        }
        if (expired) {
          setFrames((old) => {
            const next = new Map(old);
            for (const id of next.keys()) if (!frameAt.has(id)) next.delete(id);
            return next;
          });
        }

        const targets = framePlan(m.snapshot(), [...frameAt.keys()], now - startedAt);
        if (targets.length === 0) return;
        const jpeg = grabber?.grab();
        if (!jpeg) return;
        seq++;
        for (const id of targets) {
          transport.send(id, { kind: "frame", from: selfId, jpeg, seq });
        }
      }, FRAME_MS);
    })();

    return () => {
      cancelled = true;
      if (frameTimer) clearInterval(frameTimer);
      grabber?.dispose();
      setFrames(new Map());
      unsubscribe?.();
      unpresence?.();
      created?.close();
      setMesh(null);
      setPeers([]);
      // משחררים את המצלמה, ולא רק את החיבורים: כיבוי וידאו שמשאיר את
      // הנורה דולקת אינו כיבוי. הפעלה מחדש תבקש אותה שוב.
      releaseLocalStream();
      setLocal(null);
    };
  }, [selfId, transport, peerIds === null]);

  // יישור קבוצת החיבורים, בלי להרים את הזרם מחדש.
  const wanted = peerIds ?? discovered;
  const key = wanted.slice().sort().join(",");
  useEffect(() => {
    if (!mesh) return;
    mesh.sync(key ? key.split(",") : []);
  }, [key, mesh]);

  useEffect(() => () => { releaseLocalStream(); }, []);

  return { local, peers, frames, error, diagnosis, ready: local !== null };
}
