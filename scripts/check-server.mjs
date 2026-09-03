/**
 * משווה בין הקוד שכאן לבין הפונקציה שרצה בפועל בענן.
 *
 *   npm run check:server
 *
 * הצורך: שני חצאי המערכת נפרסים בשתי דרכים שונות — האתר עולה לוורסל
 * אוטומטית בכל דחיפה, והפונקציות רק כשמריצים את סקריפט ההתקנה. לכן הם
 * יכולים להיפרד בלי ששום דבר יצעק, והתוצאה נראית כמו תקלה באפליקציה
 * ("הווידאו לא עובד") ולא כמו שרת ישן.
 *
 * הבדיקה עצמה לא דורשת הזדהות: פעולת ops נענית לפני בדיקת המשתמש, כדי
 * ששרת ישן ושרת חדש לא יענו אותה תשובה לבודק חיצוני.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function fail(title, ...lines) {
  console.error(`\n${red("✗ " + title)}`);
  for (const l of lines) console.error("   " + l);
  process.exit(1);
}

/** הערכים שהאתר נבנה איתם. משתנה סביבה גובר, כמו בבנייה עצמה. */
function env() {
  let url = process.env.VITE_SUPABASE_URL;
  let key = process.env.VITE_SUPABASE_ANON_KEY;
  const f = join(ROOT, ".env.production");
  if ((!url || !key) && existsSync(f)) {
    const txt = readFileSync(f, "utf8");
    url ||= /^VITE_SUPABASE_URL=(.*)$/m.exec(txt)?.[1]?.trim();
    key ||= /^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(txt)?.[1]?.trim();
  }
  if (!url || !key) {
    fail("אין כתובת פרויקט ומפתח anon",
      "צרו .env.production (ראו .env.example) או הגדירו את שני המשתנים בסביבה.");
  }
  return { url: url.replace(/\/$/, ""), key };
}

/** רשימת הפעולות שהקוד כאן מכיר. */
function localOps() {
  const src = readFileSync(join(ROOT, "supabase/functions/play/index.ts"), "utf8");
  const m = /const OPS = \[([^\]]*)\]/.exec(src);
  if (!m) fail("לא נמצאה רשימת OPS ב-supabase/functions/play/index.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/**
 * מהלכי המשחק שהמנוע כאן מכיר.
 *
 * נקרא מהמקור ולא מהחבילה המקובצת, כי החבילה מתעדכנת רק בבנייה — ואם
 * שכחו לבנות, זו בדיוק התקלה שהבדיקה הזו אמורה לתפוס.
 */
function localActions() {
  // שני המשחקים, כי שניהם רצים באותה פונקציה — ראה src/engine/any.ts.
  const files = ["src/engine/reduce.ts", "src/chess/reduce.ts"];
  const out = [];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    const m = /const KNOWN: Record<\w+, true> = \{([^}]*)\}/.exec(src);
    if (m) out.push(...[...m[1].matchAll(/(\w+):\s*true/g)].map((x) => x[1]));
  }
  return out.sort();
}

function head() {
  try {
    return execFileSync("git", ["-C", ROOT, "log", "-1", "--format=%h %s"], {
      encoding: "utf8",
    }).trim();
  } catch { return "(לא ידוע)"; }
}

const { url, key } = env();
const want = localOps();

let res, body;
try {
  res = await fetch(`${url}/functions/v1/play`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key,
               authorization: `Bearer ${key}` },
    body: JSON.stringify({ op: "ops" }),
  });
  body = await res.json().catch(() => null);
} catch (e) {
  fail("לא הצלחתי להגיע לפונקציה בכלל", `${url}/functions/v1/play`,
    String(e?.message ?? e), "",
    "אם הכתובת נכונה, כנראה הפונקציה מעולם לא נפרסה:",
    "   npm run setup:supabase");
}

console.log(`\n${bold("→ הקוד כאן")}`);
console.log(`   ${head()}`);
console.log(`   פעולות בקוד: ${want.join(", ")}`);
console.log(`\n${bold("→ השרת בפועל")}`);
console.log(`   ${url}/functions/v1/play → HTTP ${res.status}`);

const live = Array.isArray(body?.ops) ? body.ops : null;
if (!live) {
  const err = body?.error ?? JSON.stringify(body);
  fail(`הפונקציה שרצה בענן ישנה (ענתה ${err})`,
    "היא לא מכירה את פעולת ops, כלומר היא נפרסה לפני השינוי הזה.",
    "",
    "מה לעשות — לפי הסדר:",
    "   git pull                  (שהקוד כאן יהיה עדכני)",
    "   npm run setup:supabase    (שהשרת יקבל אותו)",
    "   npm run check:server      (לוודא שזה תפס)",
    "",
    "אם הפריסה נכשלת על 403, הריצו אותה עם אסימון של החשבון הנכון:",
    "   SUPABASE_ACCESS_TOKEN='sbp_...' npm run setup:supabase");
}

console.log(`   פעולות בשרת: ${live.join(", ")}`);
const missing = want.filter((op) => !live.includes(op));
if (missing.length) {
  fail(`בשרת חסרות פעולות: ${missing.join(", ")}`,
    "הקוד כאן חדש יותר מהפונקציה שרצה בענן.",
    "",
    "   npm run setup:supabase    ואז    npm run check:server");
}

// שכבה שנייה: לא שמות הפעולות אלא המנוע עצמו. הפונקציה יכולה להכיר את
// כל שמות ה-API ועדיין להריץ מנוע ישן, כי הוא נכנס אליה כחבילה מקובצת —
// וזה נראה למשתמש כמו כפתור שבור ("פעולה לא מוכרת") ולא כמו שרת ישן.
const wantActions = localActions();
const liveActions = Array.isArray(body?.actions) ? body.actions : null;
if (wantActions.length && !liveActions) {
  fail("המנוע שרץ בענן ישן",
    "הפונקציה לא מדווחת בכלל אילו מהלכים היא מכירה, כלומר היא נפרסה",
    "לפני שהדיווח הזה נולד.",
    "",
    "   npm run setup:supabase    ואז    npm run check:server");
}
if (liveActions) {
  const goneActions = wantActions.filter((a) => !liveActions.includes(a));
  if (goneActions.length) {
    fail(`במנוע שבשרת חסרים מהלכים: ${goneActions.join(", ")}`,
      "שמות הפעולות תואמים, אבל המנוע עצמו ישן — ולכן מהלכים חדשים",
      "יחזרו ללקוח כ\"פעולה לא מוכרת\".",
      "",
      "   npm run setup:supabase    ואז    npm run check:server");
  }
  console.log(`   מהלכים במנוע: ${liveActions.length} מתוך ${wantActions.length} שבקוד`);
}

// הפונקציה השנייה. 401 על גוף ריק הוא התשובה התקינה — סימן שהיא חיה.
// עם {op:"status"} היא גם אומרת אם מפתחות ה-TURN הוגדרו, וזו השאלה
// שעלתה לנו ימים: בלי ממסר אין וידאו ברשת שחוסמת עמית-לעמית, והמסך
// הראה בדיוק אותו דבר כמו תקלת רשת.
let iceStatus = "לא נבדק";
let turn = null;
let turnNames = [];
try {
  const r = await fetch(`${url}/functions/v1/ice`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key,
               authorization: `Bearer ${key}` },
    body: JSON.stringify({ op: "status" }),
  });
  iceStatus = r.status === 404 ? "לא נפרסה" : `חיה (HTTP ${r.status})`;
  const b = await r.json().catch(() => null);
  if (typeof b?.turn === "boolean") turn = b.turn;
  if (Array.isArray(b?.names)) turnNames = b.names;
} catch { iceStatus = "לא נענתה"; }
console.log(`   פונקציית ice: ${iceStatus}`);
if (turn === true) {
  console.log(`   ${green("מפתחות TURN: מוגדרים")}`);
} else if (turn === false) {
  console.log(`   \x1b[33mמפתחות TURN: לא מוגדרים\x1b[0m`);
  if (turnNames.length) {
    // השמות שהשרת כן רואה. "TURN_KEY_ID " עם רווח, או turn_key_id, נראים
    // בלוח הבקרה בדיוק כמו הנכון — וכאן ההבדל גלוי.
    console.log(`     סודות עם שם דומה שכן קיימים: ${turnNames.map((n) => JSON.stringify(n)).join(", ")}`);
    console.log("     הנדרשים בדיוק: \"TURN_KEY_ID\", \"TURN_KEY_API_TOKEN\"");
  } else {
    console.log("     השרת לא רואה שום סוד ששמו מכיל TURN.");
  }
  console.log("     בלי ממסר, וידאו לא יעבוד ברשת שחוסמת עמית-לעמית.");
  console.log("     Supabase → Edge Functions → Secrets:");
  console.log("       TURN_KEY_ID, TURN_KEY_API_TOKEN  (מ-Cloudflare Realtime → TURN)");
  console.log("     או כסודות בריפו, והפריסה תדחוף אותם לבד.");
}

console.log(`\n${green("✓ השרת מעודכן — כל הפעולות שהקוד צריך קיימות בו")}\n`);
