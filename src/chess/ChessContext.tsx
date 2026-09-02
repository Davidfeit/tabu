import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { GameEvent } from "@/engine/types";
import { useRoomFeed } from "@/ui/useRoomFeed";
import { chessErrorText } from "./messages";
import { colorOf, createChessGame, reduceChess } from "./reduce";
import type { ChessAction, ChessColor, ChessState } from "./types";

export interface ChessClient {
  state: ChessState;
  events: GameEvent[];
  /** המושב שלי. null במשחק מקומי — שולטים בשני הצדדים לפי התור. */
  mySeat: number | null;
  /** הצבע שאני מזיז עכשיו: שלי במקוון, של מי שבתור במקומי. */
  myColor: ChessColor | null;
  /** האם מותר לי לפעול כרגע. */
  canAct: boolean;
  dispatch: (action: ChessAction) => void;
  error: string | null;
  clearError: () => void;
}

const Ctx = createContext<ChessClient | null>(null);

export function useChess(): ChessClient {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChess חייב לרוץ בתוך ChessProvider");
  return c;
}

const MAX_LOG = 200;

/** שחמט על מסך אחד: מעבירים את המקלדת, או הטלפון. */
export function LocalChessProvider({ names, children }: {
  names: [string, string]; children: React.ReactNode;
}) {
  const [state, setState] = useState<ChessState>(() => createChessGame(
    [{ userId: "local-0", name: names[0], token: "king" },
     { userId: "local-1", name: names[1], token: "queen" }], Date.now()));
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const dispatch = useCallback((action: ChessAction) => {
    setState((prev) => {
      const r = reduceChess(prev, action, { seat: prev.currentSeat, now: Date.now(), seed: "" });
      if (!r.ok) { setError(chessErrorText(r.error)); return prev; }
      setError(null);
      if (r.events.length) setEvents((log) => [...r.events, ...log].slice(0, MAX_LOG));
      return r.state;
    });
  }, []);

  const value = useMemo<ChessClient>(() => ({
    state, events, mySeat: null,
    myColor: colorOf(state, state.currentSeat),
    canAct: state.phase === "playing",
    dispatch, error, clearError,
  }), [state, events, dispatch, error, clearError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** שחמט מקוון: השרת הוא הסמכות, הלקוח חוזה. */
export function RemoteChessProvider({
  roomId, userId, initialState, initialVersion, children,
}: {
  roomId: string; userId: string;
  initialState: ChessState; initialVersion: number;
  children: React.ReactNode;
}) {
  const { state, events, send } = useRoomFeed<ChessState>(roomId, initialState, initialVersion);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  // לפי מזהה המשתמש, לא לפי מספר מושב מהחדר — אותו לקח כמו במונופול.
  const mySeat = state.players.find((p) => p.userId === userId)?.seat ?? null;

  const dispatch = useCallback((action: ChessAction) => {
    if (mySeat === null) { setError(chessErrorText("NOT_A_PLAYER")); return; }
    void send(action, (prev) => {
      const r = reduceChess(prev, action, { seat: mySeat, now: Date.now(), seed: "" });
      return r.ok ? r.state : null;
    })
      .then(() => setError(null))
      .catch((e: Error) => setError(chessErrorText(e.message)));
  }, [send, mySeat]);

  const value = useMemo<ChessClient>(() => ({
    state, events, mySeat,
    myColor: mySeat === null ? null : colorOf(state, mySeat),
    canAct: state.phase === "playing" && mySeat !== null,
    dispatch, error, clearError,
  }), [state, events, mySeat, dispatch, error, clearError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
