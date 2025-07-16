export const ROWS = 31;
export const COLS = 23;

export type Cell = "*" | "#" | "↓" | "→" | "↘";
export type GridCell = Cell | ".";

export const DIRS = {
  down:  { dr: 1, dc: 0 },
  right: { dr: 0, dc: 1 },
} as const;

export interface Slot {
  id: number;
  r: number;
  c: number;
  dir: typeof DIRS[keyof typeof DIRS];
  len: number;
  cells: [number, number][];
}
