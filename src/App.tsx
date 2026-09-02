import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_ACTIONS, isChess, type AnyState } from "@/engine/any";
import type { SeatSpec } from "@/engine/setup";
import type { GameState, Settings } from "@/engine/types";
import type { ChessState } from "@/chess/types";
import { LocalChessProvider, RemoteChessProvider, useChess } from "@/chess/ChessContext";
import { ChessScreen } from "@/chess/ChessScreen";
import { ChessSetup } from "@/chess/ChessSetup";
import { Toast } from "@/components/Toast";
import { api, CONFIG_PROBLEM, ONLINE_ENABLED, signIn, staleServer, supabase } from "@/net/supabase";
import { RoomTransport, type SignalTransport } from "@/net/transport";
import { LocalGameProvider, useGame } from "@/ui/GameContext";
import { RemoteGameProvider } from "@/ui/RemoteGameProvider";
import { meshPeers, useMesh } from "@/ui/useMesh";
import { MotionProvider } from "@/ui/MotionContext";
import { useIsPhone } from "@/ui/useIsPhone";
import { BankCard } from "@/components/BankCard";
import { Board } from "@/components/Board";
import { Button } from "@/components/Button";
import { CardModal } from "@/components/CardModal";
import { EventLog } from "@/components/EventLog";
import { GameOver } from "@/components/GameOver";
import { inviteCode, Lobby, type GameKind, type JoinedRoom } from "@/components/Lobby";
import { forgetRoom, freshRoom, loadProfile, rememberRoom } from "@/net/profile";
import { ManagePanel } from "@/components/ManagePanel";
import { MoneyFlow } from "@/components/MoneyFlow";
import { MediaPrompt } from "@/components/MediaPrompt";
import { PhoneController } from "@/components/PhoneController";
import { PlayerPanel } from "@/components/PlayerPanel";
import { ViewControls } from "@/components/ViewControls";
import { SetupScreen } from "@/components/SetupScreen";
import { CenterPanel } from "@/components/CenterPanel";
import { EndGameButton } from "@/components/Actions";
import { TradeOfferCard } from "@/components/TradePanel";
import { VideoTiles } from "@/components/VideoTiles";
import { WaitingRoom } from "@/components/WaitingRoom";

/** הודעת שגיאה חולפת. השגיאות מגיעות כקודים מהמנוע ומתורגמות ב-messages.ts. */
function ErrorToast() {
  const { error, clearError } = useGame();
  return <Toast error={error} onClear={clearError} />;
}

/**
 * האתר נפרס בכל דחיפה; הפונקציות רק ב-setup:supabase. כששני החצאים
 * מתפצלים, תקלת שרת נראית כמו תקלת רשת — ולכן נבדק במפורש, בשני המשחקים.
 */
function StaleBanner() {
  const [stale, setStale] = useState<string | null>(null);
  useEffect(() => {
    // כל הפעולות שהבניין הזה מכיר, ולא רשימה ידנית: כך כל חוק חדש
    // שנוסף למנוע נבדק מול השרת מעצמו, בלי שמישהו יזכור לעדכן כאן.
    void staleServer(["signal"], ALL_ACTIONS).then(setStale);
  }, []);
  if (!stale) return null;
  return (
    <div role="alert" dir="rtl"
         className="absolute inset-x-0 top-0 z-50 bg-amber-500/90 px-3 py-2 text-center
                    text-[0.82rem] font-medium text-neutral-900">
      {stale} — הריצו <code className="font-mono">git pull &amp;&amp; npm run setup:supabase</code>,
      ואז <code className="font-mono">npm run check:server</code> כדי לוודא שזה תפס.
    </div>
  );
}

/**
 * ניהול נכסים מוצג לשחקן שבתור, ובנוסף למי שנמצא בגיוס כספים — הוא חייב
 * למכור ולמשכן גם כשזה לא תורו. במשחק מקוון: רק המושב שלי.
 */
function ManageColumn() {
  const { state, mySeat } = useGame();
  const seats = new Set<number>();
  if (mySeat !== null) {
    if (!state.players[mySeat]!.bankrupt) seats.add(mySeat);
  } else {
    if (!state.players[state.currentSeat]!.bankrupt) seats.add(state.currentSeat);
    if (state.debt) seats.add(state.debt.debtorSeat);
  }
  return <>{[...seats].map((seat) => <ManagePanel key={seat} seat={seat} />)}</>;
}

function GameScreen({ onRestart, videoTiles }: {
  onRestart: () => void; videoTiles?: React.ReactNode;
}) {
  const { state, events } = useGame();
  const [bare, setBare] = useState(false);
  const nearEnd = state.settings.hardLimitMinutes !== null
    && Date.now() - state.startedAt > (state.settings.hardLimitMinutes - 20) * 60_000;

  const aside = `absolute inset-y-0 z-30 flex w-[17rem] flex-col gap-2.5 overflow-y-auto
                 p-2 transition-transform duration-200`;

  return (
    // ── למה הלוח מוחלט והפאנלים צפים ──
    // לוח ריבועי חסום ע"י גובה המסך. במסך 16:9 בגובה מלא נשארים ~300px
    // פנויים בכל צד ממילא, ולכן אין סיבה שהפאנלים יגזלו מהלוח: הם צפים
    // מעל השוליים האלה. כך הלוח תמיד min(100dvh, 100vw) — המקסימום
    // הפיזי — גם במסכים צרים, שבהם פריסת עמודות הייתה מכווצת אותו.
    <MotionProvider state={state}>
    <main dir="rtl" className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full max-h-full" style={{ aspectRatio: "1 / 1" }}>
          <Board state={state} center={<CenterPanel videoTiles={videoTiles} />} />
          <CardModal />
          <TradeOfferCard />
          <GameOver onRestart={onRestart} />
        </div>
      </div>

      {/* שני שחקנים בכל צד, כדי שפירוט הנכסים של כל אחד ייכנס למסך.
          הבנק בצד שמאל, ונשאר עוגן גלוי לשטרות המעופפים. */}
      <aside className={`${aside} right-0 ${bare ? "translate-x-full" : ""}`}
             aria-hidden={bare}>
        <PlayerPanel state={state} seats={[0, 1]}
                     showWorth={nearEnd || state.phase === "finished"} />
        <EventLog events={events} state={state} />
      </aside>

      <aside className={`${aside} left-0 ${bare ? "-translate-x-full" : ""}`}
             aria-hidden={bare}>
        <PlayerPanel state={state} seats={[2, 3]}
                     showWorth={nearEnd || state.phase === "finished"} />
        <BankCard />
        <EndGameButton className="py-1" />
        <ManageColumn />
      </aside>

      <ViewControls bare={bare} onToggleBare={() => setBare((v) => !v)} />

      {/* שכבה קבועה מעל הכל: השטרות חוצים בין העמודות, ואלמנט בתוך
          כרטיס שחקן היה כלוא ב-overflow שלו. */}
      <MoneyFlow />
    </main>
    </MotionProvider>
  );
}

/** התעבורה של הווידאו — נוצרת רק אחרי אישור המצלמה, כדי לא לפתוח ערוצים לחינם. */
function useVideoTransport(roomId: string, videoOn: boolean | null) {
  const [relayError, setRelayError] = useState<string | null>(null);
  const transport = useMemo(
    () => (videoOn
      ? new RoomTransport(supabase().realtime as never, roomId,
                          (to, message) => api.signal(roomId, to, message),
                          setRelayError)
      : null),
    [videoOn, roomId]);
  return { transport, relayError };
}

/** מסך המשחק המקוון — מונופול או שחמט, לפי מה שהחדר מריץ. */
function OnlineGame({ room, initial, version, onLeave }: {
  room: JoinedRoom; initial: AnyState; version: number; onLeave: () => void;
}) {
  return isChess(initial)
    ? <OnlineChess room={room} initial={initial} version={version} onLeave={onLeave} />
    : <OnlineTabu room={room} initial={initial} version={version} onLeave={onLeave} />;
}

function OnlineTabu({ room, initial, version, onLeave }: {
  room: JoinedRoom; initial: GameState; version: number; onLeave: () => void;
}) {
  // בטלפון אין לוח ואין וידאו: הלוח על המסך המשותף שכולם רואים, וכולם
  // באותו חדר. הטלפון הוא שלט — ולכן גם לא מבקשים ממנו מצלמה.
  const phone = useIsPhone();
  const [videoOn, setVideoOn] = useState<boolean | null>(null);
  const { transport, relayError } = useVideoTransport(room.roomId, videoOn && !phone);

  return (
    <RemoteGameProvider roomId={room.roomId} userId={room.userId} mySeat={room.seat}
                        initialState={initial} initialVersion={version}>
      <ErrorToast />
      <StaleBanner />
      {phone ? (
        <PhoneController onLeave={onLeave} />
      ) : (
        <>
          {videoOn === null && (
            <MediaPrompt onAllow={() => setVideoOn(true)} onSkip={() => setVideoOn(false)} />
          )}
          <OnlineBody room={room} onLeave={onLeave} videoOn={videoOn}
                      onToggleVideo={() => setVideoOn((v) => !v)}
                      transport={transport} relayError={relayError} />
        </>
      )}
    </RemoteGameProvider>
  );
}

/**
 * גוף המשחק המקוון — *בתוך* הספק, ולכן רואה את המצב החי.
 *
 * רשימת העמיתים נגזרה קודם מ-initial, המצב שהיה בזמן הטעינה. כלומר מי
 * שהצטרף אחרי שהמסך הזה עלה לא נכנס לרשת הווידאו לעולם, וזה בדיוק המצב
 * שבו יושבים: פותחים את המשחק, ורק אז החבר נכנס דרך הקישור. הצד השני
 * כן היה יוצר חיבור, אבל בלי שהצד הזה יענה אין וידאו לאף אחד.
 */
function OnlineBody({ room, onLeave, videoOn, onToggleVideo, transport, relayError }: {
  room: JoinedRoom;
  onLeave: () => void;
  videoOn: boolean | null;
  onToggleVideo: () => void;
  transport: SignalTransport | null;
  relayError: string | null;
}) {
  const { state } = useGame();
  const peerIds = useMemo(() => meshPeers(state.players, room.userId),
                          [state.players, room.userId]);
  const mesh = useMesh(room.userId, peerIds, transport);

  return (
    <GameScreen
      onRestart={onLeave}
      // גם כשהמצלמה כבויה המשבצות נשארות: הן מחזיקות את הכפתור שמדליק
      // אותה בחזרה, ובלעדיהן כיבוי היה מסלול חד-כיווני.
      videoTiles={videoOn === null ? undefined : (
        <VideoTilesBridge local={mesh.local} peers={mesh.peers} error={mesh.error}
                          frames={mesh.frames}
                          relayError={relayError} mySeat={room.seat}
                          wanted={peerIds} selfId={room.userId}
                          stats={transport?.stats}
                          videoOn={videoOn} onToggleVideo={onToggleVideo} />
      )}
    />
  );
}

/**
 * במשחק מקומי גם הטלפון מקבל שלט.
 *
 * לוח שלם על 390 פיקסלים אינו קריא ממילא, ובמשחק מקומי השלט הוא בדיוק
 * "מעבירים את הטלפון" — כל שחקן מקבל את הפעולות שלו בתורו.
 */
function LocalBody({ onLeave }: { onLeave: () => void }) {
  return useIsPhone()
    ? <PhoneController onLeave={onLeave} />
    : <GameScreen onRestart={onLeave} />;
}

function VideoTilesBridge(props: Omit<Parameters<typeof VideoTiles>[0], "state">) {
  const { state } = useGame();
  return <VideoTiles state={state} {...props} />;
}

/**
 * שחמט מקוון.
 *
 * בניגוד למונופול, הטלפון כאן הוא לוח ולא שלט: לוח 8×8 נכנס יפה ברוחב
 * טלפון, ומי שמשחק שחמט מהטלפון בדרך כלל לא יושב מול מסך משותף — ולכן
 * גם המצלמה מוצעת לו.
 */
function OnlineChess({ room, initial, version, onLeave }: {
  room: JoinedRoom; initial: ChessState; version: number; onLeave: () => void;
}) {
  const [videoOn, setVideoOn] = useState<boolean | null>(null);
  const { transport, relayError } = useVideoTransport(room.roomId, videoOn);

  return (
    <RemoteChessProvider roomId={room.roomId} userId={room.userId}
                         initialState={initial} initialVersion={version}>
      <StaleBanner />
      {videoOn === null && (
        <MediaPrompt onAllow={() => setVideoOn(true)} onSkip={() => setVideoOn(false)} />
      )}
      <OnlineChessBody room={room} onLeave={onLeave} videoOn={videoOn}
                       onToggleVideo={() => setVideoOn((v) => !v)}
                       transport={transport} relayError={relayError} />
    </RemoteChessProvider>
  );
}

function OnlineChessBody({ room, onLeave, videoOn, onToggleVideo, transport, relayError }: {
  room: JoinedRoom;
  onLeave: () => void;
  videoOn: boolean | null;
  onToggleVideo: () => void;
  transport: SignalTransport | null;
  relayError: string | null;
}) {
  const { state } = useChess();
  const peerIds = useMemo(() => meshPeers(state.players, room.userId),
                          [state.players, room.userId]);
  const mesh = useMesh(room.userId, peerIds, transport);

  return (
    <ChessScreen
      onLeave={onLeave}
      videoTiles={videoOn === null ? undefined : (
        <VideoTiles state={state} local={mesh.local} peers={mesh.peers} error={mesh.error}
                    frames={mesh.frames} relayError={relayError} mySeat={room.seat}
                    wanted={peerIds} selfId={room.userId} stats={transport?.stats}
                    videoOn={videoOn} onToggleVideo={onToggleVideo}
                    // שניים בלבד: בשורה בטלפון, בטור לצד הלוח במחשב.
                    seats={[0, 1]}
                    grid="grid-cols-2 grid-rows-1 lg:grid-cols-1 lg:grid-rows-2" />
      )}
    />
  );
}

// ── מסך פתיחה ────────────────────────────────────────────────────────────

type Screen =
  | { kind: "home" }
  | { kind: "local"; seats: SeatSpec[]; settings: Partial<Settings>; key: number }
  | { kind: "localChess"; names: [string, string] | null; key: number }
  | { kind: "lobby"; game: GameKind }
  | { kind: "waiting"; room: JoinedRoom }
  | { kind: "online"; room: JoinedRoom; state: AnyState; version: number };

const GAMES: { key: GameKind; label: string; icon: string; blurb: string }[] = [
  { key: "tabu", label: "טאבו", icon: "🎲", blurb: "משחק הנדל״ן הישראלי" },
  { key: "chess", label: "שחמט", icon: "♟️", blurb: "לבן, שחור, ומי שחושב רחוק יותר" },
];

function Home({ onLocal, onOnline }: {
  onLocal: (game: GameKind) => void; onOnline: (game: GameKind) => void;
}) {
  const [game, setGame] = useState<GameKind>("tabu");
  const chosen = GAMES.find((g) => g.key === game)!;
  return (
    <div dir="rtl" className="mx-auto max-w-sm space-y-7 px-4 py-16 text-center">
      <div>
        <h1 className="toy-title font-logo text-7xl">טאבו</h1>
        <p className="mt-2 font-display text-base text-ink/70">{chosen.blurb}</p>
      </div>

      {/* בחירת משחק: שני כפתורים גדולים, כמו קופסאות על מדף. */}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="איזה משחק">
        {GAMES.map((g) => (
          <button key={g.key} role="radio" aria-checked={game === g.key}
                  onClick={() => setGame(g.key)}
                  className={`toy-card flex flex-col items-center gap-1 p-4 transition
                              ${game === g.key ? "toy-card--turn" : "opacity-80 hover:opacity-100"}`}>
            <span className="text-4xl" aria-hidden="true">{g.icon}</span>
            <span className="font-display text-lg font-bold text-ink">{g.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-stretch gap-3">
        <Button variant="primary" className="!py-3 !text-lg" onClick={() => onOnline(game)}
                disabled={!ONLINE_ENABLED}>
          🎥 משחק אונליין עם וידאו
        </Button>
        <Button className="!py-3 !text-base" onClick={() => onLocal(game)}>
          {chosen.icon} משחק מקומי על מסך אחד
        </Button>
      </div>
      {!ONLINE_ENABLED && (
        <div className="toy-card space-y-1 p-3 text-[0.72rem] leading-relaxed text-ink/60">
          <p>משחק אונליין דורש הגדרת Supabase.</p>
          <p className="font-mono text-ink" dir="ltr">{CONFIG_PROBLEM}</p>
          <p>
            הערכים מוטמעים בזמן הבנייה — אחרי שינוי בלוח הבקרה צריך
            פריסה מחדש. ראו <code>docs/deploy.md</code>.
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });

  /**
   * חזרה אוטומטית לחדר.
   *
   * קוד מגיע מה-hash של קישור ההזמנה, ואם אין — מהחדר האחרון שנשמר.
   * מי שכבר הזין שם פעם אחת לא מזין אותו שוב: הצטרפות חוזרת מחזירה את
   * אותו מושב (השרת מזהה לפי המשתמש), ולכן רענון באמצע משחק מחזיר
   * לאותו מקום במקום לטופס.
   */
  useEffect(() => {
    if (!ONLINE_ENABLED) return;
    const me = loadProfile();
    // מקישור הזמנה — תמיד. מזיכרון — רק אם הוא טרי: חדר של אתמול הוא
    // זיכרון, לא כוונה, ומי שפתח את האתר היום רוצה מסך פתיחה.
    const code = inviteCode(location.hash) ?? freshRoom(me);
    if (!code) return;
    if (!me) { setScreen({ kind: "lobby", game: "tabu" }); return; }

    let alive = true;
    void (async () => {
      try {
        const userId = await signIn();
        const r = await api.joinRoom(code, me.name, me.token);
        if (!alive) return;
        setScreen({ kind: "waiting", room: {
          roomId: r.roomId, seat: r.seat ?? 0, code,
          userId, isHost: r.host ?? (r.seat ?? 0) === 0,
        } });
      } catch {
        // חדר שנסגר, קוד ישן, או שרת שלא ענה — הלובי יסביר.
        if (alive) setScreen({ kind: "lobby", game: "tabu" });
      }
    })();
    return () => { alive = false; };
  }, []);

  // הכתובת מחזיקה את קוד החדר, כדי שרענון וקישור ששותף יובילו לאותו מקום.
  useEffect(() => {
    const code = screen.kind === "waiting" || screen.kind === "online"
      ? screen.room.code : null;
    if (code) { rememberRoom(code); history.replaceState(null, "", `#${code}`); }
  }, [screen]);

  const toHome = useCallback(() => {
    // יציאה מכוונת: הכתובת מתנקה, והחדר נשכח — אחרת הרענון הבא היה
    // גורר בחזרה בדיוק למשחק שממנו יצאו.
    forgetRoom();
    history.replaceState(null, "", location.pathname + location.search);
    setScreen({ kind: "home" });
  }, []);
  const startOnline = useCallback((room: JoinedRoom) =>
    (state: unknown, version: number) =>
      setScreen({ kind: "online", room, state: state as AnyState, version }), []);

  return (
    // toy-scene מצייר את השמיים, העננים והגבעות מאחורי הכול. הלוח עצמו
    // לא משתנה — הוא פשוט מונח על הנוף הזה, כמו לוח על שולחן בחצר.
    <div dir="rtl" className="toy-scene min-h-screen">
      {screen.kind === "home" && (
        <Home onLocal={(game) => setScreen(game === "chess"
                ? { kind: "localChess", names: null, key: 0 }
                : { kind: "local", seats: [], settings: {}, key: 0 })}
              onOnline={(game) => setScreen({ kind: "lobby", game })} />
      )}

      {screen.kind === "localChess" && screen.names === null && (
        <ChessSetup onBack={toHome}
                    onStart={(names) => setScreen({ kind: "localChess", names, key: Date.now() })} />
      )}

      {screen.kind === "localChess" && screen.names !== null && (
        <LocalChessProvider key={screen.key} names={screen.names}>
          <ChessScreen onLeave={toHome} />
        </LocalChessProvider>
      )}

      {screen.kind === "local" && screen.seats.length === 0 && (
        <SetupScreen onStart={(seats, settings) =>
          setScreen({ kind: "local", seats, settings, key: Date.now() })} />
      )}

      {screen.kind === "local" && screen.seats.length > 0 && (
        <LocalGameProvider key={screen.key} seats={screen.seats} settings={screen.settings}>
          <ErrorToast />
          <LocalBody onLeave={toHome} />
        </LocalGameProvider>
      )}

      {screen.kind === "lobby" && (
        <Lobby invite={typeof location === "undefined" ? null : inviteCode(location.hash)}
               game={screen.game}
               onJoined={(room) => setScreen({ kind: "waiting", room })} onBack={toHome} />
      )}

      {screen.kind === "waiting" && (
        <WaitingRoom room={screen.room} onStart={startOnline(screen.room)} />
      )}

      {screen.kind === "online" && (
        <OnlineGame room={screen.room} initial={screen.state}
                    version={screen.version} onLeave={toHome} />
      )}
    </div>
  );
}
