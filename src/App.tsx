import { useCallback, useEffect, useMemo, useState } from "react";
import type { SeatSpec } from "@/engine/setup";
import type { GameState, Settings } from "@/engine/types";
import { api, CONFIG_PROBLEM, ONLINE_ENABLED, staleServer, supabase } from "@/net/supabase";
import { RoomTransport } from "@/net/transport";
import { LocalGameProvider, useGame } from "@/ui/GameContext";
import { RemoteGameProvider } from "@/ui/RemoteGameProvider";
import { useMesh } from "@/ui/useMesh";
import { MotionProvider } from "@/ui/MotionContext";
import { useIsPhone } from "@/ui/useIsPhone";
import { BankCard } from "@/components/BankCard";
import { Board } from "@/components/Board";
import { Button } from "@/components/Button";
import { CardModal } from "@/components/CardModal";
import { EventLog } from "@/components/EventLog";
import { GameOver } from "@/components/GameOver";
import { inviteCode, Lobby, type JoinedRoom } from "@/components/Lobby";
import { ManagePanel } from "@/components/ManagePanel";
import { MoneyFlow } from "@/components/MoneyFlow";
import { MediaPrompt } from "@/components/MediaPrompt";
import { PhoneController } from "@/components/PhoneController";
import { PlayerPanel } from "@/components/PlayerPanel";
import { ViewControls } from "@/components/ViewControls";
import { SetupScreen } from "@/components/SetupScreen";
import { CenterPanel } from "@/components/CenterPanel";
import { VideoTiles } from "@/components/VideoTiles";
import { WaitingRoom } from "@/components/WaitingRoom";

/** הודעת שגיאה חולפת. השגיאות מגיעות כקודים מהמנוע ומתורגמות ב-messages.ts. */
function ErrorToast() {
  const { error, clearError } = useGame();
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 3200);
    return () => clearTimeout(id);
  }, [error, clearError]);
  if (!error) return null;
  return (
    <div dir="rtl" role="status" aria-live="assertive"
         className="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-lg bg-red-500/90
                    px-4 py-2 text-sm font-medium text-white shadow-lg">
      {error}
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

/** מסך המשחק המקוון, כולל רשת הווידאו. */
function OnlineGame({ room, initial, version, onLeave }: {
  room: JoinedRoom; initial: GameState; version: number; onLeave: () => void;
}) {
  // בטלפון אין לוח ואין וידאו: הלוח על המסך המשותף שכולם רואים, וכולם
  // באותו חדר. הטלפון הוא שלט — ולכן גם לא מבקשים ממנו מצלמה.
  const phone = useIsPhone();
  const [videoOn, setVideoOn] = useState<boolean | null>(null);
  const peerIds = initial.players.map((p) => p.userId).filter((id) => id !== room.userId);
  // התעבורה נוצרת רק אחרי אישור המצלמה, כדי לא לפתוח ערוצים לחינם.
  const [relayError, setRelayError] = useState<string | null>(null);

  // האתר נפרס בכל דחיפה; הפונקציות רק ב-setup:supabase. כששני החצאים
  // מתפצלים, תקלת שרת נראית כמו תקלת רשת — ולכן נבדק במפורש.
  const [stale, setStale] = useState<string | null>(null);
  useEffect(() => {
    void staleServer(["signal"]).then(setStale);
  }, []);
  const transport = useMemo(
    () => (videoOn && !phone
      ? new RoomTransport(supabase().realtime as never, room.roomId,
                          (to, message) => api.signal(room.roomId, to, message),
                          setRelayError)
      : null),
    [videoOn, phone, room.roomId]);
  const mesh = useMesh(room.userId, peerIds, transport);

  return (
    <RemoteGameProvider roomId={room.roomId} mySeat={room.seat}
                        initialState={initial} initialVersion={version}>
      <ErrorToast />
      {stale && (
        <div role="alert" dir="rtl"
             className="absolute inset-x-0 top-0 z-50 bg-amber-500/90 px-3 py-2 text-center
                        text-[0.82rem] font-medium text-neutral-900">
          {stale} — הריצו <code className="font-mono">npm run setup:supabase</code>.
          המשחק עובד; הווידאו וההצטרפות באמצע לא.
        </div>
      )}
      {phone ? (
        <PhoneController onLeave={onLeave} />
      ) : (
        <>
          {videoOn === null && (
            <MediaPrompt onAllow={() => setVideoOn(true)} onSkip={() => setVideoOn(false)} />
          )}
          <GameScreen
            onRestart={onLeave}
            videoTiles={videoOn ? (
              <VideoTilesBridge local={mesh.local} peers={mesh.peers} error={mesh.error}
                                relayError={relayError} mySeat={room.seat} />
            ) : undefined}
          />
        </>
      )}
    </RemoteGameProvider>
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

// ── מסך פתיחה ────────────────────────────────────────────────────────────

type Screen =
  | { kind: "home" }
  | { kind: "local"; seats: SeatSpec[]; settings: Partial<Settings>; key: number }
  | { kind: "lobby" }
  | { kind: "waiting"; room: JoinedRoom }
  | { kind: "online"; room: JoinedRoom; state: GameState; version: number };

function Home({ onLocal, onOnline }: { onLocal: () => void; onOnline: () => void }) {
  return (
    <div dir="rtl" className="mx-auto max-w-sm space-y-6 px-4 py-20 text-center">
      <h1 className="font-logo text-6xl text-parchment">טאבו</h1>
      <p className="text-sm text-parchment/50">משחק הנדל״ן הישראלי</p>
      <div className="flex flex-col gap-2">
        <Button variant="primary" className="!py-2.5 !text-base" onClick={onOnline}
                disabled={!ONLINE_ENABLED}>
          משחק אונליין עם וידאו
        </Button>
        <Button className="!py-2.5" onClick={onLocal}>משחק מקומי על מסך אחד</Button>
      </div>
      {!ONLINE_ENABLED && (
        <div className="space-y-1 text-[0.7rem] leading-relaxed text-parchment/35">
          <p>משחק אונליין דורש הגדרת Supabase.</p>
          <p className="font-mono text-parchment/55" dir="ltr">{CONFIG_PROBLEM}</p>
          <p>
            הערכים מוטמעים בזמן הבנייה — אחרי שינוי בלוח הבקרה צריך
            פריסה מחדש. ראו <code className="text-parchment/50">docs/deploy.md</code>.
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });

  // לינק הזמנה: ‎#CODE‎ פותח ישר את הלובי עם הקוד.
  useEffect(() => {
    if (inviteCode(location.hash) && ONLINE_ENABLED) setScreen({ kind: "lobby" });
  }, []);

  const toHome = useCallback(() => setScreen({ kind: "home" }), []);
  const startOnline = useCallback((room: JoinedRoom) =>
    (state: unknown, version: number) =>
      setScreen({ kind: "online", room, state: state as GameState, version }), []);

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-900 bg-gradient-to-br
                              from-neutral-900 via-neutral-900 to-neutral-950">
      {screen.kind === "home" && (
        <Home onLocal={() => setScreen({ kind: "local", seats: [], settings: {}, key: 0 })}
              onOnline={() => setScreen({ kind: "lobby" })} />
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
        <Lobby invite={typeof location === "undefined" ? null : inviteCode(location.hash)} onJoined={(room) => setScreen({ kind: "waiting", room })} onBack={toHome} />
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
