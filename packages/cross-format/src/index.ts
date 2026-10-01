export type Cell = "*" | "#" | "%" | "↓" | "→" | "↘";
export type GridCell = Cell | ".";

export type KnownTemplateTypeCode = "S" | "2" | "0" | "<" | "3" | "9" | "F";
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
  formatVersion?: 1 | 2;
  templateTypeCode?: TemplateTypeCode;
  templateType?: TemplateType;
  codes: number[][];
}

export const DIRS = {
  down: { dr: 1, dc: 0 },
  right: { dr: 0, dc: 1 },
} as const;

export interface Slot {
  id: number;
  r: number;
  c: number;
  dir: (typeof DIRS)[keyof typeof DIRS];
  len: number;
  cells: [number, number][];
}

export type ArrowDirection = "down" | "right";
export type ArrowEntry = { cluePos: number; dirKey: number };

export const CLUE_MAP: Readonly<Record<number, readonly ArrowEntry[]>> = {
  0x01: [{ cluePos: 2, dirKey: 8 }],
  0x02: [{ cluePos: 1, dirKey: 8 }],
  0x03: [{ cluePos: 4, dirKey: 8 }],
  0x04: [{ cluePos: 7, dirKey: 8 }],
  0x05: [{ cluePos: 9, dirKey: 8 }],
  0x06: [{ cluePos: 6, dirKey: 8 }],
  0x07: [{ cluePos: 3, dirKey: 8 }],
  0x08: [{ cluePos: 2, dirKey: 6 }],
  0x0a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 2, dirKey: 6 }],
  0x0b: [{ cluePos: 2, dirKey: 6 }, { cluePos: 4, dirKey: 8 }],
  0x0d: [{ cluePos: 2, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x10: [{ cluePos: 1, dirKey: 6 }],
  0x11: [{ cluePos: 2, dirKey: 8 }, { cluePos: 1, dirKey: 6 }],
  0x13: [{ cluePos: 1, dirKey: 6 }, { cluePos: 4, dirKey: 8 }],
  0x15: [{ cluePos: 1, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x18: [{ cluePos: 4, dirKey: 6 }],
  0x19: [{ cluePos: 2, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1c: [{ cluePos: 4, dirKey: 6 }, { cluePos: 7, dirKey: 8 }],
  0x1d: [{ cluePos: 4, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x20: [{ cluePos: 7, dirKey: 6 }],
  0x21: [{ cluePos: 2, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x23: [{ cluePos: 4, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x28: [{ cluePos: 9, dirKey: 6 }],
  0x29: [{ cluePos: 2, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x2a: [{ cluePos: 3, dirKey: 2 }, { cluePos: 7, dirKey: 6 }],
  0x2b: [{ cluePos: 4, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x2c: [{ cluePos: 7, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x30: [{ cluePos: 8, dirKey: 6 }],
  0x38: [{ cluePos: 3, dirKey: 6 }],
  0x39: [{ cluePos: 2, dirKey: 8 }, { cluePos: 3, dirKey: 6 }],
  0x3d: [{ cluePos: 3, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
};

export const CLUE_POSITION_OFFSETS: Readonly<Record<number, readonly [number, number]>> = {
  1: [-1, -1], 2: [-1, 0], 3: [-1, 1],
  4: [0, -1], 5: [0, 0], 6: [0, 1],
  7: [1, -1], 8: [1, 0], 9: [1, 1],
};

const HEADER = new TextEncoder().encode("SHABLON  ");
const DOWN_CODES = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
const RIGHT_CODES = new Set([0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38]);
const DOUBLE_CODES = new Set([0x07, 0x0a, 0x0b, 0x0d, 0x11, 0x13, 0x15, 0x19, 0x1a, 0x1c, 0x1d, 0x21, 0x23, 0x29, 0x2a, 0x2b, 0x2c, 0x2f, 0x39, 0x3d]);

function equalsPrefix(buf: Uint8Array, prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) return false;
  return prefix.every((value, index) => buf[index] === value);
}

function resolveType(code: string): { templateType: TemplateType; supported: boolean; formatVersion: 1 | 2 } {
  if (code === "S") return { templateType: "scanword", supported: true, formatVersion: 2 };
  const legacy: Record<string, { templateType: TemplateType; supported: boolean }> = {
    "2": { templateType: "scanword", supported: true },
    "0": { templateType: "crossword", supported: true },
    "<": { templateType: "crossword_variant", supported: true },
    "3": { templateType: "chainword", supported: false },
    "9": { templateType: "honeycomb", supported: false },
    F: { templateType: "circular", supported: false },
  };
  const result = legacy[code] ?? { templateType: "unknown" as const, supported: true };
  return { ...result, formatVersion: 1 };
}

function readCell(buf: Uint8Array, index: number): [Cell, number, number] {
  const byte = buf[index];
  if (byte === 0x01) return ["*", index + 1, byte];
  if (byte === 0x02) return ["#", index + 1, byte];
  if (byte === 0x25) return ["%", index + 1, byte];
  if (byte !== 0x04) throw new Error(`unexpected byte 0x${byte?.toString(16) ?? "??"} at ${index}`);
  const code = buf[index + 1];
  if (DOWN_CODES.has(code)) return ["↓", index + 2, code];
  if (RIGHT_CODES.has(code)) return ["→", index + 2, code];
  if (DOUBLE_CODES.has(code)) return ["↘", index + 2, code];
  throw new Error(`unknown direction byte 0x${code?.toString(16) ?? "??"}`);
}

export function parseFshBytes(input: Uint8Array | ArrayBuffer): Grid {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!equalsPrefix(buf, HEADER)) throw new Error("file is not SHABLON format");
  if (buf.length < HEADER.length + 3) throw new Error("truncated FSH marker");
  const markerBytes = buf.subarray(HEADER.length, HEADER.length + 3);
  const typeCode = String.fromCharCode(markerBytes[0]);
  const cols = markerBytes[1] - 0x30;
  const rows = markerBytes[2] - 0x30;
  const marker = String.fromCharCode(...markerBytes);
  const { templateType, supported, formatVersion } = resolveType(typeCode);
  if (!supported) throw new Error(`unsupported template type '${typeCode}' in marker '${marker}'`);
  if (cols <= 0 || rows <= 0 || cols > 207 || rows > 207) throw new Error(`bad dimensions in marker '${marker}': ${cols}×${rows}`);

  let index = HEADER.length + 3;
  const data: Cell[][] = Array.from({ length: rows }, () => Array<Cell>(cols).fill("*"));
  const codes = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const [cell, nextIndex, code] = readCell(buf, index);
      if (cell === "%" && formatVersion !== 2) throw new Error("cutout byte is only valid in SXY templates");
      data[row][col] = cell;
      codes[row][col] = code;
      index = nextIndex;
    }
  }
  return { rows, cols, marker, formatVersion, templateTypeCode: typeCode, templateType, data: data.map((row) => row.join("")), codes };
}

export function markerFor(rows: number, cols: number, formatVersion: 1 | 2 = 2): string {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 207 || cols > 207) {
    throw new Error(`invalid grid dimensions ${cols}×${rows}`);
  }
  return `${formatVersion === 2 ? "S" : "2"}${String.fromCharCode(0x30 + cols)}${String.fromCharCode(0x30 + rows)}`;
}

export function buildFsh(grid: Grid): Uint8Array {
  validate(grid);
  const marker = grid.marker || markerFor(grid.rows, grid.cols, grid.formatVersion ?? 2);
  const version = marker[0] === "S" ? 2 : 1;
  const bytes = [...HEADER, ...Array.from(marker, (character) => character.charCodeAt(0))];
  for (let col = 0; col < grid.cols; col += 1) {
    for (let row = 0; row < grid.rows; row += 1) {
      const cell = grid.data[row][col] as Cell;
      if (cell === "*") bytes.push(0x01);
      else if (cell === "#") bytes.push(0x02);
      else if (cell === "%") {
        if (version !== 2) throw new Error("legacy FSH cannot encode cutouts");
        bytes.push(0x25);
      } else {
        const code = grid.codes[row]?.[col];
        if (!DOWN_CODES.has(code) && !RIGHT_CODES.has(code) && !DOUBLE_CODES.has(code)) throw new Error(`unsupported arrow code 0x${code?.toString(16) ?? "??"} at ${row},${col}`);
        bytes.push(0x04, code);
      }
    }
  }
  return Uint8Array.from(bytes);
}

const ALLOWED = new Set<Cell>(["*", "#", "%", "↓", "→", "↘"]);
const isBarrier = (cell: Cell): boolean => cell === "#" || cell === "%";
type Dir = (typeof DIRS)[keyof typeof DIRS];

export function validate(grid: Grid): void {
  if (grid.data.length !== grid.rows) throw new Error(`bad row count: ${grid.data.length} (expect ${grid.rows})`);
  if (grid.codes.length !== grid.rows) throw new Error(`bad code row count: ${grid.codes.length} (expect ${grid.rows})`);
  grid.data.forEach((row, index) => {
    if (row.length !== grid.cols) throw new Error(`row ${index} length ${row.length} (expect ${grid.cols})`);
    if (grid.codes[index]?.length !== grid.cols) throw new Error(`code row ${index} length ${grid.codes[index]?.length ?? 0} (expect ${grid.cols})`);
    for (const cell of row) if (!ALLOWED.has(cell as Cell)) throw new Error(`invalid char '${cell}' in row ${index}`);
  });
}

export type SlotDirName = "down" | "right";
export type SlotScanMode = "arrow" | "classic";
export type SlotScanModeOption = SlotScanMode | "auto";
export type SlotStart = { number: number; r: number; c: number; dir: SlotDirName; slotId: number };
export type ScanSlotsDetailedOptions = { mode?: SlotScanModeOption; minLen?: number; preferRightOnDualStart?: boolean };
export type ScanSlotsDetailedResult = { mode: SlotScanMode; slots: Slot[]; starts: SlotStart[]; startNumberBySlotId: Map<number, number>; numberGrid: number[][] };

const directionsFor = (cell: Cell): Dir[] => cell === "↓" ? [DIRS.down] : cell === "→" ? [DIRS.right] : cell === "↘" ? [DIRS.down, DIRS.right] : [];
const directionName = (dir: Dir): SlotDirName => dir === DIRS.right ? "right" : "down";

function trace(grid: Grid, row: number, col: number, dir: Dir): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = row, c = col; r >= 0 && c >= 0 && r < grid.rows && c < grid.cols && !isBarrier(grid.data[r][c] as Cell); r += dir.dr, c += dir.dc) cells.push([r, c]);
  return cells;
}

function scanArrowSlots(grid: Grid, minLen: number): Slot[] {
  const slots: Slot[] = [];
  for (let r = 0; r < grid.rows; r += 1) for (let c = 0; c < grid.cols; c += 1) {
    for (const dir of directionsFor(grid.data[r][c] as Cell)) {
      const previous = dir === DIRS.right ? (c === 0 ? null : grid.data[r][c - 1]) : (r === 0 ? null : grid.data[r - 1][c]);
      if (previous != null && !isBarrier(previous as Cell)) continue;
      const cells = trace(grid, r, c, dir);
      if (cells.length >= minLen) slots.push({ id: slots.length, r, c, dir, len: cells.length, cells });
    }
  }
  return slots;
}

function scanClassicSlots(grid: Grid, minLen: number, preferRight: boolean): Slot[] {
  const slots: Slot[] = [];
  for (let r = 0; r < grid.rows; r += 1) for (let c = 0; c < grid.cols; c += 1) {
    const cell = grid.data[r][c] as Cell;
    if (isBarrier(cell)) continue;
    const right = (c === 0 || isBarrier(grid.data[r][c - 1] as Cell)) && c + 1 < grid.cols && !isBarrier(grid.data[r][c + 1] as Cell);
    const down = (r === 0 || isBarrier(grid.data[r - 1][c] as Cell)) && r + 1 < grid.rows && !isBarrier(grid.data[r + 1][c] as Cell);
    const dirs: Dir[] = right ? [DIRS.right] : [];
    if (down && !(preferRight && right)) dirs.push(DIRS.down);
    for (const dir of dirs) {
      const cells = trace(grid, r, c, dir);
      if (cells.length >= minLen) slots.push({ id: slots.length, r, c, dir, len: cells.length, cells });
    }
  }
  return slots;
}

export function scanSlotsDetailed(grid: Grid, options: ScanSlotsDetailedOptions = {}): ScanSlotsDetailedResult {
  validate(grid);
  const hasArrow = grid.data.some((row) => /[↓→↘]/u.test(row));
  const mode = options.mode === "arrow" || options.mode === "classic" ? options.mode : hasArrow ? "arrow" : "classic";
  const minLen = Math.max(2, Math.trunc(options.minLen ?? 2));
  const slots = mode === "arrow" ? scanArrowSlots(grid, minLen) : scanClassicSlots(grid, minLen, options.preferRightOnDualStart ?? false);
  const numberGrid = Array.from({ length: grid.rows }, () => Array<number>(grid.cols).fill(0));
  const orderedStarts = [...new Set(slots.map((slot) => `${slot.r},${slot.c}`))]
    .map((key) => key.split(",").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberByCell = new Map(orderedStarts.map(([r, c], index) => [`${r},${c}`, index + 1]));
  for (const [key, number] of numberByCell) { const [r, c] = key.split(",").map(Number); numberGrid[r][c] = number; }
  const startNumberBySlotId = new Map<number, number>();
  const starts = slots.map((slot) => {
    const number = numberByCell.get(`${slot.r},${slot.c}`) ?? 0;
    startNumberBySlotId.set(slot.id, number);
    return { number, r: slot.r, c: slot.c, dir: directionName(slot.dir), slotId: slot.id };
  });
  return { mode, slots, starts, startNumberBySlotId, numberGrid };
}

export class SlotCoverageError extends Error {
  readonly cells: [number, number][];

  constructor(cells: [number, number][]) {
    super(`Letter cells do not belong to any word: ${cells.map(([row, col]) => `(${row + 1},${col + 1})`).join(", ")}`);
    this.name = "SlotCoverageError";
    this.cells = cells;
  }
}

/** Check coverage using the same slots that will be sent to the solver. */
export function validateSlotCoverage(grid: Grid, slots: readonly Slot[]): void {
  const covered = new Set(slots.flatMap((slot) => slot.cells.map(([row, col]) => row * grid.cols + col)));
  const cells: [number, number][] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const cell = grid.data[row][col];
      if (cell !== "#" && cell !== "%" && !covered.has(row * grid.cols + col)) cells.push([row, col]);
    }
  }
  if (cells.length) throw new SlotCoverageError(cells);
}

export function scanSlots(grid: Grid): Slot[] { return scanSlotsDetailed(grid).slots; }
export function lengthStats(slots: readonly Slot[]): Record<string, number> {
  const stats: Record<string, number> = { total: slots.length };
  for (const slot of slots) stats[slot.len] = (stats[slot.len] ?? 0) + 1;
  return stats;
}

export function findArrowCode(
  grid: Pick<Grid, "rows" | "cols" | "data">,
  row: number,
  col: number,
  directions: readonly ArrowDirection[],
): number | null {
  const wanted = new Set<number>(directions.map((direction) => direction === "right" ? 6 : 8));
  const candidates = Object.entries(CLUE_MAP)
    .map(([code, entries]) => ({ code: Number(code), entries }))
    .filter(({ entries }) => entries.length === wanted.size && entries.every(({ dirKey }) => wanted.has(dirKey)))
    .sort((a, b) => a.code - b.code);
  for (const candidate of candidates) {
    if (candidate.entries.every(({ cluePos }) => {
      const [dr, dc] = CLUE_POSITION_OFFSETS[cluePos] ?? [0, 0];
      const r = row + dr;
      const c = col + dc;
      return r >= 0 && c >= 0 && r < grid.rows && c < grid.cols && grid.data[r][c] === "#";
    })) return candidate.code;
  }
  return null;
}

export function arrowCellForCode(code: number): Cell {
  const entries = CLUE_MAP[code] ?? [];
  if (entries.length > 1 || DOUBLE_CODES.has(code)) return "↘";
  return entries[0]?.dirKey === 8 ? "↓" : "→";
}
