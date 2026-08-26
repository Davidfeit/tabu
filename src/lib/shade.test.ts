import { describe, it, expect } from "vitest";
import { darken, lighten, luminance, readableOn } from "./shade";

describe("גוני צבע", () => {
  it("מבהיר לכיוון לבן ומכהה לכיוון שחור", () => {
    expect(lighten("#000000", 1)).toBe("#ffffff");
    expect(darken("#ffffff", 1)).toBe("#000000");
    expect(lighten("#808080", 0)).toBe("#808080");
  });

  it("שומר על סדר הבהירות — מוצל < בסיס < מואר", () => {
    for (const c of ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"]) {
      expect(luminance(darken(c, 0.35))).toBeLessThan(luminance(c));
      expect(luminance(lighten(c, 0.35))).toBeGreaterThan(luminance(c));
    }
  });

  it("מקבל גם קיצור בן שלוש ספרות", () => {
    expect(lighten("#fff", 0)).toBe("#ffffff");
    expect(darken("#f00", 0.5)).toBe("#800000");   // 255 × 0.5 = 127.5, מעוגל למעלה
  });

  it("לא חורג מהתחום", () => {
    expect(lighten("#ffffff", 2)).toBe("#ffffff");
    expect(darken("#000000", 2)).toBe("#000000");
  });

  it("בוחר טקסט קריא מעל כל צבע מושב", () => {
    expect(readableOn("#ffffff")).toBe("#1a1a1a");
    expect(readableOn("#1F4E9C")).toBe("#ffffff");
    // תכלת וזית — שני הצבעים שסומנו במפרט כדורשים טקסט כהה
    expect(readableOn("#7FC7E8")).toBe("#1a1a1a");
    expect(readableOn("#C9B037")).toBe("#1a1a1a");
  });
});
