export const ROWS = 31;
export const COLS = 23;

export type Cell = "*" | "#" | "↓" | "→" | "↘";
export type Dir = { dr: number; dc: number };

export const DIRS = {
  down: { dr: 1, dc: 0 },
  right: { dr: 0, dc: 1 },
  diag: { dr: 1, dc: 1 },
} as const;

export interface Slot {
  id: number;
  r: number; // start row
  c: number; // start col
  dir: Dir;
  len: number;
  cells: [number, number][];
}
