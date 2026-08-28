import { describe, expect, it } from "vitest";
import { inviteCode } from "./Lobby";

describe("קוד מקישור הזמנה", () => {
  it("קורא את הקוד מה-hash", () => {
    expect(inviteCode("#ABC123")).toBe("ABC123");
  });

  it("עובד גם בלי הסולמית ועם רווחים מהעתקה", () => {
    expect(inviteCode(" abc123 ")).toBe("ABC123");
  });

  it("מנרמל לאותיות גדולות — הקודים מונפקים כך", () => {
    expect(inviteCode("#ab2c9d")).toBe("AB2C9D");
  });

  it("כתובת בלי hash אינה הזמנה", () => {
    expect(inviteCode("")).toBeNull();
    expect(inviteCode("#")).toBeNull();
  });

  // hash משמש גם לניווט רגיל; אסור שכל עוגן ייראה כהזמנה ויחסום את
  // האפשרות לפתוח חדר חדש.
  it("עוגן שאינו קוד חדר נדחה", () => {
    expect(inviteCode("#section-two")).toBeNull();
    expect(inviteCode("#ab")).toBeNull();
    expect(inviteCode("#ABCDEFGHI")).toBeNull();
    expect(inviteCode("#ABC-123")).toBeNull();
  });
});
