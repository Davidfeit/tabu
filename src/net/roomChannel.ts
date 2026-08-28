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
  subscribe: () => unknown;
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
}

const open = new Map<string, Entry>();

export interface RoomChannelHandle {
  /** מאזין לאירוע. מתנתק אוטומטית עם release(). */
  on(event: string, cb: (payload: unknown) => void): void;
  /** מצטרף בפועל. אידמפוטנטי — הצרכן השני לא מצטרף שוב. */
  join(): Promise<void>;
  release(): void;
}

export function roomChannel(sb: RealtimeLike, roomId: string): RoomChannelHandle {
  let entry = open.get(roomId);
  if (!entry) {
    entry = { ch: sb.channel(`room:${roomId}`, { config: { private: true } }),
              refs: 0, joining: null };
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
        e.ch.subscribe();
      })();
      return e.joining;
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
