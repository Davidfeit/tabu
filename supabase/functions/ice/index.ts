/**
 * אישורי TURN.
 *
 * ~10–20% מהחיבורים לא מצליחים P2P וזקוקים לממסר. בישראל להניח את הקצה
 * העליון — הסלולר עושה שימוש כבד ב-CGNAT. Cloudflare TURN נותן 1,000GB
 * חינם בחודש ויש לו PoP בתל אביב.
 *
 * המפתח לעולם לא מגיע לדפדפן: האישורים מונפקים כאן, עם TTL של שלוש שעות.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  // supabase-js מוסיף x-client-info ו-apikey מעבר לשתי הברורות. כותרת
  // שלא ברשימה מפילה את הבקשה המקדימה, והדפדפן מוותר על הקריאה עצמה
  // לפני שהיא יוצאת — מה שנראה ללקוח כמו נפילת רשת.
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status, headers: { ...CORS, "content-type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

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

  // שאלת תצורה, לא אישורים: נענית לפני ההזדהות, כמו ops ב-play. הצורך
  // הוכח — המפתחות נוצרו בקלאודפלייר ומעולם לא נשמרו כאן, ואיש לא ידע
  // עד שמשחק חי נכשל. עכשיו הפריסה עצמה שואלת ואומרת. התשובה היא בוליאני
  // על תצורה, בלי שום ערך סודי.
  let probe: Record<string, unknown> = {};
  try { probe = await req.clone().json(); } catch { /* גוף ריק — לא נורא */ }
  if (probe.op === "status") {
    // "הסודות כבר קיימים" מול "השרת לא רואה אותם" — ההבדל כמעט תמיד בשם:
    // אות קטנה, רווח בסוף, שם אחר. השמות בלבד, מסוננים לנושא, בלי ערכים.
    const names = Object.keys(Deno.env.toObject())
      .filter((k) => /turn|cloudflare|^cf_/i.test(k)).sort();
    return json({
      ok: true,
      turn: Boolean(Deno.env.get("TURN_KEY_ID") && Deno.env.get("TURN_KEY_API_TOKEN")),
      names,
    });
  }

  // רק משתמש מזוהה. אחרת זהו ממסר חינמי לכל מי שמוצא את הכתובת.
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "UNAUTHENTICATED" }, 401);
  const { data, error } = await admin.auth.getUser(auth.slice(7));
  if (error || !data.user) return json({ error: "UNAUTHENTICATED" }, 401);

  const keyId = Deno.env.get("TURN_KEY_ID");
  const token = Deno.env.get("TURN_KEY_API_TOKEN");
  // reason נוסע עם התשובה כדי שהאבחון בדפדפן יוכל להבדיל בין "לא הוגדרו
  // מפתחות" לבין "המפתחות הוגדרו וקלאודפלייר דחה אותם". שני המצבים נראו
  // מהמסך זהים — אין ממסר — ושלחו אותנו לחפש במקום הלא נכון. אין כאן שום
  // ערך סודי: רק למה זה נכשל.
  if (!keyId || !token) return json({ iceServers: [], reason: "no_keys" });

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: 10_800 }),
    },
  );
  if (!res.ok) return json({ iceServers: [], reason: `cf_${res.status}` });
  const body = await res.json();
  return json({ ...body, reason: "ok" });
}
