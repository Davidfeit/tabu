import { describe, expect, it, beforeEach, vi } from "vitest";
import { loadProfile, rememberRoom, saveProfile } from "@/net/profile";

/** localStorage אינו קיים ב-environment: node של vitest. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

beforeEach(() => { vi.stubGlobal("localStorage", fakeStorage()); });

describe("מי אני, לפעם הבאה", () => {
  it("שומר ומחזיר שם וחייל", () => {
    saveProfile({ name: "דנה", token: "scooter" });
    expect(loadProfile()).toEqual({ name: "דנה", token: "scooter", code: undefined });
  });

  it("בלי שם אין פרופיל — טופס ריק עדיף על שם ריק", () => {
    saveProfile({ name: "   ", token: "camel" });
    expect(loadProfile()).toBeNull();
  });

  it("זוכר את החדר האחרון בלי לדרוס את השם", () => {
    saveProfile({ name: "יואב", token: "boat" });
    rememberRoom("ABC123");
    const me = loadProfile()!;
    expect(me.name).toBe("יואב");
    expect(me.token).toBe("boat");
    expect(me.code).toBe("ABC123");
    expect(me.at).toBeGreaterThan(0);   // חותמת זמן, כדי שחדר יתיישן
  });

  it("שורד אחסון שבור, ולא מפיל את העמוד", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{{{", setItem: () => { throw new Error("full"); },
    });
    expect(loadProfile()).toBeNull();
    expect(() => saveProfile({ name: "א", token: "camel" })).not.toThrow();
  });
});

it("שוכח חדר בלי לשכוח שם", async () => {
  const { forgetRoom } = await import("@/net/profile");
  saveProfile({ name: "רן", token: "camel", code: "XYZ999", at: Date.now() });
  forgetRoom();
  const me = loadProfile()!;
  expect(me.name).toBe("רן");
  expect(me.code).toBeUndefined();
});

describe("חדר שמור מול חדר של אתמול", () => {
  it("קוד טרי מוחזר, וישן נשכח", async () => {
    const { freshRoom, ROOM_TTL_MS } = await import("@/net/profile");
    const now = 1_800_000_000_000;
    expect(freshRoom({ name: "א", token: "camel", code: "AB12", at: now - 60_000 }, now))
      .toBe("AB12");
    expect(freshRoom({ name: "א", token: "camel", code: "AB12",
                       at: now - ROOM_TTL_MS - 1 }, now)).toBeNull();
  });

  it("בלי חותמת זמן אין חזרה אוטומטית", async () => {
    const { freshRoom } = await import("@/net/profile");
    expect(freshRoom({ name: "א", token: "camel", code: "AB12" })).toBeNull();
  });
});
