// export const ROWS = 31;
// export const COLS = 23;

export type Cell = "*" | "#" | "↓" | "→" | "↘";
export type GridCell = Cell | ".";

export type KnownTemplateTypeCode = "2" | "0" | "<" | "3" | "9" | "F";
export type TemplateTypeCode = KnownTemplateTypeCode | (string & {});
export type TemplateType =
  | "scanword"
  | "crossword"
  | "crossword_variant"
  | "chainword"
  | "honeycomb"
  | "circular"
  | "unknown";

export interface Grid {
  rows: number;
  cols: number;
  data: string[];
  marker: string;
  templateTypeCode?: TemplateTypeCode;
  templateType?: TemplateType;
  codes: number[][];
}

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
