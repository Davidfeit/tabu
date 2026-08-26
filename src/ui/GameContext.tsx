import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { reduce } from "@/engine/reduce";
import { createGame, defaultSettings, type SeatSpec } from "@/engine/setup";
import type { Action, GameEvent, GameState, Settings } from "@/engine/types";
import { errorText } from "@/lib/messages";

export interface GameClient {
  state: GameState;
  events: GameEvent[];
  /** המושב שהמשתמש הזה שולט בו. null = מצב מקומי, שולט בכולם. */
  mySeat: number | null;
  /** האם מותר לפעול בשם מושב מסוים. */
  canControl: (seat: number) => boolean;
  dispatch: (action: Action, seat?: number) => void;
  error: string | null;
  clearError: () => void;
  now: number;
}

const Ctx = createContext<GameClient | null>(null);

export function useGame(): GameClient {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame חייב לרוץ בתוך GameProvider");
  return c;
}

const MAX_LOG = 200;

/**
 * ספק מצב מקומי — כל השחקנים על אותו מסך.
 *
 * מריץ את אותו reduce שירוץ בשרת, ולכן זו לא הדמיה אלא המשחק עצמו.
 * שכבת הרשת תחליף רק את dispatch: במקום להחיל מקומית, היא תשלח ל-Edge
 * Function ותקבל את המצב בחזרה. החוזה כאן הוא התפר.
 */
export function LocalGameProvider({
  seats, settings, seed, children,
}: {
  seats: SeatSpec[];
  settings?: Partial<Settings>;
  seed?: string;
  children: React.ReactNode;
}) {
  const seedRef = useRef(seed ?? `local-${Math.floor(Math.random() * 1e9)}`);
  const [state, setState] = useState<GameState>(() =>
    createGame(seats, { ...defaultSettings("full"), ...settings }, seedRef.current, Date.now()),
  );
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dispatch = useCallback((action: Action, seat?: number) => {
    setState((prev) => {
      const actor = seat ?? prev.currentSeat;
      const r = reduce(prev, action, {
        seat: actor, now: Date.now(), seed: seedRef.current,
      });
      if (!r.ok) { setError(errorText(r.error)); return prev; }
      setError(null);
      if (r.events.length) {
        setEvents((log) => [...r.events, ...log].slice(0, MAX_LOG));
      }
      return r.state;
    });
  }, []);

  const value = useMemo<GameClient>(() => ({
    state,
    events,
    mySeat: null,
    canControl: () => true,
    dispatch,
    error,
    clearError: () => setError(null),
    now: Date.now(),
  }), [state, events, dispatch, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { Ctx as GameCtx };
