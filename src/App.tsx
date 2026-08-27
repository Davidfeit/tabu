import { useCallback, useEffect, useMemo, useState } from "react";
import type { SeatSpec } from "@/engine/setup";
import type { GameState, Settings } from "@/engine/types";
import { ONLINE_ENABLED, supabase } from "@/net/supabase";
import { SupabaseTransport } from "@/net/transport";
import { LocalGameProvider, useGame } from "@/ui/GameContext";
import { RemoteGameProvider } from "@/ui/RemoteGameProvider";
import { useMesh } from "@/ui/useMesh";
import { AuctionPanel } from "@/components/AuctionPanel";
import { Board } from "@/components/Board";
import { Button } from "@/components/Button";
import { CardModal } from "@/components/CardModal";
import { EventLog } from "@/components/EventLog";
import { GameOver } from "@/components/GameOver";
import { Lobby, type JoinedRoom } from "@/components/Lobby";
import { ManagePanel } from "@/components/ManagePanel";
import { MoneyFlow } from "@/components/MoneyFlow";
import { MediaPrompt } from "@/components/MediaPrompt";
import { PlayerPanel } from "@/components/PlayerPanel";
import { ViewControls } from "@/components/ViewControls";
import { SetupScreen } from "@/components/SetupScreen";
import { TradeBuilder, TradeOfferCard } from "@/components/TradePanel";
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
  const { state, events, mySeat } = useGame();
  const [bare, setBare] = useState(false);
  const [trading, setTrading] = useState(false);
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
    <main dir="rtl" className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full max-h-full" style={{ aspectRatio: "1 / 1" }}>
          <Board state={state}
                 center={<CenterPanel videoTiles={videoTiles}
                                      onTrade={() => setTrading(true)} />} />
          <AuctionPanel />
          <CardModal />
          {trading && (
            <TradeBuilder mySeat={mySeat ?? state.currentSeat}
                          onClose={() => setTrading(false)} />
          )}
          <TradeOfferCard />
          <GameOver onRestart={onRestart} />
        </div>
      </div>

      <aside className={`${aside} right-0 ${bare ? "translate-x-full" : ""}`}
             aria-hidden={bare}>
        <PlayerPanel state={state} showWorth={nearEnd || state.phase === "finished"} />
        <EventLog events={events} state={state} />
      </aside>

      <aside className={`${aside} left-0 ${bare ? "-translate-x-full" : ""}`}
             aria-hidden={bare}>
        <ManageColumn />
      </aside>

      <ViewControls bare={bare} onToggleBare={() => setBare((v) => !v)} />

      {/* שכבה קבועה מעל הכל: השטרות חוצים בין העמודות, ואלמנט בתוך
          כרטיס שחקן היה כלוא ב-overflow שלו. */}
      <MoneyFlow />
    </main>
  );
}

/** מסך המשחק המקוון, כולל רשת הווידאו. */
function OnlineGame({ room, initial, version, onLeave }: {
  room: JoinedRoom; initial: GameState; version: number; onLeave: () => void;
}) {
  const [videoOn, setVideoOn] = useState<boolean | null>(null);
  const peerIds = initial.players.map((p) => p.userId).filter((id) => id !== room.userId);
  // התעבורה נוצרת רק אחרי אישור המצלמה, כדי לא לפתוח ערוצים לחינם.
  const transport = useMemo(
    () => (videoOn ? new SupabaseTransport(supabase().realtime as never) : null),
    [videoOn]);
  const mesh = useMesh(room.userId, peerIds, transport);

  return (
    <RemoteGameProvider roomId={room.roomId} mySeat={room.seat}
                        initialState={initial} initialVersion={version}>
      <ErrorToast />
      {videoOn === null && (
        <MediaPrompt onAllow={() => setVideoOn(true)} onSkip={() => setVideoOn(false)} />
      )}
      <GameScreen
        onRestart={onLeave}
        videoTiles={videoOn ? (
          <VideoTilesBridge local={mesh.local} peers={mesh.peers} error={mesh.error}
                            mySeat={room.seat} />
        ) : undefined}
      />
    </RemoteGameProvider>
  );
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
    <div dir="rtl" className="mx-auto max-w-sm space-y-6 py-20 text-center">
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
        <p className="text-[0.7rem] leading-relaxed text-parchment/35">
          משחק אונליין דורש הגדרת Supabase.
          ראו <code className="text-parchment/50">.env.example</code>.
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });

  // לינק הזמנה: ‎#CODE‎ פותח ישר את הלובי עם הקוד.
  useEffect(() => {
    if (location.hash.length > 1 && ONLINE_ENABLED) setScreen({ kind: "lobby" });
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
          <GameScreen onRestart={toHome} />
        </LocalGameProvider>
      )}

      {screen.kind === "lobby" && (
        <Lobby onJoined={(room) => setScreen({ kind: "waiting", room })} onBack={toHome} />
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
