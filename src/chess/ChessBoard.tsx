import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { isPromotion, targets } from "./reduce";
import type { ChessColor, ChessState, Promotion } from "./types";

/**
 * הלוח.
 *
 * ── למה SVG ולא רשת של div-ים ──
 * הלוח חייב להתאים לכל מסך — מרכז מסך רחב, או רוחב טלפון — והכלים חייבים
 * לגדול איתו. ב-HTML זה אומר גודל גופן שנגזר מרוחב המכולה, וזה שביר.
 * ‏viewBox של 8×8 פותר את זה במשפט אחד: כל מה שמצויר ביחידות של משבצת
 * נמתח עם הלוח, כולל הטקסט.
 *
 * ── הכלים ──
 * תווי היוניקוד המלאים (♟♞♝♜♛♚) לשני הצדדים, וצבע דרך fill/stroke: הלבן
 * לבן עם קו כהה, השחור כהה. התווים "החלולים" לכלים לבנים נראים דקים
 * ולא אחידים בין גופנים, ובסגנון צעצוע רוצים גוף מלא. ‏VS15 (‎︎‎)
 * מבקש הצגה כטקסט ולא כאימוג'י — בלעדיו iOS מצייר רגלי שחור כאימוג'י.
 */

const GLYPH: Record<string, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const FONT = '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", sans-serif';

interface Cell { square: string; piece: { type: string; color: ChessColor } | null }

/** 64 משבצות בסדר ציור, לפי הכיוון: הצד שלי למטה. */
function cells(fen: string, bottom: ChessColor): Cell[][] {
  const board = new Chess(fen).board();   // שורה 0 = דרגה 8
  const rows = board.map((row, r) => row.map((sq, f) => ({
    square: `${FILES[f]}${8 - r}`,
    piece: sq ? { type: sq.type, color: sq.color } : null,
  })));
  return bottom === "w" ? rows : rows.map((row) => [...row].reverse()).reverse();
}

export function ChessBoard({ state, bottom, myColor, canMove, onMove }: {
  state: ChessState;
  /** איזה צבע בתחתית הלוח. */
  bottom: ChessColor;
  /** את הכלים של מי אני מזיז. */
  myColor: ChessColor | null;
  canMove: boolean;
  onMove: (from: string, to: string, promotion?: Promotion) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);

  const grid = useMemo(() => cells(state.fen, bottom), [state.fen, bottom]);
  const legal = useMemo(
    () => (selected ? new Set(targets(state, selected)) : new Set<string>()),
    [state, selected]);

  // המלך המאוים, כדי לצבוע אותו.
  const kingInCheck = useMemo(() => {
    if (!state.check) return null;
    const c = new Chess(state.fen);
    for (const row of c.board()) for (const sq of row) {
      if (sq && sq.type === "k" && sq.color === c.turn()) return sq.square;
    }
    return null;
  }, [state.fen, state.check]);

  const pieceAt = (sq: string) => new Chess(state.fen).get(sq as Square) ?? null;

  function tap(square: string) {
    if (!canMove || state.phase !== "playing") return;
    if (selected && legal.has(square)) {
      if (isPromotion(state, selected, square)) { setPromo({ from: selected, to: square }); return; }
      onMove(selected, square);
      setSelected(null);
      return;
    }
    const p = pieceAt(square);
    // בוחרים רק כלי משלי; לחיצה על ריק או על היריב מנקה.
    setSelected(p && p.color === myColor && square !== selected ? square : null);
  }

  const last = state.lastMove;

  return (
    <div className="relative h-full w-full select-none" dir="ltr">
      <svg viewBox="-0.35 -0.35 8.7 8.7" className="h-full w-full"
           role="grid" aria-label="לוח שחמט"
           style={{ fontFamily: FONT }}>
        {/* מסגרת עץ־צעצוע */}
        <rect x="-0.35" y="-0.35" width="8.7" height="8.7" rx="0.35"
              fill="#8a5a3c" stroke="#fff" strokeWidth="0.08" />
        <rect x="-0.35" y="-0.35" width="8.7" height="8.7" rx="0.35"
              fill="none" stroke="#5d3a24" strokeWidth="0.04" />

        {grid.map((row, r) => row.map((cell, f) => {
          const dark = (r + f) % 2 === 1;
          const isLast = last !== null && (last.from === cell.square || last.to === cell.square);
          const isSel = selected === cell.square;
          const isTarget = legal.has(cell.square);
          const isCheck = kingInCheck === cell.square;
          const mine = cell.piece?.color === myColor;
          return (
            <g key={cell.square} onClick={() => tap(cell.square)} role="gridcell"
               aria-label={cell.square}
               style={{ cursor: canMove && (mine || isTarget) ? "pointer" : "default" }}>
              <rect x={f} y={r} width="1" height="1"
                    fill={dark ? "#b98a5e" : "#f6e7c8"} />
              {isLast && <rect x={f} y={r} width="1" height="1" fill="#ffc23c" opacity="0.38" />}
              {isCheck && <rect x={f} y={r} width="1" height="1" fill="#ef4b4b" opacity="0.55" />}
              {isSel && (
                <rect x={f + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.12"
                      fill="none" stroke="#ffb62e" strokeWidth="0.09" />
              )}
              {cell.piece && (
                <text x={f + 0.5} y={r + 0.5} textAnchor="middle" dominantBaseline="central"
                      fontSize="0.82" dy="0.04"
                      fill={cell.piece.color === "w" ? "#ffffff" : "#2b2340"}
                      stroke={cell.piece.color === "w" ? "#3b2f5c" : "#14101f"}
                      strokeWidth={cell.piece.color === "w" ? 0.05 : 0.025}
                      style={{ paintOrder: "stroke" }}>
                  {GLYPH[cell.piece.type]}{"︎"}
                </text>
              )}
              {isTarget && (cell.piece
                ? <circle cx={f + 0.5} cy={r + 0.5} r="0.42" fill="none"
                          stroke="#7c3aed" strokeWidth="0.09" opacity="0.8" />
                : <circle cx={f + 0.5} cy={r + 0.5} r="0.15" fill="#7c3aed" opacity="0.75" />)}
            </g>
          );
        }))}

        {/* קואורדינטות על המסגרת */}
        {grid[0]!.map((cell, f) => (
          <text key={`f${f}`} x={f + 0.5} y="8.2" textAnchor="middle" fontSize="0.22"
                fill="#f6e7c8" fontFamily="system-ui, sans-serif">{cell.square[0]}</text>
        ))}
        {grid.map((row, r) => (
          <text key={`r${r}`} x="-0.18" y={r + 0.55} textAnchor="middle" fontSize="0.22"
                fill="#f6e7c8" fontFamily="system-ui, sans-serif">{row[0]!.square[1]}</text>
        ))}
      </svg>

      {promo && (
        <div dir="rtl" role="dialog" aria-label="בחירת כלי לקידום"
             className="absolute inset-0 flex items-center justify-center bg-black/35">
          <div className="toy-modal flex items-center gap-2 p-3">
            <span className="text-sm font-bold text-ink">לקדם ל־</span>
            {(["q", "r", "b", "n"] as Promotion[]).map((p) => (
              <button key={p} onClick={() => { onMove(promo.from, promo.to, p); setPromo(null); setSelected(null); }}
                      className="toy-btn !h-12 !w-12 !p-0 !text-3xl" aria-label={p}
                      style={{ fontFamily: FONT }}>
                {GLYPH[p]}{"︎"}
              </button>
            ))}
            <button onClick={() => setPromo(null)} className="text-[0.75rem] text-ink/50 underline">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
