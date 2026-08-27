import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * נתיב הבסיס.
 *
 * פרויקט Vercel עצמאי מגיש מהשורש. GitHub Pages ותת-נתיב מגישים מתוך
 * תיקייה, ואז כל הנכסים חייבים להיות יחסיים אליה — אחרת העמוד נטען
 * ריק בלי שום שגיאה גלויה.
 */
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
