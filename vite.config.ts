import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";

/**
 * נתיב הבסיס.
 *
 * פרויקט Vercel עצמאי מגיש מהשורש. GitHub Pages ותת-נתיב מגישים מתוך
 * תיקייה, ואז כל הנכסים חייבים להיות יחסיים אליה — אחרת העמוד נטען
 * ריק בלי שום שגיאה גלויה.
 */
const base = process.env.VITE_BASE ?? "/";

/**
 * מזהה הבנייה, מוטמע בזמן הידור.
 *
 * "עדכנתי ולא השתנה כלום" הוא מבוי סתום בלי דרך לדעת איזו גרסה באוויר.
 * Vercel מספקת את ה-SHA של הקומיט שנבנה; מקומית לוקחים אותו מ-git.
 */
function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? (() => {
      try {
        return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
      } catch { return "dev"; }
    })();
  return sha.slice(0, 7);
}

export default defineConfig({
  base,
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
