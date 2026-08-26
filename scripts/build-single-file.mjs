/**
 * אורז את המשחק לקובץ HTML יחיד.
 *
 * המשחק המקומי (כל השחקנים על מסך אחד) הוא עמוד סטטי לגמרי — אין לו שרת,
 * אין קריאות רשת חוץ מ-Google Fonts, וכל המנוע רץ בדפדפן. לכן אפשר לשלוח
 * אותו כקובץ אחד: לפתוח מהדיסק, לצרף למייל, או לפרסם ככתובת.
 *
 *   npm run build && node scripts/build-single-file.mjs
 *   → dist/tabu.html
 *
 * מצב אונליין לא נכלל: הוא דורש Supabase, וכפתור האונליין יופיע כבוי.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = root + "dist/assets/";
const pick = (ext) => {
  const f = readdirSync(assets).find((n) => n.endsWith(ext));
  if (!f) throw new Error(`לא נמצא ${ext} ב-dist/assets — הריצו npm run build קודם`);
  return readFileSync(assets + f, "utf8");
};

const css = pick(".css");
// מחרוזת שמכילה ‎</script‎ הייתה סוגרת את התג מוקדם ושוברת את העמוד.
const js = pick(".js").replaceAll("</script", "<\\/script");

const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1280">
<title>טאבו</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Rubik:wght@500;600;700&family=Secular+One&display=swap" rel="stylesheet">
<style>
/* המשחק מתחייב לעולם חזותי אחד — שולחן לבד ירוק בחדר חשוך — ולכן הוא
   חד-ערכתי בכוונה. הרקע נצבע במפורש כדי שהעמוד יחזיק על כל רקע מארח. */
html, body { background: #171717; color-scheme: dark; }
</style>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${js}
</script>
</body>
</html>
`;

const out = root + "dist/tabu.html";
writeFileSync(out, html);
console.log(`נוצר ${out} — ${Math.round(html.length / 1024)}KB`);
