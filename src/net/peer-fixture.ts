import type { PeerState } from "./mesh";

/** עמית לדוגמה לבדיקות: רק מה שהבדיקה מתעניינת בו נכתב במפורש. */
export const fakePeer = (p: Partial<PeerState> & { id: string }): PeerState => ({
  stream: null, connection: "new", relayed: false, signaling: "stable",
  polite: false, in: { offer: 0, answer: 0, ice: 0 },
  out: { offer: 0, answer: 0, ice: 0 }, iceDropped: 0, lastError: null,
  video: { tracks: 1, live: true, muted: false }, ...p,
});
