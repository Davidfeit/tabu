import { describe, it, expect, vi, afterEach } from "vitest";
import {
  bitrateFor, CAPTURE, classifyMediaError, diagnoseMedia, diagnosisLine, MAX_BITRATE,
} from "./media";

afterEach(() => vi.unstubAllGlobals());

describe("סיווג שגיאות מדיה", () => {
  it("מבחין בין המקרים שדורשים נוסח עברי שונה", () => {
    const cases: [string, string][] = [
      ["NotAllowedError", "denied"],
      ["NotFoundError", "no_device"],
      // נפוץ מאוד בווינדוס — זום או טימס מחזיקים את המצלמה
      ["NotReadableError", "in_use"],
      ["OverconstrainedError", "constraints"],
      ["SomethingElse", "unknown"],
    ];
    for (const [name, kind] of cases) expect(classifyMediaError({ name })).toBe(kind);
  });

  it("SecurityError הוא חסימת מסגרת, לא סירוב של המשתמש", () => {
    // ב-iframe עם מקור אטום, getUserMedia זורק SecurityError ולא
    // NotAllowedError. הודעה על "הרשאה נדחתה" תשלח את המשתמש להגדרות
    // הדפדפן, שם אין מה לתקן.
    expect(classifyMediaError({ name: "SecurityError" })).toBe("blocked_embed");
  });

  it("לא קורס על קלט לא צפוי", () => {
    expect(classifyMediaError(null)).toBe("unknown");
    expect(classifyMediaError("שגיאה")).toBe("unknown");
  });
});

describe("אבחון סביבה", () => {
  const stub = (o: {
    rtc?: boolean; secure?: boolean; api?: boolean; policy?: boolean | null; embedded?: boolean;
  }) => {
    const { rtc = true, secure = true, api = true, policy = true, embedded = false } = o;
    if (rtc) vi.stubGlobal("RTCPeerConnection", function () {});
    else vi.stubGlobal("RTCPeerConnection", undefined);
    const win = { isSecureContext: secure } as Record<string, unknown>;
    win.self = win;
    win.top = embedded ? {} : win;
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", api ? { mediaDevices: { getUserMedia: () => {} } } : {});
    vi.stubGlobal("document", policy === null ? {}
      : { featurePolicy: { allowsFeature: () => policy } });
  };

  it("מזהה סביבה תקינה", () => {
    stub({});
    expect(diagnoseMedia().block).toBe("ok");
  });

  it("מזהה חסימת מדיניות במסגרת — הסיבה האמיתית שראינו בשטח", () => {
    // navigator.mediaDevices דווקא קיים וההקשר מאובטח; רק המדיניות חוסמת.
    stub({ embedded: true, policy: false });
    const d = diagnoseMedia();
    expect(d.block).toBe("embedded");
    expect(d.hasApi).toBe(true);
    expect(d.secure).toBe(true);
  });

  it("לא מאשים את הדפדפן כשהבעיה היא חיבור לא מאובטח", () => {
    stub({ secure: false });
    expect(diagnoseMedia().block).toBe("insecure");
  });

  it("מדווח no_webrtc רק כשבאמת אין WebRTC", () => {
    stub({ rtc: false });
    expect(diagnoseMedia().block).toBe("no_webrtc");
  });

  it("מדווח no_api כשהמדיניות מותרת אבל אין ממשק", () => {
    stub({ api: false });
    expect(diagnoseMedia().block).toBe("no_api");
  });

  it("שורת האבחון אומרת מה נמדד", () => {
    stub({ embedded: true, policy: false });
    const line = diagnosisLine(diagnoseMedia());
    expect(line).toContain("מוטמע=כן");
    expect(line).toContain("מדיניות=חסום");
    expect(line).toContain("API=יש");
  });
});

describe("אילוצי הצילום", () => {
  it("מצלם ישר ברזולוציית היעד ולא מקטין", () => {
    const v = CAPTURE.video as MediaTrackConstraints;
    expect((v.width as { ideal: number }).ideal).toBe(640);
    expect((v.height as { ideal: number }).ideal).toBe(360);
  });

  it("תקציב ההעלאה נשמר גם בשולחן מלא", () => {
    // שולח אחד לכל עמית, ועוד אודיו. הסכום הוא מה שחייב להישאר סביר.
    expect(5 * (bitrateFor(5) + 24_000)).toBeLessThan(1_300_000);
  });

  it("שניים־שלושה משתתפים מקבלים את האיכות המלאה", () => {
    expect(bitrateFor(1)).toBe(MAX_BITRATE);
    expect(bitrateFor(2)).toBe(MAX_BITRATE);
    expect(bitrateFor(5)).toBeLessThan(MAX_BITRATE);
  });

  it("מבקש עיבוד אודיו — שישה מיקרופונים פתוחים ללא ביטול הד הם הד", () => {
    const a = CAPTURE.audio as MediaTrackConstraints;
    expect(a.echoCancellation).toBe(true);
  });
});
