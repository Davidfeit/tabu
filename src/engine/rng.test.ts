import { describe, it, expect } from "vitest";
import { rollDice, rollDie, shuffle } from "./rng";

describe("rollDie", () => {
  it("מחזיר תמיד 1–6", () => {
    for (let seq = 0; seq < 500; seq++) {
      for (const d of rollDice("seed-" + (seq % 7), seq)) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it("דטרמיניסטי: אותו זרע ואותו seq נותנים אותה תוצאה", () => {
    expect(rollDice("abc", 42)).toEqual(rollDice("abc", 42));
    expect(rollDice("abc", 42)).not.toEqual(rollDice("abd", 42));
    expect(rollDice("abc", 42)).not.toEqual(rollDice("abc", 43));
  });

  it("שתי הקוביות באותו גלגול אינן זהות זו לזו", () => {
    // אילו שתיהן נגזרו מאותו זרם, כל גלגול היה יוצא כפול.
    let doubles = 0;
    const N = 6000;
    for (let seq = 0; seq < N; seq++) {
      const [a, b] = rollDice("s", seq);
      if (a === b) doubles++;
    }
    // הצפי 1/6. סטיית תקן ~0.0048, אז ±4σ.
    expect(doubles / N).toBeGreaterThan(0.147);
    expect(doubles / N).toBeLessThan(0.186);
  });

  it("מתפלג אחיד — דגימת הדחייה מסירה את הטיית המודולו", () => {
    // byte % 6 מוטה ב-~0.5% לטובת 1–4, כי 256 לא מתחלק ב-6.
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const N = 60000;
    for (let seq = 0; seq < N; seq++) counts[rollDie("fair", seq, 0)]!++;
    const expected = N / 6;
    for (let face = 1; face <= 6; face++) {
      // χ² לכל פאה: ±4σ סביב הצפי
      const sigma = Math.sqrt(N * (1 / 6) * (5 / 6));
      expect(Math.abs(counts[face]! - expected)).toBeLessThan(4 * sigma);
    }
  });

  it("סכום שתי קוביות מתפלג כמו 2d6 — 7 הוא השכיח", () => {
    const sums = new Array(13).fill(0);
    const N = 30000;
    for (let seq = 0; seq < N; seq++) {
      const [a, b] = rollDice("dist", seq);
      sums[a + b]++;
    }
    const mode = sums.indexOf(Math.max(...sums));
    expect(mode).toBe(7);
    expect(sums[2]! / N).toBeLessThan(sums[7]! / N);
    expect(sums[12]! / N).toBeLessThan(sums[7]! / N);
  });
});

describe("shuffle", () => {
  const deck = [...Array(16).keys()];

  it("שומר על כל האיברים ולא משנה את הקלט", () => {
    const frozen = deck.slice();
    const out = shuffle(deck, "s", 0);
    expect(deck).toEqual(frozen);
    expect(out.slice().sort((a, b) => a - b)).toEqual(frozen);
  });

  it("דטרמיניסטי לפי זרע וזרם", () => {
    expect(shuffle(deck, "s", 0)).toEqual(shuffle(deck, "s", 0));
    expect(shuffle(deck, "s", 0)).not.toEqual(shuffle(deck, "s", 1));
  });

  it("באמת מערבב", () => {
    expect(shuffle(deck, "s", 0)).not.toEqual(deck);
  });

  it("מפזר כל קלף על פני כל המיקומים", () => {
    // ערבוב שבור נוטה להשאיר איברים קרוב למקומם המקורי.
    const positionsOfCardZero = new Set<number>();
    for (let s = 0; s < 400; s++) positionsOfCardZero.add(shuffle(deck, "s" + s, 0).indexOf(0));
    expect(positionsOfCardZero.size).toBe(16);
  });
});
