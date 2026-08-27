import { describe, expect, it } from "vitest";
import { explain } from "./Lobby";

describe("הסבר לשגיאות הצטרפות", () => {
  it("קוד מוכר מתורגם, בלי קוד גולמי מיותר", () => {
    const e = explain("ROOM_FULL");
    expect(e.text).toBe("החדר מלא");
    expect(e.raw).toBeUndefined();
  });

  it("מתג ההתחברות האנונימית מקבל הוראה מדויקת", () => {
    expect(explain("AUTH_ANON_DISABLED").text).toMatch(/Anonymous sign-ins/);
  });

  it("כשל רשת מפנה ל-ALLOWED_ORIGIN ושומר את הקוד", () => {
    const e = explain("NETWORK: Failed to send a request to the Edge Function");
    expect(e.hint).toMatch(/ALLOWED_ORIGIN/);
    expect(e.raw).toContain("Edge Function");
  });

  it("סטטוס HTTP נשמר לתצוגה", () => {
    expect(explain("HTTP_500: Internal").raw).toBe("HTTP_500: Internal");
  });

  // הנפילה האחרונה עדיין קיימת, אבל היא כבר לא בולעת את הקוד.
  it("קוד לא מוכר נשאר גלוי", () => {
    const e = explain("SOMETHING_NEW");
    expect(e.text).toBe("משהו השתבש. נסו שוב.");
    expect(e.raw).toBe("SOMETHING_NEW");
  });
});
