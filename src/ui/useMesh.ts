import { useEffect, useRef, useState } from "react";
import {
  acquireLocalStream, classifyMediaError, mediaSupported, releaseLocalStream,
  type MediaErrorKind,
} from "@/net/media";
import { PeerMesh, type PeerState } from "@/net/mesh";
import type { SignalTransport } from "@/net/transport";

export interface MeshStatus {
  local: MediaStream | null;
  peers: PeerState[];
  error: MediaErrorKind | null;
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
  const mesh = useRef<PeerMesh | null>(null);

  useEffect(() => {
    if (!transport) return;
    if (!mediaSupported()) { setError("unsupported"); return; }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let unpresence: (() => void) | undefined;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await acquireLocalStream();
      } catch (e) {
        if (!cancelled) setError(classifyMediaError(e));
        return;
      }
      if (cancelled) return;
      setLocal(stream);
      setError(null);

      const m = new PeerMesh({
        selfId, localStream: stream,
        // STUN בלבד מספיק בין כרטיסיות ובאותה רשת. TURN נוסף בפרודקשן.
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

  return { local, peers, error, ready: local !== null };
}
