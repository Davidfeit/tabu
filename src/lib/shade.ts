/**
 * גוני צבע לצללית ולהדגשה.
 *
 * חייל תלת-ממדי צריך שלושה גוונים מאותו צבע בסיס — מואר, בסיס, מוצל —
 * ולא שלושה צבעים שנבחרו ביד. גזירה מהצבע שומרת על זהות המושב.
 */

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (rgb: number[]) =>
  "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

/** מבהיר לכיוון לבן. amount בין 0 ל-1. */
export function lighten(hex: string, amount: number): string {
  const rgb = parse(hex);
  return toHex(rgb.map((c) => c + (255 - c) * amount));
}

/** מכהה לכיוון שחור. amount בין 0 ל-1. */
export function darken(hex: string, amount: number): string {
  const rgb = parse(hex);
  return toHex(rgb.map((c) => c * (1 - amount)));
}

/** בהירות נתפסת, 0–1. קובע אם טקסט מעל הצבע צריך להיות כהה או בהיר. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? "#1a1a1a" : "#ffffff";
}
