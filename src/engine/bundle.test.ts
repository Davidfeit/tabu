import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const BUNDLE = fileURLToPath(new URL("../../supabase/functions/_shared/engine.js", import.meta.url));

/**
 * החבילה שרצה ב-Edge Function.
 *
 * הבדיקה הזו קיימת כי כישלון כאן מתגלה אחרת רק בפרודקשן: הדפדפן ימשיך
 * לעבוד מ-src/, והשרת יקרוס. היא גם מוודאת שהחבילה לא התיישנה מול המקור.
 */
describe("חבילת המנוע ל-Deno", () => {
  it("קיימת — אחרת ה-Edge Function תקרוס", () => {
    expect(existsSync(BUNDLE)).toBe(true);
  });

  it("היא ESM עצמאית בלי ייבוא חיצוני", () => {
    const src = readFileSync(BUNDLE, "utf8");
    // Deno לא מכיר את הכינוי @/ ודורש סיומות מפורשות. חייבת להיות סגורה.
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/^import .* from ["'](?!node:)/m);
    expect(src).toContain("export {");
  });

  it("מריצה משחק אמיתי — נתוני הלוח מוטמעים בפנים", async () => {
    const mod = await import(BUNDLE);
    const game = mod.createGame(
      [{ userId: "a", name: "דנה", token: "camel" },
       { userId: "b", name: "יואב", token: "scooter" }],
      mod.defaultSettings("full"), "bundle-seed", 1_700_000_000_000,
    );
    expect(game.players).toHaveLength(2);
    expect(Object.keys(game.deeds)).toHaveLength(28);

    const r = mod.reduce(game, { type: "roll" },
                         { seat: game.currentSeat, now: 1_700_000_000_000, seed: "bundle-seed" });
    expect(r.ok).toBe(true);
    expect(r.events.some((e: { type: string }) => e.type === "rolled")).toBe(true);
  });

  it("מריצה גם שחמט — חוקי המשחק (chess.js) מוטמעים בפנים", async () => {
    const mod = await import(BUNDLE);
    const seats = [{ userId: "a", name: "דנה", token: "camel" },
                   { userId: "b", name: "יואב", token: "scooter" }];
    const game = mod.createAnyGame(seats, { game: "chess" }, "seed", 1_700_000_000_000);
    expect(game.game).toBe("chess");
    const r = mod.reduceAny(game, { type: "chess_move", from: "e2", to: "e4" },
                            { seat: 0, now: 1_700_000_000_000, seed: "seed" });
    expect(r.ok).toBe(true);
    expect(r.state.currentSeat).toBe(1);
    expect(mod.ALL_ACTIONS).toContain("chess_move");
    expect(mod.ALL_ACTIONS).toContain("finish_now");
  });

  it("מסכימה עם המקור — אותו זרע נותן אותו משחק בדיוק", async () => {
    const bundled = await import(BUNDLE);
    const source = await import("./index");
    const seats = [{ userId: "a", name: "א", token: "camel" },
                   { userId: "b", name: "ב", token: "boat" }];
    const args = [seats, source.defaultSettings("quick"), "agree", 1_700_000_000_000] as const;
    expect(JSON.stringify(bundled.createGame(...args)))
      .toBe(JSON.stringify(source.createGame(...args)));
  });
});
