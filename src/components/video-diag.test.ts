import { describe, it, expect } from "vitest";
import { fakePeer as peer } from "@/net/peer-fixture";
import { diagLines, needsDiag } from "./videoDiag";

describe("אבחון וידאו", () => {
  it("אומר כשאין בכלל מי להתחבר אליו", () => {
    const l = diagLines({ selfId: "abcd1234", wanted: [], peers: [] });
    expect(l[0]).toContain("מבוקשים: אין");
    expect(l.join(" ")).toContain("אף אחד אחר לא נמצא במצב המשחק");
  });

  it("מבחין בין 'לא נוצר חיבור' לבין 'חיבור שלא הצליח'", () => {
    const none = diagLines({ selfId: "me00", wanted: ["you0"], peers: [] });
    expect(none.join(" ")).toContain("לא נוצר אף RTCPeerConnection");

    const some = diagLines({ selfId: "me00", wanted: ["you0"],
                             peers: [peer({ id: "you0", connection: "failed" })] });
    expect(some.join(" ")).not.toContain("RTCPeerConnection");
    expect(some.join(" ")).toContain("failed");
  });

  it("יצא ולא חזר — מצביע על השידור, לא על ICE", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"],
                          peers: [peer({ id: "you0" })],
                          stats: { sent: 6, failed: 0, received: 0, forMe: 0, online: ["me00", "you0"] } });
    expect(l.join(" ")).toContain("השידור מהשרת לא מגיע לערוץ");
  });

  it("חזר אבל לא אליי — מצביע על המזהים", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"],
                          peers: [peer({ id: "you0" })],
                          stats: { sent: 6, failed: 0, received: 4, forMe: 0, online: ["me00", "you0"] } });
    expect(l.join(" ")).toContain("המזהים לא תואמים");
  });

  it("כשהכל זורם אין מה להציג", () => {
    const stream = {} as MediaStream;
    expect(needsDiag({ wanted: ["you0"], peers: [peer({ id: "you0", stream })] })).toBe(false);
    // אבל זרם שלא זורמים בו פריימים הוא בדיוק המקרה שבו צריך אבחון.
    expect(needsDiag({ wanted: ["you0"], peers: [peer({ id: "you0", stream,
      video: { tracks: 1, live: true, muted: true } })] })).toBe(true);
    expect(needsDiag({ wanted: ["you0"], peers: [peer({ id: "you0" })] })).toBe(true);
    expect(needsDiag({ wanted: [], peers: [] })).toBe(false);
  });

  it("כשל ממסר מוצג כמות שהוא", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"], peers: [],
                          relayError: "הממסר נכשל: 500" });
    expect(l[l.length - 1]).toBe("הממסר נכשל: 500");
  });
});

describe("פירוט לכל עמית", () => {
  const base = { selfId: "me00", wanted: ["you0"] };

  it("מפריד בין הכיוונים — מה יצא ומה נכנס", () => {
    const l = diagLines({ ...base, peers: [peer({
      id: "you0", out: { offer: 1, answer: 0, ice: 2 },
      in: { offer: 1, answer: 0, ice: 1 } })] }).join("\n");
    expect(l).toContain("↑ הצעה 1 תשובה 0 ICE 2");
    expect(l).toContain("↓ הצעה 1 תשובה 0 ICE 1");
  });

  it("מציג את השגיאה שנבלעה בטיפול בהודעה", () => {
    const l = diagLines({ ...base, peers: [peer({
      id: "you0", lastError: "offer: Failed to set remote offer sdp" })] }).join("\n");
    expect(l).toContain("Failed to set remote offer sdp");
  });

  it("SDP שהגיע והחיבור נשאר new — עוצר את החשד ב-ICE", () => {
    const l = diagLines({ ...base, peers: [peer({
      id: "you0", connection: "new", in: { offer: 1, answer: 0, ice: 1 } })] }).join("\n");
    expect(l).toContain("המשא ומתן נעצר, לא ICE");
  });

  it("כשיש שגיאה מפורשת, לא מוסיפים ניחוש מעליה", () => {
    const l = diagLines({ ...base, peers: [peer({
      id: "you0", connection: "new", in: { offer: 1, answer: 0, ice: 0 },
      lastError: "offer: boom" })] }).join("\n");
    expect(l).not.toContain("המשא ומתן נעצר");
  });
});

describe("נוכחות בערוץ", () => {
  it("אומרת במפורש כשהצד השני לא מריץ וידאו", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"], peers: [peer({ id: "you0" })],
      stats: { sent: 2, failed: 0, received: 2, forMe: 0, online: ["me00"] } }).join("\n");
    expect(l).toContain("בערוץ עם וידאו: רק אני");
    expect(l).toContain("לא מריץ וידאו");
  });

  it("ולא מאשימה אותו כשהוא כן שם", () => {
    const l = diagLines({ selfId: "me00", wanted: ["you0"], peers: [peer({ id: "you0" })],
      stats: { sent: 2, failed: 0, received: 4, forMe: 2, online: ["me00", "you0"] } }).join("\n");
    expect(l).toContain("בערוץ עם וידאו: you0");
    expect(l).not.toContain("לא מריץ וידאו");
  });
});

it("שותק לגמרי על נוכחות של מי שההודעות שלו מגיעות", () => {
  // הכרזת נוכחות נחסמה במדיניות במשך ימים, ולכן היעדרה אינה עדות לכלום.
  // ההסקה ממנה שלחה לחפש "גרסה ישנה" שלא הייתה שם.
  const l = diagLines({ selfId: "me00", wanted: ["you0"],
    peers: [peer({ id: "you0", in: { offer: 1, answer: 0, ice: 1 } })],
    stats: { sent: 2, failed: 0, received: 4, forMe: 2, online: ["me00"] } }).join("\n");
  expect(l).not.toContain("לא מריץ וידאו");
  expect(l).not.toContain("נוכחות");
});

it("חיבור תקין עם מסלול ריק נאמר במפורש", () => {
  const l = diagLines({ selfId: "me00", wanted: ["you0"], peers: [peer({
    id: "you0", connection: "connected", stream: {} as MediaStream,
    video: { tracks: 1, live: true, muted: true } })] }).join("\n");
  expect(l).toContain("לא זורמים פריימים");
  expect(l).toContain("המצלמה שלו כבויה");
});

describe("שרתי הממסר", () => {
  const base = { selfId: "me", wanted: [], peers: [] };

  it("אומר כמה ממסרים פרטיים הגיעו מהשרת", () => {
    const l = diagLines({ ...base, ice: { privateCount: 1, publicCount: 4, reason: "ok" } });
    expect(l.some((x) => x.includes("1 פרטיים") && x.includes("4 ציבוריים"))).toBe(true);
  });

  it("מבדיל בין מפתחות חסרים לבין דחייה של קלאודפלייר", () => {
    const none = diagLines({ ...base, ice: { privateCount: 0, publicCount: 4, reason: "no_keys" } });
    expect(none.some((x) => x.includes("לא הוגדרו מפתחות"))).toBe(true);

    const denied = diagLines({ ...base, ice: { privateCount: 0, publicCount: 4, reason: "cf_401" } });
    expect(denied.some((x) => x.includes("קלאודפלייר דחה") && x.includes("401"))).toBe(true);
  });
});
