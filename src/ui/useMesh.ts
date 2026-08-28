import { useEffect, useState } from "react";
import {
  acquireLocalStream, classifyMediaError, diagnoseMedia, releaseLocalStream,
  type MediaDiagnosis, type MediaErrorKind,
} from "@/net/media";
import { PeerMesh, type PeerState } from "@/net/mesh";
import { iceServers } from "@/net/supabase";
import type { SignalTransport } from "@/net/transport";

export interface MeshStatus {
  local: MediaStream | null;
  peers: PeerState[];
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

      unsubscribe = transport.subscribe(selfId, (msg) => void m.handle(msg));
      if (peerIds === null) unpresence = transport.presence(selfId, setDiscovered);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      unpresence?.();
      created?.close();
      setMesh(null);
      setPeers([]);
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

  return { local, peers, error, diagnosis, ready: local !== null };
}
