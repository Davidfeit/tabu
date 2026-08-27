/**
 * מחבר לקוח יחיד ל-Realtime של Supabase.
 *
 * למה זה נחוץ: שירות ה-Realtime לא רץ לפרויקט שאיש עדיין לא התחבר אליו,
 * והוא זה שיוצר את המחיצות של realtime.messages. בלי מחיצה, כל שידור
 * מה-DB נזרק בשקט (ראו db/004). חיבור אחד מספיק כדי להעיר אותו.
 *
 * נקרא מ-scripts/wake-realtime.sh, שמספק SUPABASE_URL ו-SUPABASE_ANON_KEY.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("חסרים SUPABASE_URL או SUPABASE_ANON_KEY");
  process.exit(2);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ערוץ ציבורי רגיל: המטרה היא רק לגרום לשרת להתחיל לעבוד עבור הפרויקט,
// ולכן אין צורך בהזדהות או במדיניות RLS.
const channel = client.channel("tabu-wake");

const status = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve("TIMED_OUT"), 25_000);
  channel.subscribe((s) => {
    if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
      clearTimeout(timer);
      resolve(s);
    }
  });
});

if (status !== "SUBSCRIBED") {
  console.error(`   החיבור ל-Realtime נכשל: ${status}`);
  await client.removeAllChannels();
  process.exit(1);
}

console.log("   מחובר ל-Realtime");
await channel.send({ type: "broadcast", event: "wake", payload: {} });

// נותנים לשרת רגע לסיים את אתחול הדייר לפני שסוגרים.
await new Promise((r) => setTimeout(r, 3_000));
await client.removeAllChannels();
console.log("   נותק");
