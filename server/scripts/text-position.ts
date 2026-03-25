const DEFAULT_CHAR_WIDTH_FACTOR = 0.62;

const CHAR_WIDTH_FACTOR_BY_CHAR: Record<string, number> = {
  A: 0.66,
  B: 0.62,
  C: 0.64,
  D: 0.68,
  E: 0.58,
  F: 0.56,
  G: 0.66,
  H: 0.64,
  I: 0.34,
  J: 0.52,
  K: 0.62,
  L: 0.56,
  M: 0.78,
  N: 0.64,
  O: 0.64,
  P: 0.62,
  Q: 0.68,
  R: 0.62,
  S: 0.6,
  T: 0.6,
  U: 0.64,
  V: 0.66,
  W: 0.9,
  X: 0.64,
  Y: 0.64,
  Z: 0.58,
  "\u0410": 0.66,
  "\u0411": 0.63,
  "\u0412": 0.62,
  "\u0413": 0.56,
  "\u0414": 0.68,
  "\u0415": 0.58,
  "\u0416": 0.86,
  "\u0417": 0.58,
  "\u0418": 0.64,
  "\u0419": 0.64,
  "\u041a": 0.62,
  "\u041b": 0.62,
  "\u041c": 0.78,
  "\u041d": 0.64,
  "\u041e": 0.64,
  "\u041f": 0.64,
  "\u0420": 0.62,
  "\u0421": 0.64,
  "\u0422": 0.6,
  "\u0423": 0.64,
  "\u0424": 0.74,
  "\u0425": 0.64,
  "\u0426": 0.66,
  "\u0427": 0.64,
  "\u0428": 0.88,
  "\u0429": 0.9,
  "\u042a": 0.66,
  "\u042b": 0.82,
  "\u042c": 0.6,
  "\u042d": 0.64,
  "\u042e": 0.88,
  "\u042f": 0.66,
};

export function estimateTextWidth(text: string, fontSize: number): number {
  const chars = [...text.trim()];
  if (!chars.length) return Math.max(1, fontSize * DEFAULT_CHAR_WIDTH_FACTOR);
  let width = 0;
  for (const char of chars) {
    const factor = CHAR_WIDTH_FACTOR_BY_CHAR[char.toUpperCase()] ?? DEFAULT_CHAR_WIDTH_FACTOR;
    width += fontSize * factor;
  }
  return Math.max(1, width);
}

export function resolveCenteredTextStartX(
  cellLeft: number,
  cellWidth: number,
  text: string,
  fontSize: number
): number {
  const textWidth = estimateTextWidth(text, fontSize);
  return cellLeft + Math.max(0, (cellWidth - textWidth) / 2);
}

