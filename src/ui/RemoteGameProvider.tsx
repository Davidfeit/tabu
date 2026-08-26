import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { reduce } from "@/engine/reduce";
import type { Action, GameEvent, GameState } from "@/engine/types";
import { errorText } from "@/lib/messages";
import { api, supabase } from "@/net/supabase";
import { GameCtx, type GameClient } from "./GameContext";

const MAX_LOG = 200;

/**
 * ספק מצב מקוון.
 *
 * ── חיזוי אופטימי ──
 * הפעולה מוחלת מיד מקומית כדי שהממשק יגיב בלי המתנה, ובמקביל נשלחת לשרת.
 * זה בטוח *רק* מפני שהלקוח והשרת מריצים את אותו מודול מנוע: החיזוי לעולם
 * לא יכול לחלוק על השרת אלא אם המצב שממנו יצאנו כבר התיישן. במקרה כזה
 * תשובת השרת דורסת אותו.
 *
 * ── מקור האמת ──
 * גרסה מונוטונית. שידור עם גרסה שקפצה מעל מה שיש לנו פירושו שהחמצנו
 * מהלך, ואז טוענים מחדש. בלי זה, ניתוק של שנייה משאיר לוח שקרי.
 */
export function RemoteGameProvider({
  roomId, mySeat, initialState, initialVersion, children,
}: {
  roomId: string;
  mySeat: number;
  initialState: GameState;
  initialVersion: number;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<GameState>(initialState);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(initialVersion);
  const channel = useRef<RealtimeChannel | null>(null);

  const reload = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.rpc("get_game_state", { p_room: roomId });
    if (!data?.state) return;
    version.current = data.version;
    setState(data.state as GameState);
  }, [roomId]);

  useEffect(() => {
    const sb = supabase();
    let cancelled = false;

    (async () => {
      // חובה לפני הרשמה לערוץ פרטי: ההרשאות מחושבות מ-RLS בזמן ההצטרפות.
      await sb.realtime.setAuth();
      if (cancelled) return;

      const ch = sb.channel(`room:${roomId}`, { config: { private: true } })
        .on("broadcast", { event: "move" }, ({ payload }) => {
          const incoming = Number(payload?.version ?? 0);
          if (incoming <= version.current) return;          // כבר ראינו
          if (incoming > version.current + 1) { void reload(); return; }  // פער — נטען מחדש
          version.current = incoming;
          const batch = (payload?.events ?? []) as GameEvent[];
          if (batch.length) setEvents((log) => [...batch.reverse(), ...log].slice(0, MAX_LOG));
          void reload();
        })
        .subscribe();
      channel.current = ch;
    })();

    // Presence ו-heartbeat לא מספיקים לנכונות: ה-heartbeat הוא 25 שניות,
    // וטאב שנסגר מזוהה רק אחרי 25–50. רענון תקופתי סוגר את הפער.
    const poll = setInterval(() => void reload(), 20_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel.current) void sb.removeChannel(channel.current);
    };
  }, [roomId, reload]);

  const dispatch = useCallback((action: Action, seat?: number) => {
    const actor = seat ?? mySeat;
    if (actor !== mySeat) { setError("אפשר לפעול רק בשם עצמך"); return; }

    const key = crypto.randomUUID();
    let optimisticFrom = 0;

    setState((prev) => {
      optimisticFrom = version.current;
      const r = reduce(prev, action, { seat: actor, now: Date.now(), seed: "" });
      // החיזוי לא יכול לדעת את הזרע, ולכן גלגול קוביות נשאר לשרת בלבד.
      if (!r.ok || action.type === "roll" || action.type === "claim_timeout") return prev;
      return r.state;
    });

    void api.play(roomId, action, key)
      .then((res) => {
        version.current = Math.max(version.current, res.version);
        setState(res.state as GameState);
        setError(null);
      })
      .catch((e: Error) => {
        setError(errorText(e.message as never) || "השרת דחה את הפעולה");
        if (optimisticFrom) void reload();
      });
  }, [roomId, mySeat, reload]);

  const value = useMemo<GameClient>(() => ({
    state, events, mySeat,
    canControl: (seat) => seat === mySeat,
    dispatch, error, clearError: () => setError(null), now: Date.now(),
  }), [state, events, mySeat, dispatch, error]);

  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
