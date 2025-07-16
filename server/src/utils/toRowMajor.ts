import { Cell } from "./parseFsh";

/** column-major (string[]) ⇒ row-major (Cell[][]) */
export function toRowMajor(col: string[]): Cell[][] {
  const rows = col[0].length;
  const cols = col.length;
  const rm: Cell[][] = Array.from({ length: rows }, () => Array(cols) as Cell[]);
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      rm[r][c] = col[c][r] as Cell;
  return rm;
}
