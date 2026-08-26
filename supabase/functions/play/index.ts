/**
 * טאבו — הסמכות.
 *
 * זו הנקודה היחידה שבה מצב משחק משתנה. הלקוח שולח *פעולה*, לא מצב; השרת
 * מריץ את המנוע ומתחייב. לכן אי אפשר לרמות בקוביות, ביתרה או בבעלות —
 * הדפדפן פשוט לא מחשב אותן.
 *
 * שכבת ההתחייבות היא commit_move() ב-SQL: עדכון מותנה על version, כתיבת
 * יומן ושידור, הכל בטרנזקציה אחת. ראה db/002_commit_move.sql.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createGame, defaultSettings, reduce } from "../_shared/engine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** קוד חדר קריא, בלי תווים שקל לבלבל ביניהם בהקראה בטלפון. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function roomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  return data.user.id;
}

// ── פעולות ───────────────────────────────────────────────────────────────

async function createRoom(userId: string, body: Record<string, unknown>) {
  const settings = { ...defaultSettings("quick"), ...(body.settings as object ?? {}) };
  // הזרע נשאר בשרת. ה-hash מתפרסם עכשיו, הזרע עצמו רק בסיום — וכך אפשר
  // לשחזר כל גלגול בדיעבד ולהוכיח שלא שונה.
  const seed = crypto.randomUUID() + crypto.randomUUID();
  const hash = [...new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  )].map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data, error } = await admin.from("game_rooms").insert({
    code: roomCode(), host_id: userId, status: "lobby",
    settings, server_seed: seed, server_seed_hash: hash,
  }).select("id, code").single();
  if (error) return json({ ok: false, error: "ROOM_CREATE_FAILED" }, 500);

  await admin.from("game_room_players").insert({
    room_id: data.id, user_id: userId, seat: 0,
    display_name: String(body.name ?? "שחקן"), token: String(body.token ?? "camel"),
  });
  return json({ ok: true, roomId: data.id, code: data.code, seedHash: hash });
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const { data: room } = await admin.from("game_rooms")
    .select("id, status, max_players").eq("code", String(body.code ?? "")).single();
  if (!room) return json({ ok: false, error: "NO_ROOM" }, 404);
  if (room.status !== "lobby") return json({ ok: false, error: "ALREADY_STARTED" }, 409);

  const { data: players } = await admin.from("game_room_players")
    .select("user_id, seat").eq("room_id", room.id).order("seat");
  const mine = players?.find((p) => p.user_id === userId);
  if (mine) return json({ ok: true, roomId: room.id, seat: mine.seat });
  if ((players?.length ?? 0) >= room.max_players) {
    return json({ ok: false, error: "ROOM_FULL" }, 409);
  }

  // המושב הפנוי הנמוך ביותר, ולא count — כדי שעזיבה לא תיצור התנגשות.
  const taken = new Set(players?.map((p) => p.seat));
  let seat = 0;
  while (taken.has(seat)) seat++;

  const { error } = await admin.from("game_room_players").insert({
    room_id: room.id, user_id: userId, seat,
    display_name: String(body.name ?? "שחקן"), token: String(body.token ?? "camel"),
  });
  if (error) return json({ ok: false, error: "JOIN_FAILED" }, 409);
  return json({ ok: true, roomId: room.id, seat });
}

async function startGame(userId: string, roomId: string) {
  const { data: room } = await admin.from("game_rooms")
    .select("id, host_id, status, settings, server_seed").eq("id", roomId).single();
  if (!room) return json({ ok: false, error: "NO_ROOM" }, 404);
  if (room.host_id !== userId) return json({ ok: false, error: "NOT_HOST" }, 403);
  if (room.status !== "lobby") return json({ ok: false, error: "ALREADY_STARTED" }, 409);

  const { data: players } = await admin.from("game_room_players")
    .select("user_id, display_name, token").eq("room_id", roomId).order("seat");
  if (!players || players.length < 2) return json({ ok: false, error: "NOT_ENOUGH" }, 409);

  const state = createGame(
    players.map((p) => ({ userId: p.user_id, name: p.display_name, token: p.token })),
    room.settings, room.server_seed, Date.now(),
  );

  await admin.from("game_state").upsert({
    room_id: roomId, version: 0, seq: 0, phase: state.phase,
    current_seat: state.currentSeat, state,
    turn_deadline: state.turnDeadline ? new Date(state.turnDeadline).toISOString() : null,
  });
  await admin.from("game_rooms")
    .update({ status: "active", started_at: new Date().toISOString() }).eq("id", roomId);
  return json({ ok: true, version: 0, state });
}

/**
 * מהלך.
 *
 * ניסיון חוזר אחד על STALE: שחקן אחר הספיק להתחייב בין הקריאה לכתיבה.
 * זה לא כישלון אלא בדיוק מה שהנעילה האופטימית אמורה לתפוס — טוענים מחדש
 * ומריצים את המנוע על המצב העדכני.
 */
async function play(userId: string, roomId: string, body: Record<string, unknown>) {
  const { data: seatRow } = await admin.from("game_room_players")
    .select("seat, status").eq("room_id", roomId).eq("user_id", userId).single();
  if (!seatRow) return json({ ok: false, error: "NOT_A_PLAYER" }, 403);

  const { data: room } = await admin.from("game_rooms")
    .select("server_seed, status").eq("id", roomId).single();
  if (!room || room.status !== "active") return json({ ok: false, error: "NOT_ACTIVE" }, 409);

  const key = String(body.idempotencyKey ?? crypto.randomUUID());

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: row } = await admin.from("game_state")
      .select("version, state").eq("room_id", roomId).single();
    if (!row) return json({ ok: false, error: "NO_STATE" }, 404);

    const result = reduce(row.state, body.action, {
      seat: seatRow.seat, now: Date.now(), seed: room.server_seed,
    });
    if (!result.ok) return json({ ok: false, error: result.error }, 422);

    const { data: commit, error } = await admin.rpc("commit_move", {
      p_room: roomId,
      p_expected_version: row.version,
      p_state: result.state,
      p_events: result.events,
      p_actor: userId,
      p_key: key,
    });
    if (error) return json({ ok: false, error: "COMMIT_FAILED" }, 500);
    if (commit?.ok) {
      if (result.state.phase === "finished") {
        // הזרע נחשף רק עכשיו: מכאן אפשר לשחזר ולאמת כל גלגול במשחק.
        await admin.from("game_rooms").update({
          status: "finished", finished_at: new Date().toISOString(),
        }).eq("id", roomId);
      }
      return json({ ok: true, version: commit.version, state: result.state });
    }
    if (commit?.error !== "STALE") return json({ ok: false, error: commit?.error }, 409);
    // STALE — סיבוב נוסף עם המצב העדכני.
  }
  return json({ ok: false, error: "STALE" }, 409);
}

// ── ניתוב ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  const userId = await callerId(req);
  if (!userId) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "BAD_JSON" }, 400); }

  const op = String(body.op ?? "");
  const roomId = String(body.roomId ?? "");

  switch (op) {
    case "create": return createRoom(userId, body);
    case "join":   return joinRoom(userId, body);
    case "start":  return startGame(userId, roomId);
    case "play":   return play(userId, roomId, body);
    default:       return json({ ok: false, error: "UNKNOWN_OP" }, 400);
  }
});
