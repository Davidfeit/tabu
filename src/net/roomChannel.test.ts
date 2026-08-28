import { it, expect, beforeEach } from "vitest";
import { _resetRoomChannels, roomChannel, type RealtimeLike } from "./roomChannel";

/**
 * ההתנהגות שנבדקת כאן היא בדיוק זו ש-supabase-js כופה: קריאה שנייה
 * ל-channel() עם אותו נושא מחזירה את *אותו* אובייקט. לכן שני צרכנים
 * חולקים ערוץ, וניתוק של אחד מהם היה מנתק גם את השני.
 */
function fake() {
  const created: string[] = [];
  const removed: unknown[] = [];
  const bindings: { event: string; cb: (p: { payload: unknown }) => void }[] = [];
  let joins = 0;
  let auths = 0;
  const byTopic = new Map<string, object>();

  const sb: RealtimeLike = {
    channel(topic: string) {
      const existing = byTopic.get(topic);
      if (existing) return existing as never;
      created.push(topic);
      const ch = {
        on(_t: string, f: unknown, cb: (p: { payload: unknown }) => void) {
          bindings.push({ event: (f as { event: string }).event, cb });
          return ch;
        },
        subscribe() { joins++; return ch; },
      };
      byTopic.set(topic, ch);
      return ch as never;
    },
    removeChannel(ch: unknown) {
      removed.push(ch);
      for (const [t, c] of byTopic) if (c === ch) byTopic.delete(t);
      return null;
    },
    setAuth: async () => { auths++; },
  };
  return { sb, created, removed, bindings, joins: () => joins, auths: () => auths };
}

beforeEach(_resetRoomChannels);

it("שני צרכנים מקבלים ערוץ אחד, והצטרפות אחת", async () => {
  const f = fake();
  const a = roomChannel(f.sb, "r1");
  const b = roomChannel(f.sb, "r1");
  await a.join();
  await b.join();
  expect(f.created).toEqual(["room:r1"]);
  expect(f.joins()).toBe(1);
  expect(f.auths()).toBe(1);   // הרשאות נקבעות פעם אחת, לפני ההצטרפות
  a.release(); b.release();
});

it("שחרור של צרכן אחד לא מנתק את השני", () => {
  const f = fake();
  const game = roomChannel(f.sb, "r2");
  const video = roomChannel(f.sb, "r2");
  video.release();
  expect(f.removed).toHaveLength(0);   // מצב המשחק עדיין מאזין
  game.release();
  expect(f.removed).toHaveLength(1);
});

it("שחרור כפול של אותה ידית אינו מפיל את הערוץ מוקדם", () => {
  const f = fake();
  const a = roomChannel(f.sb, "r3");
  const b = roomChannel(f.sb, "r3");
  a.release();
  a.release();                          // אותה ידית, פעמיים
  expect(f.removed).toHaveLength(0);
  b.release();
  expect(f.removed).toHaveLength(1);
});

it("האזנה נעצרת עם השחרור, גם אם הערוץ עצמו חי", () => {
  const f = fake();
  const a = roomChannel(f.sb, "r4");
  const b = roomChannel(f.sb, "r4");
  const gotA: unknown[] = [], gotB: unknown[] = [];
  a.on("move", (p) => gotA.push(p));
  b.on("signal", (p) => gotB.push(p));

  const fire = (event: string, payload: unknown) => {
    for (const x of f.bindings) if (x.event === event) x.cb({ payload });
  };
  fire("move", 1); fire("signal", 2);
  expect(gotA).toEqual([1]);
  expect(gotB).toEqual([2]);

  a.release();
  fire("move", 3); fire("signal", 4);
  expect(gotA).toEqual([1]);            // שוחרר — לא מקבל יותר
  expect(gotB).toEqual([2, 4]);         // וממשיך לעבוד לשני
  b.release();
});

it("אחרי שחרור מלא, חדר חדש מקבל ערוץ חדש", async () => {
  const f = fake();
  const a = roomChannel(f.sb, "r5");
  await a.join();
  a.release();
  const b = roomChannel(f.sb, "r5");
  await b.join();
  expect(f.created).toEqual(["room:r5", "room:r5"]);
  b.release();
});

it("מכריז על עצמו רק אחרי שההצטרפות אושרה", async () => {
  // track לפני SUBSCRIBED נבלע, והנוכחות נשארת ריקה בלי שום שגיאה.
  const tracked: Record<string, unknown>[] = [];
  let ack: ((s: string) => void) | undefined;
  const sb: RealtimeLike = {
    channel: () => ({
      on: () => null,
      subscribe: (cb?: (s: string) => void) => { ack = cb; return null; },
      track: (p: Record<string, unknown>) => { tracked.push(p); return null; },
      presenceState: () => ({}),
    }),
    removeChannel: () => null,
    setAuth: async () => {},
  };

  const h = roomChannel(sb, "r6");
  h.announce({ id: "me" });
  await h.join();
  expect(tracked).toHaveLength(0);      // עוד לא אושר
  ack!("SUBSCRIBED");
  expect(tracked).toEqual([{ id: "me" }]);
  h.release();
});

it("אוסף מזהי נוכחות מכל הכניסות", () => {
  const state = { k1: [{ id: "a" }], k2: [{ id: "b" }, { id: "a" }], k3: [{}] };
  let seen: string[] = [];
  let fire: (() => void) | undefined;
  const sb: RealtimeLike = {
    channel: () => ({
      on: (_t: string, f: unknown, cb: (p: { payload: unknown }) => void) => {
        if ((f as { event: string }).event === "sync") fire = () => cb({ payload: null });
        return null;
      },
      subscribe: () => null,
      presenceState: () => state,
    }),
    removeChannel: () => null,
  };
  const h = roomChannel(sb, "r7");
  h.onPresence((ids) => { seen = ids; });
  fire!();
  expect(seen).toEqual(["a", "b"]);     // בלי כפילויות, בלי כניסה בלי id
  h.release();
});
