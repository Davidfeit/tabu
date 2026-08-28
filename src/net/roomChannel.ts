/**
 * ערוץ החדר — בעלים אחד, כמה נמענים.
 *
 * שני חלקים באפליקציה מאזינים לאותו ערוץ: מצב המשחק (אירועי move)
 * וסיגנלינג הווידאו (אירועי signal). supabase-js מחזיר את *אותו* אובייקט
 * ערוץ לשני קוראים עם אותו נושא, ולכן removeChannel של אחד מהם מנתק גם
 * את השני — והתוצאה היא לוח שקפא או וידאו שנעלם, בלי שום שגיאה.
 *
 * כאן הערוץ נספר: כל צרכן מקבל ידית משלו, ההצטרפות קורית פעם אחת,
 * והניתוק בפועל רק כשהידית האחרונה שוחררה.
 */

export interface RawChannel {
  on: (type: string, filter: unknown, cb: (p: { payload: unknown }) => void) => unknown;
  subscribe: (cb?: (status: string) => void) => unknown;
  /** נוכחות: מי מחובר לערוץ עכשיו. */
  track?: (payload: Record<string, unknown>) => unknown;
  presenceState?: () => Record<string, Record<string, unknown>[]>;
}

export interface RealtimeLike {
  channel: (name: string, opts?: unknown) => RawChannel;
  removeChannel: (ch: RawChannel) => unknown;
  /** חובה לפני ערוץ פרטי: ההרשאות מחושבות מ-RLS בזמן ההצטרפות. */
  setAuth?: () => Promise<unknown>;
}

interface Entry {
  ch: RawChannel;
  refs: number;
  joining: Promise<void> | null;
  joined: boolean;
  /** מה להכריז על עצמנו ברגע שההצטרפות מסתיימת. */
  presence: Record<string, unknown> | null;
}

const open = new Map<string, Entry>();

export interface RoomChannelHandle {
  /** מאזין לאירוע. מתנתק אוטומטית עם release(). */
  on(event: string, cb: (payload: unknown) => void): void;
  /** מצטרף בפועל. אידמפוטנטי — הצרכן השני לא מצטרף שוב. */
  join(): Promise<void>;
  /** מכריז על עצמנו בערוץ. ניתן לקרוא לפני ההצטרפות. */
  announce(payload: Record<string, unknown>): void;
  /** מי מוכרז בערוץ עכשיו. */
  onPresence(cb: (ids: string[]) => void): void;
  release(): void;
}

function presentIds(state: Record<string, Record<string, unknown>[]>): string[] {
  const ids = new Set<string>();
  for (const entries of Object.values(state)) {
    for (const e of entries) if (typeof e.id === "string" && e.id) ids.add(e.id);
  }
  return [...ids];
}

export function roomChannel(sb: RealtimeLike, roomId: string): RoomChannelHandle {
  let entry = open.get(roomId);
  if (!entry) {
    // presence מופעל מראש ולא לפי קיום מאזין: המאזין נוסף רק כשהווידאו
    // עולה, כלומר לרוב אחרי ההצטרפות — ואז היה מאוחר מדי להפעיל אותו.
    entry = { ch: sb.channel(`room:${roomId}`,
                { config: { private: true, presence: { enabled: true } } }),
              refs: 0, joining: null, joined: false, presence: null };
    open.set(roomId, entry);
  }
  const e = entry;
  e.refs++;
  let live = true;

  return {
    on(event, cb) {
      // אין דרך ציבורית להסיר האזנה בודדת ב-supabase-js, ולכן הידית
      // מנטרלת את עצמה. הערוץ כולו נהרס ממילא כשהאחרון משחרר.
      e.ch.on("broadcast", { event }, ({ payload }) => { if (live) cb(payload); });
    },
    join() {
      e.joining ??= (async () => {
        await sb.setAuth?.();
        e.ch.subscribe((status?: string) => {
          if (status !== "SUBSCRIBED") return;
          e.joined = true;
          if (e.presence) void e.ch.track?.(e.presence);
        });
      })();
      return e.joining;
    },
    announce(payload) {
      e.presence = { ...e.presence, ...payload };
      if (e.joined) void e.ch.track?.(e.presence);
    },
    onPresence(cb) {
      e.ch.on("presence", { event: "sync" }, () => {
        if (live) cb(presentIds(e.ch.presenceState?.() ?? {}));
      });
    },
    release() {
      if (!live) return;
      live = false;
      if (--e.refs > 0) return;
      open.delete(roomId);
      sb.removeChannel(e.ch);
    },
  };
}

/** לטסטים בלבד. */
export function _resetRoomChannels(): void {
  open.clear();
}
