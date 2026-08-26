/**
 * מקבץ את מנוע המשחק לקובץ ESM יחיד ל-Deno.
 *
 * ה-Edge Function חייבת להריץ את *אותו* מנוע כמו הדפדפן. Deno דורש סיומות
 * מפורשות ולא מכיר את הכינוי @/, ולכן ייבוא ישיר של src/ לא יעבוד. קיבוץ
 * פותר את שניהם ומשאיר מקור אחד — שכפול היה מתפצל ביום הראשון.
 */
import { build } from "esbuild";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: [root + "src/engine/index.ts"],
  outfile: root + "supabase/functions/_shared/engine.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  loader: { ".json": "json" },
  alias: { "@": root + "src" },
  banner: {
    js: "// נוצר אוטומטית מ-src/engine — אל תערוך.\n"
      + "// להרצה מחדש: npm run build:engine\n",
  },
  logLevel: "info",
});
