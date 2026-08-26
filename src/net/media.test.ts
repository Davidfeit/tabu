import { describe, it, expect } from "vitest";
import { CAPTURE, classifyMediaError, MAX_BITRATE } from "./media";

describe("סיווג שגיאות מדיה", () => {
  it("מבחין בין המקרים שדורשים נוסח עברי שונה", () => {
    const cases: [string, string][] = [
      ["NotAllowedError", "denied"],
      ["SecurityError", "denied"],
      ["NotFoundError", "no_device"],
      // נפוץ מאוד בווינדוס — זום או טימס מחזיקים את המצלמה
      ["NotReadableError", "in_use"],
      ["OverconstrainedError", "constraints"],
      ["TypeError", "unsupported"],
      ["SomethingElse", "unknown"],
    ];
    for (const [name, kind] of cases) {
      expect(classifyMediaError({ name })).toBe(kind);
    }
  });

  it("לא קורס על קלט לא צפוי", () => {
    expect(classifyMediaError(null)).toBe("unknown");
    expect(classifyMediaError("שגיאה")).toBe("unknown");
    expect(classifyMediaError(new Error("boom"))).toBe("unknown");
  });
});

describe("אילוצי הצילום", () => {
  it("מצלם ישר ברזולוציית היעד ולא מקטין", () => {
    const v = CAPTURE.video as MediaTrackConstraints;
    expect((v.width as { ideal: number }).ideal).toBe(320);
    expect((v.height as { ideal: number }).ideal).toBe(180);
    expect((v.frameRate as { ideal: number }).ideal).toBe(15);
  });

  it("תקציב ההעלאה ב-6 שחקנים נשאר סביר", () => {
    // 5 חיבורים יוצאים; וידאו + אודיו לכל אחד.
    const perPeer = MAX_BITRATE + 24_000;
    expect(5 * perPeer).toBeLessThan(1_000_000);   // מתחת ל-1Mbps
  });

  it("מבקש עיבוד אודיו — שישה מיקרופונים פתוחים ללא ביטול הד הם הד", () => {
    const a = CAPTURE.audio as MediaTrackConstraints;
    expect(a.echoCancellation).toBe(true);
    expect(a.noiseSuppression).toBe(true);
  });
});
