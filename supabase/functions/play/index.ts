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
  // supabase-js מוסיף x-client-info ו-apikey מעבר לשתי הברורות. כותרת
  // שלא ברשימה מפילה את הבקשה המקדימה, והדפדפן מוותר על הקריאה עצמה
  // לפני שהיא יוצאת — מה שנראה ללקוח כמו נפילת רשת.
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** הפעולות שהגרסה הזו מכירה. הלקוח משווה מולה כדי לזהות שרת ישן. */
const OPS = ["ops", "create", "join", "start", "play", "signal"] as const;

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

/**
 * ממסר סיגנלינג של הווידאו, דרך ערוץ החדר.
 *
 * ערוץ נפרד לכל שחקן (sig:<uid>) דרש מדיניות משלו על realtime.messages,
 * ובפועל לא עבר. ערוץ החדר כן עובד — מצב המשחק זורם עליו — ולכן
 * הסיגנלינג רוכב עליו במקום על מסלול שלא הוכח. השידור נעשה מהשרת עם
 * תפקיד השירות, ולכן אינו תלוי במדיניות כתיבה של הלקוח.
 *
 * הנמען מסונן בצד הלקוח, אבל הרשות נבדקת כאן: רק חבר בחדר משדר בו, ורק
 * אל חבר אחר בו.
 */
async function relaySignal(userId: string, body: Record<string, unknown>) {
  const roomId = String(body.roomId ?? "");
  const to = String(body.to ?? "");
  const message = body.message;
  if (!roomId || !to || message === undefined) {
    return json({ ok: false, error: "BAD_SIGNAL" }, 400);
  }

  const { data: members } = await admin.from("game_room_players")
    .select("user_id").eq("room_id", roomId);
  const ids = new Set((members ?? []).map((m) => m.user_id));
  if (!ids.has(userId) || !ids.has(to)) {
    return json({ ok: false, error: "NOT_MEMBER" }, 403);
  }

  const { error } = await admin.rpc("tabu_broadcast", {
    p_topic: `room:${roomId}`,
    p_event: "signal",
    p_payload: { to, from: userId, message },
  });
  if (error) return json({ ok: false, error: "SIGNAL_FAILED" }, 500);
  return json({ ok: true });
}

async function joinRoom(userId: string, body: Record<string, unknown>) {
  const { data: room } = await admin.from("game_rooms")
    .select("id, status, max_players").eq("code", String(body.code ?? "")).single();
  if (!room) return json({ ok: false, error: "NO_ROOM" }, 404);

  const { data: players } = await admin.from("game_room_players")
    .select("user_id, seat").eq("room_id", room.id).order("seat");

  // חבר קיים חוזר למושב שלו — לפני בדיקת הסטטוס, בכוונה. מי שסגר את
  // הלשונית באמצע משחק חזר קודם ל-ALREADY_STARTED והיה צריך להתחיל מחדש,
  // בזמן שהמושב שלו והנכסים שלו ממתינים לו בחדר.
  const mine = players?.find((p) => p.user_id === userId);
  if (mine) return json({ ok: true, roomId: room.id, seat: mine.seat });

  if (room.status === "finished") {
    return json({ ok: false, error: "ALREADY_STARTED" }, 409);
  }
  if ((players?.length ?? 0) >= room.max_players) {
    return json({ ok: false, error: "ROOM_FULL" }, 409);
  }

  // המושב הפנוי הנמוך ביותר, ולא count — כדי שעזיבה לא תיצור התנגשות.
  const taken = new Set(players?.map((p) => p.seat));
  let seat = 0;
  while (taken.has(seat)) seat++;

  const name = String(body.name ?? "שחקן");
  const token = String(body.token ?? "camel");
  const { error } = await admin.from("game_room_players").insert({
    room_id: room.id, user_id: userId, seat, display_name: name, token,
  });
  if (error) return json({ ok: false, error: "JOIN_FAILED" }, 409);

  // משחק שכבר רץ: המושב נרשם, ועכשיו צריך גם להושיב אותו בשולחן. בלי זה
  // המצטרף רואה את הלוח אבל אינו בו — אין לו מזומן, אין לו תור, ואין דרך
  // להבחין בכך מהמסך.
  if (room.status === "active") {
    const added = await commitAction(
      room.id, userId, seat, { type: "add_player", userId, name, token },
    );
    if (!added.ok) {
      // מתגלגלים אחורה, אחרת נשאר מושב יתום שחוסם ניסיון נוסף.
      await admin.from("game_room_players")
        .delete().eq("room_id", room.id).eq("user_id", userId);
      return json({ ok: false, error: added.error }, added.status);
    }
  }

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
/**
 * מריץ פעולה במנוע ומתחייב עליה, עם סיבוב נוסף אם הגרסה התיישנה.
 *
 * משותף למהלכי משחק ולהצטרפות תוך כדי משחק — שתיהן שינוי מצב, ולשכפל
 * את לולאת ההתחייבות פירושו שתיקון בה יחול רק על אחת מהן.
 */
/**
 * מריץ פעולה ומתחייב עליה.
 *
 * key הוא מפתח האידמפוטנטיות, ועמודת ה-SQL שלו היא uuid. מחרוזת שאינה
 * uuid מפילה את הקריאה כולה על שגיאת המרה — וזה מה שקרה בהצטרפות
 * באמצע משחק, שנפלה על COMMIT_FAILED וגלגלה את המושב אחורה. לכן
 * ברירת מחדל שנוצרת כאן, ולא מחרוזת שמישהו מרכיב בקריאה.
 */
async function commitAction(
  roomId: string, userId: string, seat: number, action: unknown,
  key: string = crypto.randomUUID(),
): Promise<{ ok: true; version: number; state: Record<string, unknown> }
         | { ok: false; error: string; status: number }> {
  const { data: room } = await admin.from("game_rooms")
    .select("server_seed, status").eq("id", roomId).single();
  if (!room || room.status !== "active") {
    return { ok: false, error: "NOT_ACTIVE", status: 409 };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: row } = await admin.from("game_state")
      .select("version, state").eq("room_id", roomId).single();
    if (!row) return { ok: false, error: "NO_STATE", status: 404 };

    const result = reduce(row.state, action, {
      seat, now: Date.now(), seed: room.server_seed,
    });
    if (!result.ok) return { ok: false, error: result.error, status: 422 };

    const { data: commit, error } = await admin.rpc("commit_move", {
      p_room: roomId,
      p_expected_version: row.version,
      p_state: result.state,
      p_events: result.events,
      p_actor: userId,
      p_key: key,
    });
    if (error) return { ok: false, error: "COMMIT_FAILED", status: 500 };
    if (commit?.ok) {
      if (result.state.phase === "finished") {
        // הזרע נחשף רק עכשיו: מכאן אפשר לשחזר ולאמת כל גלגול במשחק.
        await admin.from("game_rooms").update({
          status: "finished", finished_at: new Date().toISOString(),
        }).eq("id", roomId);
      }
      return { ok: true, version: commit.version, state: result.state };
    }
    if (commit?.error !== "STALE") {
      return { ok: false, error: commit?.error ?? "COMMIT_FAILED", status: 409 };
    }
    // STALE — סיבוב נוסף עם המצב העדכני.
  }
  return { ok: false, error: "STALE", status: 409 };
}

async function play(userId: string, roomId: string, body: Record<string, unknown>) {
  const { data: seatRow } = await admin.from("game_room_players")
    .select("seat, status").eq("room_id", roomId).eq("user_id", userId).single();
  if (!seatRow) return json({ ok: false, error: "NOT_A_PLAYER" }, 403);

  const key = String(body.idempotencyKey ?? crypto.randomUUID());
  const r = await commitAction(roomId, userId, seatRow.seat, body.action, key);
  return r.ok
    ? json({ ok: true, version: r.version, state: r.state })
    : json({ ok: false, error: r.error }, r.status);
}

// ── ניתוב ────────────────────────────────────────────────────────────────

// שגיאה שלא נתפסת מוחזרת על ידי סביבת הריצה, בלי כותרות ה-CORS שלנו —
// ואז הדפדפן חוסם את התשובה, ו-supabase-js מדווח "Failed to send a request".
// כלומר כל תקלה בשרת נראית ללקוח כמו נפילת רשת. העטיפה הזו מחזירה שגיאה
// אמיתית עם הכותרות, כדי שיהיה מה לקרוא.
Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("unhandled", e);
    const detail = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: "SERVER_ERROR", detail }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    // מחזירים בדיוק את מה שהדפדפן ביקש: רשימה קבועה מתיישנת ברגע
    // ש-supabase-js מוסיף כותרת, וזה כשל שקט שקשה לאתר.
    const asked = req.headers.get("access-control-request-headers");
    return new Response(null, {
      headers: {
        ...CORS,
        ...(asked ? { "Access-Control-Allow-Headers": asked } : {}),
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "BAD_JSON" }, 400); }

  const op = String(body.op ?? "");
  const roomId = String(body.roomId ?? "");

  // שאלת גרסה, לא פעולת משחק: נענית לפני ההזדהות בכוונה. אחרת שרת ישן
  // ושרת חדש עונים אותו 401 לבודק חיצוני, ואי אפשר להבדיל ביניהם —
  // וזו בדיוק ההבחנה שבגללה הפעולה קיימת. אין כאן שום מידע פרטי.
  if (op === "ops") return json({ ok: true, ops: OPS });

  const userId = await callerId(req);
  if (!userId) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);

  switch (op) {
    case "create": return createRoom(userId, body);
    case "join":   return joinRoom(userId, body);
    case "start":  return startGame(userId, roomId);
    case "play":   return play(userId, roomId, body);
    case "signal": return relaySignal(userId, body);
    default:       return json({ ok: false, error: "UNKNOWN_OP" }, 400);
  }
}
