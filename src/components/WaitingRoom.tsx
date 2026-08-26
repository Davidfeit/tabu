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
      <h1 className="font-logo text-4xl text-parchment">חדר המתנה</h1>

      <div className="rounded-lg bg-black/30 p-4 ring-1 ring-white/10">
        <div className="text-[0.75rem] text-parchment/50">קוד החדר</div>
        <div className="mt-1 font-mono text-4xl tracking-[0.35em] text-amber-300"
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
              className="flex items-center gap-2.5 rounded-md bg-black/25 px-3 py-2
                         ring-1 ring-white/10">
            <Token token={s.token} seat={s.seat} size={22} />
            <span className="min-w-0 flex-1 truncate text-right text-sm font-medium"
                  style={{ color: seatColor(s.seat), unicodeBidi: "plaintext" }}>
              {s.display_name}
            </span>
            {s.user_id === room.userId && (
              <span className="text-[0.68rem] text-parchment/40">את/ה</span>
            )}
          </li>
        ))}
        {seats.length < 2 && (
          <li className="rounded-md border border-dashed border-white/10 px-3 py-2
                         text-[0.78rem] text-parchment/35">
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
        <p className="text-[0.8rem] text-parchment/45">ממתינים שהמארח יתחיל…</p>
      )}

      {error && <p role="alert" className="text-[0.8rem] text-red-300">{error}</p>}
    </div>
  );
}
