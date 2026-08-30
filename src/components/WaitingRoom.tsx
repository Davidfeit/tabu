import { useEffect, useState } from "react";
import { supabase } from "@/net/supabase";
import { api } from "@/net/supabase";
import { Button } from "./Button";
import { seatColor, Token } from "./Token";
import type { JoinedRoom } from "./Lobby";

interface Seat { user_id: string; seat: number; display_name: string; token: string }

/** חדר המתנה: הלינק להזמנה, מי הצטרף, ולמארח — כפתור התחלה. */
export function WaitingRoom({ room, onStart }: {
  room: JoinedRoom;
  onStart: (state: unknown, version: number) => void;
}) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    const load = async () => {
      const { data } = await sb.from("game_room_players")
        .select("user_id, seat, display_name, token").eq("room_id", room.roomId).order("seat");
      if (alive && data) setSeats(data as Seat[]);
    };
    // מי שאינו המארח מגלה שהמשחק התחיל בכך שנוצר מצב לחדר.
    const watch = async () => {
      await load();
      if (room.isHost) return;
      const { data } = await sb.rpc("get_game_state", { p_room: room.roomId });
      if (alive && data?.state) onStart(data.state, data.version);
    };
    void watch();
    // Presence לא מספיק כאן: ה-heartbeat הוא 25 שניות, וזה מרגיש תקוע.
    const id = setInterval(watch, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [room.roomId, room.isHost, onStart]);

  const link = `${location.origin}${location.pathname}#${room.code}`;

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-5 py-12 text-center">
      <h1 className="toy-title font-logo text-5xl">חדר המתנה</h1>

      <div className="toy-card p-4">
        <div className="text-[0.78rem] font-semibold text-ink/60">קוד החדר</div>
        <div className="mt-1 font-mono text-4xl font-bold tracking-[0.35em] text-toy-grape"
             style={{ direction: "ltr" }}>
          {room.code}
        </div>
        <Button className="mt-3"
                onClick={() => {
                  void navigator.clipboard.writeText(link).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}>
          {copied ? "הועתק ✓" : "העתקת לינק הזמנה"}
        </Button>
      </div>

      <ul className="space-y-1.5">
        {seats.map((s) => (
          <li key={s.user_id}
              className="toy-card toy-card--flat flex items-center gap-2.5 px-3 py-2">
            <Token token={s.token} seat={s.seat} size={22} />
            <span className="min-w-0 flex-1 truncate text-right text-sm font-medium"
                  style={{ color: seatColor(s.seat), unicodeBidi: "plaintext" }}>
              {s.display_name}
            </span>
            {s.user_id === room.userId && (
              <span className="toy-chip px-2 py-0.5 text-[0.66rem]">את/ה</span>
            )}
          </li>
        ))}
        {seats.length < 2 && (
          <li className="rounded-2xl border-[3px] border-dashed border-white/70 px-3 py-2.5
                         text-[0.8rem] text-ink/45">
            ממתינים לשחקן נוסף…
          </li>
        )}
      </ul>

      {room.isHost ? (
        <Button variant="primary" disabled={seats.length < 2 || busy} className="!px-6 !py-2.5"
                onClick={async () => {
                  setBusy(true); setError(null);
                  try {
                    const r = await api.startGame(room.roomId);
                    onStart(r.state, r.version);
                  } catch { setError("לא הצלחנו להתחיל את המשחק"); }
                  finally { setBusy(false); }
                }}>
          התחלת המשחק
        </Button>
      ) : (
        <p className="text-[0.85rem] text-ink/60">ממתינים שהמארח יתחיל…</p>
      )}

      {error && <p role="alert" className="text-[0.85rem] font-semibold text-red-600">{error}</p>}
    </div>
  );
}
