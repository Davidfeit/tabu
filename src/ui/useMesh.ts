import { useEffect, useRef, useState } from "react";
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
  const mesh = useRef<PeerMesh | null>(null);

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
      mesh.current = m;

      unsubscribe = transport.subscribe(selfId, (msg) => void m.handle(msg));
      if (peerIds === null) unpresence = transport.presence(selfId, setDiscovered);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      unpresence?.();
      mesh.current?.close();
      mesh.current = null;
      setPeers([]);
    };
  }, [selfId, transport, peerIds === null]);

  // יישור קבוצת החיבורים, בלי להרים את הזרם מחדש.
  const wanted = peerIds ?? discovered;
  const key = wanted.slice().sort().join(",");
  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.sync(key ? key.split(",") : []);
  }, [key, local]);

  useEffect(() => () => { releaseLocalStream(); }, []);

  return { local, peers, error, diagnosis, ready: local !== null };
}
