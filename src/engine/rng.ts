/**
 * הגרלות דטרמיניסטיות.
 *
 * ── למה לא random() ──
 * ‎random()‎ של Postgres ו-‎Math.random()‎ הם PRNG דטרמיניסטיים עם זרע ניתן
 * לניחוש. במשחק שכל תוכנו כסף, זו לא בעיה תיאורטית.
 *
 * ── provably fair ──
 * הזרע נוצר בשרת ב-CSPRNG. ‎sha256(seed)‎ מתפרסם בפתיחת המשחק, הזרע עצמו
 * נחשף רק בסיום — ואז כל אחד יכול לשחזר כל גלגול. commit-reveal מלא אינו
 * נדרש (מודל האיום שלו הוא שרת לא ישר), אבל זה עולה עשרים שורות.
 *
 * ── הטיית מודולו ──
 * ‎byte % 6‎ מוטה ב-~0.5% לטובת 1–4, כי 256 לא מתחלק ב-6. דגימת דחייה על
 * ערכים ≥ 252 מסירה את ההטיה לחלוטין.
 */

/** ערבול 32 ביט. FNV-1a על המחרוזת, ואז xorshift על המונה. */
function hash32(seed: string, counter: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= counter;
  h = Math.imul(h, 0x01000193) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x3f1d0b21) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** בית פסאודו-אקראי מהזרם (seed, seq, draw). */
function byteAt(seed: string, seq: number, draw: number): number {
  return hash32(seed, seq * 0x10000 + draw) & 0xff;
}

/**
 * קוביה הוגנת 1–6 מהזרם, בדגימת דחייה.
 * `draw` מבדיל בין הקוביות באותו גלגול, ובין גלגולים חוזרים באותו seq.
 */
export function rollDie(seed: string, seq: number, draw: number): number {
  for (let attempt = 0; attempt < 64; attempt++) {
    const b = byteAt(seed, seq, draw * 64 + attempt);
    if (b < 252) return (b % 6) + 1;   // 252 = 6 × 42, ולכן ללא הטיה
  }
  /* c8 ignore next -- הסתברות ~10^-77 */
  return (byteAt(seed, seq, draw * 64 + 63) % 6) + 1;
}

export function rollDice(seed: string, seq: number): [number, number] {
  return [rollDie(seed, seq, 0), rollDie(seed, seq, 1)];
}

/**
 * ערבוב Fisher–Yates דטרמיניסטי. משמש לחפיסות ולסדר התורות ההתחלתי.
 * לא משנה את הקלט.
 */
export function shuffle<T>(items: readonly T[], seed: string, stream: number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    // דגימת דחייה גם כאן: היקף הבחירה משתנה בכל צעד.
    const bound = i + 1;
    const limit = Math.floor(256 / bound) * bound;
    let j = 0;
    for (let attempt = 0; attempt < 64; attempt++) {
      const b = byteAt(seed, stream, i * 64 + attempt);
      if (b < limit) { j = b % bound; break; }
    }
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
