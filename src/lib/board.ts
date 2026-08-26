import raw from "../../data/board.json";
import type { BoardData, Group, GroupKey, Square } from "./types";

export const BOARD = raw as unknown as BoardData;

export const SQUARES: Square[] = BOARD.board;
export const GROUPS: Group[] = BOARD.groups;

const groupIndex = new Map<GroupKey, Group>(GROUPS.map((g) => [g.key, g]));

export function group(key: GroupKey): Group {
  const g = groupIndex.get(key);
  if (!g) throw new Error(`קבוצת צבע לא מוכרת: ${key}`);
  return g;
}

export function squareAt(pos: number): Square {
  const sq = SQUARES[pos];
  if (!sq) throw new Error(`אין משבצת במיקום ${pos}`);
  return sq;
}
