import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent } from "@/engine/types";
import { roomChannel, type RealtimeLike } from "@/net/roomChannel";
import { api, supabase } from "@/net/supabase";

const MAX_LOG = 200;

/**
 * הזנת מצב של חדר, בלי לדעת איזה משחק רץ בו.
 *
 * ── מקור האמת ──
 * גרסה מונוטונית. שידור עם גרסה שקפצה מעל מה שיש לנו פירושו שהחמצנו
 * מהלך, ואז טוענים מחדש. בלי זה, ניתוק של שנייה משאיר לוח שקרי.
 *
 * ── חיזוי אופטימי ──
 * מי שקורא ל-send יכול לצרף חיזוי: הפעולה מוחלת מיד מקומית כדי שהממשק
 * יגיב בלי המתנה, ובמקביל נשלחת לשרת. זה בטוח *רק* מפני שהלקוח והשרת
 * מריצים את אותו מנוע: החיזוי לעולם לא יכול לחלוק על השרת אלא אם המצב
 * שממנו יצאנו כבר התיישן. במקרה כזה תשובת השרת דורסת אותו.
 *
 * הופרד מספק המונופול כשהשחמט נוסף: שני משחקים, אותו חדר, אותו ערוץ,
 * אותה נעילה — ולולאת סנכרון אחת שתיקון בה חל על שניהם.
 */
export function useRoomFeed<S>(roomId: string, initialState: S, initialVersion: number) {
  const [state, setState] = useState<S>(initialState);
  // ה-catch של השליחה רץ אחרי הרינדור, ולכן הוא צריך את המצב העדכני
  // ולא את זה שנתפס בסגירה.
  const stateRef = useRef(initialState);
  stateRef.current = state;
  const [events, setEvents] = useState<GameEvent[]>([]);
  const version = useRef(initialVersion);

  const reload = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.rpc("get_game_state", { p_room: roomId });
    if (!data?.state) return;
    version.current = data.version;
    setState(data.state as S);
  }, [roomId]);

  useEffect(() => {
    const sb = supabase();

    // ידית מונה ולא ערוץ ישיר: סיגנלינג הווידאו מאזין לאותו נושא, ו-
    // supabase-js מחזיר לשנינו את אותו אובייקט ערוץ. ניתוק ישיר כאן היה
    // מנתק גם את הווידאו, ולהפך.
    const h = roomChannel(sb.realtime as unknown as RealtimeLike, roomId);
    h.on("move", (payload) => {
      const p = payload as { version?: number; events?: GameEvent[] } | undefined;
      const incoming = Number(p?.version ?? 0);
      if (incoming <= version.current) return;          // כבר ראינו
      if (incoming > version.current + 1) { void reload(); return; }  // פער — נטען מחדש
      version.current = incoming;
      const batch = p?.events ?? [];
      if (batch.length) setEvents((log) => [...batch.reverse(), ...log].slice(0, MAX_LOG));
      void reload();
    });
    void h.join();

    // Presence ו-heartbeat לא מספיקים לנכונות: ה-heartbeat הוא 25 שניות,
    // וטאב שנסגר מזוהה רק אחרי 25–50. רענון תקופתי סוגר את הפער.
    const poll = setInterval(() => void reload(), 20_000);

    return () => {
      clearInterval(poll);
      h.release();
    };
  }, [roomId, reload]);

  /**
   * שולח פעולה לשרת. predict, אם ניתן, מחיל אותה מקומית בינתיים — ומחזיר
   * null כשאין מה לחזות (גלגול קוביות, למשל, שרק השרת יודע).
   *
   * STALE נבלע: זה מרוץ גרסאות ולא שגיאה של המשתמש — שני לקוחות פעלו
   * מאותו מצב, והשרת קיבל את הראשון. הטעינה מחדש מיישרת הכול תוך שבריר
   * שנייה. כל שגיאה אחרת נזרקת הלאה, עם קוד המנוע כהודעה.
   */
  const send = useCallback((action: unknown, predict?: (prev: S) => S | null) => {
    const key = crypto.randomUUID();
    let predicted = false;
    if (predict) {
      setState((prev) => {
        const next = predict(prev);
        if (next === null) return prev;
        predicted = true;
        return next;
      });
    }
    return api.play(roomId, action, key)
      .then((res) => {
        version.current = Math.max(version.current, res.version);
        setState(res.state as S);
      })
      .catch((e: Error) => {
        if (e.message === "STALE") { void reload(); return; }
        // המצב שחזינו שגוי — חוזרים למה שהשרת אומר.
        if (predicted) void reload();
        throw e;
      });
  }, [roomId, reload]);

  return { state, stateRef, events, reload, send };
}
