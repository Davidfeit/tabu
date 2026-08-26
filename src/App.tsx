import { useEffect, useState } from "react";
import type { SeatSpec } from "@/engine/setup";
import type { Settings } from "@/engine/types";
import { LocalGameProvider, useGame } from "@/ui/GameContext";
import { ActionBar } from "@/components/ActionBar";
import { AuctionPanel } from "@/components/AuctionPanel";
import { Board } from "@/components/Board";
import { CardModal } from "@/components/CardModal";
import { EventLog } from "@/components/EventLog";
import { GameOver } from "@/components/GameOver";
import { ManagePanel } from "@/components/ManagePanel";
import { PlayerPanel } from "@/components/PlayerPanel";
import { SetupScreen } from "@/components/SetupScreen";
import { VideoStage } from "@/components/VideoStage";

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

function GameScreen({ onRestart }: { onRestart: () => void }) {
  const { state, events } = useGame();
  const nearEnd = state.settings.hardLimitMinutes !== null
    && Date.now() - state.startedAt > (state.settings.hardLimitMinutes - 20) * 60_000;

  return (
    // רשת של שלוש עמודות: minmax(0,1fr) באמצע הוא מה שמונע מהלוח לחרוג
    // ולכסות את הפאנלים — עמודת grid ברירת-מחדל היא auto ולא מתכווצת מתחת
    // לתוכן שלה.
    <main dir="rtl"
          className="mx-auto grid w-full max-w-[1560px] items-start gap-5 px-5 py-5
                     grid-cols-[18rem_minmax(0,1fr)_18rem]">
      <aside className="space-y-3">
        <PlayerPanel state={state} showWorth={nearEnd || state.phase === "finished"} />
        <EventLog events={events} state={state} />
      </aside>

      <div className="relative flex flex-col items-center gap-4">
        <div className="w-full max-w-[min(78vh,900px)]">
          <Board state={state} center={<VideoStage />} />
        </div>
        <div className="w-full max-w-[min(78vh,900px)]">
          <ActionBar />
        </div>
        <AuctionPanel />
        <CardModal />
        <GameOver onRestart={onRestart} />
      </div>

      <aside className="space-y-3">
        <ManageColumn />
      </aside>
    </main>
  );
}

/**
 * ניהול נכסים מוצג לשחקן שבתור, ובנוסף למי שנמצא בגיוס כספים — הוא חייב
 * למכור ולמשכן גם כשזה לא תורו. שלושה פאנלים במקביל הם רעש.
 */
function ManageColumn() {
  const { state } = useGame();
  const seats = new Set<number>();
  if (!state.players[state.currentSeat]!.bankrupt) seats.add(state.currentSeat);
  if (state.debt) seats.add(state.debt.debtorSeat);
  return <>{[...seats].map((seat) => <ManagePanel key={seat} seat={seat} />)}</>;
}

interface GameConfig { seats: SeatSpec[]; settings: Partial<Settings>; key: number }

export default function App() {
  const [config, setConfig] = useState<GameConfig | null>(null);

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-900 bg-gradient-to-br
                              from-neutral-900 via-neutral-900 to-neutral-950">
      {config === null ? (
        <SetupScreen onStart={(seats, settings) => setConfig({ seats, settings, key: Date.now() })} />
      ) : (
        <LocalGameProvider key={config.key} seats={config.seats} settings={config.settings}>
          <ErrorToast />
          <GameScreen onRestart={() => setConfig(null)} />
        </LocalGameProvider>
      )}
    </div>
  );
}
