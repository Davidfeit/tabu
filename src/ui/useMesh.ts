import { useEffect, useRef, useState } from "react";
import { acquireLocalStream, classifyMediaError, mediaSupported,
         releaseLocalStream, type MediaErrorKind } from "@/net/media";
import { PeerMesh, type PeerState } from "@/net/mesh";
import { signalTopic, type SignalMessage } from "@/net/signaling";
import { iceServers, supabase } from "@/net/supabase";

export interface MeshStatus {
  local: MediaStream | null;
  peers: PeerState[];
  error: MediaErrorKind | null;
  ready: boolean;
}

/**
 * מרים את רשת הווידאו לחדר.
 *
 * הסיגנלינג עובר בערוץ פרטי *לכל שחקן* ולא בשידור לחדר: הודעה לעמית אחד
 * עולה מסירה אחת במקום חמש, וזה ההבדל בין ~1,050 משחקים בחודש בשכבה
 * החינמית לבין ~26,000. ראה src/net/signaling.ts.
 */
export function useMesh(selfId: string, peerIds: string[], enabled: boolean): MeshStatus {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [error, setError] = useState<MediaErrorKind | null>(null);
  const mesh = useRef<PeerMesh | null>(null);
  const key = peerIds.slice().sort().join(",");

  useEffect(() => {
    if (!enabled) return;
    if (!mediaSupported()) { setError("unsupported"); return; }

    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof supabase>["channel"]> | null = null;

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

      const servers = await iceServers();
      if (cancelled) return;

      const sb = supabase();
      const m = new PeerMesh({
        selfId, localStream: stream, iceServers: servers,
        send: (peerId, message) => {
          void sb.channel(signalTopic(peerId)).send({
            type: "broadcast", event: "signal", payload: message,
          });
        },
        onPeersChanged: setPeers,
      });
      mesh.current = m;

      channel = sb.channel(signalTopic(selfId), { config: { private: true } })
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          void m.handle(payload as SignalMessage);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      mesh.current?.close();
      mesh.current = null;
      if (channel) void supabase().removeChannel(channel);
    };
  }, [selfId, enabled]);

  // יישור קבוצת החיבורים מול השחקנים בחדר, בלי להרים את הזרם מחדש.
  useEffect(() => {
    if (!mesh.current) return;
    void mesh.current.sync(key ? key.split(",") : []);
  }, [key, local]);

  useEffect(() => () => { releaseLocalStream(); }, []);

  return { local, peers, error, ready: local !== null };
}
