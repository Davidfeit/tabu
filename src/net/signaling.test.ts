import { describe, it, expect, vi } from "vitest";
import { estimateSignalMessages, IceBatcher, isInitiator, isPolite, signalTopic } from "./signaling";

describe("נימוס דטרמיניסטי", () => {
  it("שני הצדדים מגיעים לאותה מסקנה, בלי סיבוב תקשורת", () => {
    expect(isPolite("a", "b")).toBe(true);
    expect(isPolite("b", "a")).toBe(false);
  });

  it("בדיוק צד אחד יוזם בכל זוג", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        expect(isInitiator(a, b)).not.toBe(isInitiator(b, a));
        expect(isPolite(a, b)).not.toBe(isPolite(b, a));
      }
    }
  });

  it("היוזם הוא תמיד הצד הלא-מנומס", () => {
    expect(isInitiator("a", "b")).toBe(!isPolite("a", "b"));
  });

  it("דוחה חיבור לעצמך", () => {
    expect(() => isPolite("x", "x")).toThrow();
  });
});

describe("איגוד מועמדי ICE", () => {
  it("שולח חבילה אחת במקום הודעה למועמד", () => {
    vi.useFakeTimers();
    const sent: [string, RTCIceCandidateInit[]][] = [];
    const b = new IceBatcher(200, (peer, c) => sent.push([peer, c]));
    for (let i = 0; i < 12; i++) b.add("peer1", { candidate: `c${i}` });
    expect(sent).toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]![1]).toHaveLength(12);
    vi.useRealTimers();
  });

  it("מפריד בין עמיתים", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const b = new IceBatcher(200, (peer) => sent.push(peer));
    b.add("a", { candidate: "1" });
    b.add("b", { candidate: "2" });
    vi.advanceTimersByTime(200);
    expect(sent.sort()).toEqual(["a", "b"]);
    vi.useRealTimers();
  });

  it("flush מיידי שולח את מה שהצטבר ומבטל את הטיימר", () => {
    vi.useFakeTimers();
    const sent: RTCIceCandidateInit[][] = [];
    const b = new IceBatcher(200, (_p, c) => sent.push(c));
    b.add("a", { candidate: "1" });
    b.flush("a");
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(sent).toHaveLength(1);      // הטיימר לא ירה שוב על ריק
    vi.useRealTimers();
  });

  it("dispose לא משאיר טיימרים תלויים", () => {
    vi.useFakeTimers();
    const sent: unknown[] = [];
    const b = new IceBatcher(200, () => sent.push(1));
    b.add("a", { candidate: "1" });
    b.dispose();
    vi.advanceTimersByTime(500);
    expect(sent).toHaveLength(0);
    expect(b.pendingCount("a")).toBe(0);
    vi.useRealTimers();
  });
});

describe("תקציב ההודעות", () => {
  it("ערוץ פר-שחקן ואיגוד חוסכים כמעט פי 25", () => {
    // 6 משתתפים, ~15 מועמדי ICE לכל חיבור.
    const naive = estimateSignalMessages(6, 15, 1, false);
    const smart = estimateSignalMessages(6, 15, 15, true);
    expect(naive).toBeGreaterThan(1500);
    expect(smart).toBeLessThan(100);
    expect(naive / smart).toBeGreaterThan(20);
  });

  it("השכבה החינמית מספיקה לאלפי משחקים בגישה הנכונה", () => {
    const perGame = estimateSignalMessages(6, 15, 15, true);
    expect(2_000_000 / perGame).toBeGreaterThan(20_000);
  });
});

describe("שמות ערוצים", () => {
  it("ערוץ נפרד לכל שחקן — לא שידור לחדר", () => {
    expect(signalTopic("abc")).toBe("sig:abc");
    expect(signalTopic("abc")).not.toContain("room:");
  });
});
