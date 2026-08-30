import { describe, expect, it } from "vitest";

// הפונקציה עצמה, לא שכפול שלה: בדיקה שמעתיקה את הלוגיקה מאמתת את ההעתק.
import { describeConfig as problem } from "./supabase";

const REAL_URL = "https://bqpbiqfarsaayuscspzv.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig-part_1";

describe("אבחון הגדרת Supabase", () => {
  it("ערכים אמיתיים עוברים", () => expect(problem(REAL_URL, REAL_KEY)).toBeNull());
  it("סיומת נטייה בכתובת מותרת", () =>
    expect(problem(REAL_URL + "/", REAL_KEY)).toBeNull());
  it("רווחים מההדבקה לא פוסלים", () =>
    expect(problem(` ${REAL_URL} `, ` ${REAL_KEY}\n`)).toBeNull());

  it("בנייה ישנה — שניהם חסרים", () =>
    expect(problem(undefined, undefined)).toBe("שני המשתנים לא הגיעו לבנייה"));
  it("שגיאת כתיב בשם — רק אחד חסר", () =>
    expect(problem(REAL_URL, undefined)).toMatch(/ANON_KEY לא הגיע/));
  it("מחרוזת ריקה נחשבת חסרה", () =>
    expect(problem("", REAL_KEY)).toMatch(/URL לא הגיע/));

  // ה-placeholders ש-Vercel שאבה מ-.env.example: שניהם לא ריקים, ולכן
  // בדיקת "קיים" לבדה הייתה מאשרת אותם והחיבור היה נכשל בזמן ריצה.
  it("placeholder של כתובת נפסל", () =>
    expect(problem("https://xxxxxxxxxxxx.supabase.co", REAL_KEY))
      .toMatch(/אינו כתובת פרויקט תקינה/));
  it("placeholder של מפתח נפסל", () =>
    expect(problem(REAL_URL, "eyJhbGciOi...")).toMatch(/אינו JWT תקין/));
  it("כתובת של פרויקט אחר לגמרי נפסלת", () =>
    expect(problem("https://example.com", REAL_KEY)).toMatch(/אינו כתובת/));
});

describe("שרתי ICE", () => {
  it("כוללים ממסר גם כשאין הגדרת שרת", async () => {
    // ההנחה ש"רוב החיבורים יסתדרו ישירות" נבדקה ונפלה: בלי ממסר
    // ICE נתקע ב-connecting, ואין וידאו בכלל.
    const { iceServers } = await import("./supabase");
    const list = await iceServers();
    const urls = list.flatMap((s) =>
      typeof s.urls === "string" ? [s.urls] : s.urls);
    expect(urls.some((u) => u.startsWith("stun:"))).toBe(true);
    expect(urls.some((u) => u.startsWith("turn:"))).toBe(true);
    // גם מסלול TCP/443, שעובר ברשתות שחוסמות UDP.
    expect(urls.some((u) => u.includes("transport=tcp"))).toBe(true);
  });
});
