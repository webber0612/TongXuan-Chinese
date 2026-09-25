/** Minimum independent traces grow with repeat mistakes and stop at a small cap. */
export function adaptiveWritingTarget(mistakes: number): number {
  const safeMistakes = Number.isFinite(mistakes) ? Math.max(0, Math.floor(mistakes)) : 0;
  return Math.min(8, 3 + Math.floor(safeMistakes / 3));
}
