import {
  arrowCellForCode,
  buildFsh,
  CLUE_MAP,
  CLUE_POSITION_OFFSETS,
  DIRS,
  lengthStats,
  markerFor,
  scanSlotsDetailed,
} from "@megacross/cross-format";
import type { Cell, Grid, Slot } from "../types";
import { geometryFingerprint, isDiverseGeometry } from "./diversity";
import { evaluateTemplateQuality, targetDoubleArrowCount } from "./quality";
import { templateSupplyDeficit } from "./weights";
import { boundaryDirectionMetrics, boundaryPattern } from "./boundary";
export { geometryFingerprint } from "./diversity";
export { evaluateTemplateQuality, targetDoubleArrowCount } from "./quality";
import { assignUniqueClues, clueAssignmentDiagnostics, verifyClueOwnership } from "./clueMatcher";
import { firstArrowCode } from "./arrowOptions";
import { MaskRunIndex, selectConnectedRuns, type ChangedCell, type MaskRun } from "./topology";
import { searchRegionalRepair, type MaskChange } from "./regionalRepair";
import {
  CUTOUT_PRESETS,
  type GeneratedTemplate,
  type PictureBounds,
  type PictureSize,
  type TemplateGenerationRequest,
  type TemplateInvariantReport,
} from "./types";

const AUTO_PICTURE_SIZES: readonly PictureSize[] = [
  { width: 4, height: 4 },
  { width: 5, height: 4 },
  { width: 4, height: 5 },
];

export class SeededRandom {
  private state: number;

  constructor(seed: string | number, restoredState?: number) {
    const text = String(seed);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    this.state = restoredState && Number.isInteger(restoredState) ? restoredState >>> 0 : hash >>> 0 || 0x9e3779b9;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * Math.max(1, maxExclusive));
  }

  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error("cannot pick from an empty list");
    return items[this.int(items.length)];
  }

  get position(): number { return this.state; }
}

export function normalizeGenerationRequest(input: TemplateGenerationRequest): TemplateGenerationRequest {
  const rows = Number(input.rows);
  const cols = Number(input.cols);
  const resultCount = Number(input.resultCount);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 5 || rows > 40 || cols < 5 || cols > 40) {
    throw new Error("rows and cols must be integers from 5 to 40");
  }
  if (!Number.isInteger(resultCount) || resultCount < 1 || resultCount > 150) {
    throw new Error("resultCount must be an integer from 1 to 150");
  }
  if (!CUTOUT_PRESETS.includes(input.cutoutPresetId)) throw new Error("unknown cutout preset");
  if (input.seed != null && !["string", "number"].includes(typeof input.seed)) throw new Error("seed must be a string or number");
  if (input.seed != null && String(input.seed).length > 128) throw new Error("seed must be at most 128 characters");
  if (input.pictures.mode === "auto") {
    const count = Number(input.pictures.count);
    if (!Number.isInteger(count) || count < 0 || count > 20) throw new Error("automatic picture count must be an integer from 0 to 20");
    return { ...input, rows, cols, resultCount, pictures: { mode: "auto", count } };
  }
  if (input.pictures.items.length > 20) throw new Error("at most 20 pictures are supported");
  const items = input.pictures.items.map(({ width, height }) => ({ width: Number(width), height: Number(height) }));
  if (items.some(({ width, height }) => !Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4)) {
    throw new Error("manual picture dimensions must be integers of at least 4×4");
  }
  return { ...input, rows, cols, resultCount, pictures: { mode: "manual", items } };
}

function cutoutBase(rows: number, cols: number): number {
  // The real 2XY samples use solid 3×3 corner masks on 11×15 layouts and
  // 4×4 corner masks on 14×19 layouts.  A quarter of the shorter side follows
  // those examples, with a cap for large user-defined grids.
  return Math.min(6, Math.max(2, Math.round(Math.min(rows, cols) * 0.25)));
}

function rotatePoint(row: number, col: number, rows: number, cols: number, orientation: number): [number, number] {
  if (orientation === 0) return [row, col];
  if (orientation === 1) return [row, cols - 1 - col];
  if (orientation === 2) return [rows - 1 - row, cols - 1 - col];
  return [rows - 1 - row, col];
}

export function buildCutout(request: TemplateGenerationRequest, rng: Pick<SeededRandom, "int">): { cells: Set<string>; orientation: string } {
  const { rows, cols, cutoutPresetId } = request;
  const base = cutoutBase(rows, cols);
  const orientationIndex = rng.int(4);
  let orientation = cutoutPresetId === "center-window"
    ? "center"
    : ["top-left", "top-right", "bottom-right", "bottom-left"][orientationIndex];
  const raw: Array<[number, number]> = [];
  const addRect = (row: number, col: number, height: number, width: number) => {
    for (let r = row; r < row + height; r += 1) for (let c = col; c < col + width; c += 1) raw.push([r, c]);
  };
  if (cutoutPresetId === "corner" || cutoutPresetId === "opposite-corners") addRect(0, 0, base, base);
  if (cutoutPresetId === "opposite-corners") addRect(rows - base, cols - base, base, base);
  if (cutoutPresetId === "edge-bite" || cutoutPresetId === "opposite-edge-bites") {
    const verticalLength = Math.min(rows, base + Math.max(1, Math.round(base / 2)));
    const horizontalLength = Math.min(cols, base + Math.max(1, Math.round(base / 2)));
    const centerRow = Math.floor((rows - verticalLength) / 2);
    const centerCol = Math.floor((cols - horizontalLength) / 2);
    if (cutoutPresetId === "edge-bite") {
      orientation = ["left", "right", "top", "bottom"][orientationIndex];
      if (orientation === "left") addRect(centerRow, 0, verticalLength, base);
      if (orientation === "right") addRect(centerRow, cols - base, verticalLength, base);
      if (orientation === "top") addRect(0, centerCol, base, horizontalLength);
      if (orientation === "bottom") addRect(rows - base, centerCol, base, horizontalLength);
    } else {
      orientation = orientationIndex % 2 === 0 ? "left-right" : "top-bottom";
      if (orientation === "left-right") {
        addRect(centerRow, 0, verticalLength, base);
        addRect(centerRow, cols - base, verticalLength, base);
      } else {
        addRect(0, centerCol, base, horizontalLength);
        addRect(rows - base, centerCol, base, horizontalLength);
      }
    }
  }
  if (cutoutPresetId === "stepped-corner") {
    for (let r = 0; r < base * 2; r += 1) for (let c = 0; c < base * 2 - r; c += 1) raw.push([r, c]);
  }
  if (cutoutPresetId === "center-window") addRect(Math.floor((rows - base) / 2), Math.floor((cols - base) / 2), base, base);
  const cells = new Set(raw.map(([r, c]) => {
    const [rr, cc] = cutoutPresetId === "center-window" || cutoutPresetId === "none" ||
      cutoutPresetId === "edge-bite" || cutoutPresetId === "opposite-edge-bites"
      ? [r, c]
      : rotatePoint(r, c, rows, cols, orientationIndex);
    return `${rr},${cc}`;
  }));
  return { cells, orientation: cutoutPresetId === "none" ? "none" : orientation };
}

function resolvedPictureSizes(request: TemplateGenerationRequest, rng: SeededRandom): PictureSize[] {
  if (request.pictures.mode === "manual") return request.pictures.items;
  return Array.from({ length: request.pictures.count }, () => rng.pick(AUTO_PICTURE_SIZES));
}

function placePictures(
  rows: number,
  cols: number,
  sizes: readonly PictureSize[],
  forbidden: ReadonlySet<string>,
  rng: SeededRandom,
  gap = 1,
  inset = 0,
  preferCorners = false,
): PictureBounds[] | null {
  const indexed = sizes
    .map((size, index) => ({ ...size, index }))
    .sort((a, b) => b.width * b.height - a.width * a.height || a.index - b.index);
  if (indexed.some((size) => size.width > cols || size.height > rows)) return null;
  for (let restart = 0; restart < 64; restart += 1) {
    const placed: Array<PictureBounds & { index: number }> = [];
    let failed = false;
    for (const size of indexed) {
      const options: Array<{ row: number; col: number }> = [];
      for (let row = inset; row <= rows - size.height - inset; row += 1) for (let col = inset; col <= cols - size.width - inset; col += 1) {
        let ok = true;
        for (let r = row; ok && r < row + size.height; r += 1) for (let c = col; c < col + size.width; c += 1) {
          if (forbidden.has(`${r},${c}`)) { ok = false; break; }
        }
        if (ok && placed.some((item) =>
          row - gap <= item.row + item.height - 1 && row + size.height + gap - 1 >= item.row &&
          col - gap <= item.col + item.width - 1 && col + size.width + gap - 1 >= item.col
        )) ok = false;
        if (ok) options.push({ row, col });
      }
      if (!options.length) { failed = true; break; }
      const corners = preferCorners ? options.filter(({ row, col }) => (row === 0 || row === rows - size.height) && (col === 0 || col === cols - size.width)) : [];
      placed.push({ ...rng.pick(corners.length ? corners : options), width: size.width, height: size.height, index: size.index });
    }
    if (!failed) return placed.sort((a, b) => a.index - b.index).map(({ index: _index, ...bounds }) => bounds);
  }
  return null;
}

export function assertGeometryCompatible(requestInput: TemplateGenerationRequest): void {
  const request = normalizeGenerationRequest(requestInput);
  const rng = new SeededRandom(request.seed ?? "geometry");
  const cutout = buildCutout(request, rng);
  if (!placeRequestedPictures(request, cutout.cells, rng)) {
    throw new Error("pictures and cutout cannot be placed in the requested grid");
  }
}

function placeRequestedPictures(request: TemplateGenerationRequest, forbidden: ReadonlySet<string>, rng: SeededRandom): PictureBounds[] | null {
  const sizes = resolvedPictureSizes(request, rng);
  if (sizes.length >= 3 && rng.next() < 0.5) {
    const corners = placePictures(request.rows, request.cols, sizes, forbidden, rng, 3, 0, true);
    if (corners) return corners;
  }
  // Leave room for independent clue/answer collars between photos when possible.
  const placed = placePictures(request.rows, request.cols, sizes, forbidden, rng, 3, 4)
    ?? placePictures(request.rows, request.cols, sizes, forbidden, rng, 3)
    ?? placePictures(request.rows, request.cols, sizes, forbidden, rng);
  if (placed || request.pictures.mode === "manual") return placed;
  return placePictures(request.rows, request.cols, Array.from({ length: request.pictures.count }, () => ({ width: 4, height: 4 })), forbidden, rng);
}

export function maximalRuns(mask: Cell[][], direction: "right" | "down", minLength = 3): Array<{ r: number; c: number; cells: [number, number][] }> {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const runs: Array<{ r: number; c: number; cells: [number, number][] }> = [];
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "right" ? 1 : 0;
  const barrier = (r: number, c: number) => mask[r]?.[c] === "#" || mask[r]?.[c] === "%";
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
    if (barrier(r, c) || (r - dr >= 0 && c - dc >= 0 && !barrier(r - dr, c - dc))) continue;
    const cells: [number, number][] = [];
    for (let rr = r, cc = c; rr < rows && cc < cols && !barrier(rr, cc); rr += dr, cc += dc) cells.push([rr, cc]);
    if (cells.length >= minLength && cells.length <= 11) runs.push({ r, c, cells });
  }
  return runs;
}

export function assignArrows(mask: Cell[][], minLength = 3): Grid | null {
  return evaluateArrowMask(mask, new MaskRunIndex(mask, minLength).runs())?.grid ?? null;
}

function evaluateArrowMask(mask: Cell[][], inputRuns: readonly MaskRun[]): { grid: Grid; report: TemplateInvariantReport } | null {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const topology = selectConnectedRuns(mask, inputRuns);
  if (!topology) return null;
  const { runs } = topology;
  const directionsByStart = new Map<number, number[]>();
  for (const run of runs) {
    const key = run.r * cols + run.c;
    const list = directionsByStart.get(key) ?? [];
    list.push(run.direction === "right" ? 6 : 8);
    directionsByStart.set(key, list);
  }
  const grid: Grid = {
    rows,
    cols,
    marker: markerFor(rows, cols, 2),
    formatVersion: 2,
    templateTypeCode: "S",
    templateType: "scanword",
    data: mask.map((row) => row.join("")),
    codes: Array.from({ length: rows }, () => Array<number>(cols).fill(0)),
  };
  const output = grid.data.map((row) => row.split("") as Cell[]);
  for (const [key, directions] of directionsByStart) {
    const row = Math.floor(key / cols); const col = key % cols;
    const code = firstArrowCode(grid, row, col, directions);
    if (code == null) return null;
    output[row][col] = arrowCellForCode(code);
    grid.codes[row][col] = code;
  }
  grid.data = output.map((row) => row.join(""));
  const distribution: Record<string, number> = {};
  for (const run of runs) distribution[run.cells.length] = (distribution[run.cells.length] ?? 0) + 1;
  return { grid, report: {
    valid: topology.valid, errors: topology.valid ? [] : ["each word must have at least two intersections"],
    slotCount: runs.length, intersections: topology.intersections,
    averageIntersections: topology.intersectionSum / runs.length, lengthDistribution: distribution,
  } };
}

export function verifyTemplateInvariants(grid: Grid): TemplateInvariantReport {
  const errors: string[] = [];
  const slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 2 }).slots;
  if (!slots.length) errors.push("template has no word slots");
  if (slots.some((slot) => slot.len < 2 || slot.len > 11)) errors.push("all word lengths must be from 2 to 11");
  if (slots.filter((slot) => slot.len === 2).length > 1) errors.push("at most one two-letter word is allowed");
  const membership = new Map<string, number[]>();
  for (const slot of slots) for (const [row, col] of slot.cells) {
    const key = `${row},${col}`;
    const list = membership.get(key) ?? [];
    list.push(slot.id);
    membership.set(key, list);
  }
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    const cell = grid.data[row][col] as Cell;
    if (cell !== "#" && cell !== "%" && !membership.has(`${row},${col}`)) errors.push(`letter cell ${row},${col} is not covered`);
  }
  let intersections = 0;
  const graph = new Map<number, Set<number>>(slots.map((slot) => [slot.id, new Set<number>()]));
  const intersectionsBySlot = new Map<number, number>(slots.map((slot) => [slot.id, 0]));
  for (const ids of membership.values()) if (ids.length > 1) {
    intersections += 1;
    for (const id of ids) intersectionsBySlot.set(id, (intersectionsBySlot.get(id) ?? 0) + 1);
    for (const a of ids) for (const b of ids) if (a !== b) graph.get(a)?.add(b);
  }
  if (slots.some((slot) => (intersectionsBySlot.get(slot.id) ?? 0) < 2)) errors.push("each word must have at least two intersections");
  if (slots.length) {
    const seen = new Set<number>([slots[0].id]);
    const queue = [slots[0].id];
    for (let index = 0; index < queue.length; index += 1) for (const next of graph.get(queue[index]) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    if (seen.size !== slots.length) errors.push("word graph must be connected");
  }
  for (const slot of slots) {
    const code = grid.codes[slot.r]?.[slot.c] ?? 0;
    if (!code) errors.push(`word ${slot.id} has no supported arrow`);
  }
  const stats = lengthStats(slots);
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    slotCount: slots.length,
    intersections,
    averageIntersections: slots.length ? [...intersectionsBySlot.values()].reduce((sum, value) => sum + value, 0) / slots.length : 0,
    lengthDistribution: Object.fromEntries(Object.entries(stats).filter(([key]) => key !== "total")),
  };
}

export function recognizePictureBounds(grid: Pick<Grid, "rows" | "cols" | "data">): PictureBounds[] {
  const seen = new Set<string>();
  const result: PictureBounds[] = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    const root = `${row},${col}`;
    if (seen.has(root) || grid.data[row]?.[col] !== "#") continue;
    const cells: Array<[number, number]> = [[row, col]];
    seen.add(root);
    for (let index = 0; index < cells.length; index += 1) {
      const [currentRow, currentCol] = cells[index];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nextRow = currentRow + dr;
        const nextCol = currentCol + dc;
        const key = `${nextRow},${nextCol}`;
        if (nextRow < 0 || nextCol < 0 || nextRow >= grid.rows || nextCol >= grid.cols || seen.has(key)) continue;
        if (grid.data[nextRow]?.[nextCol] !== "#") continue;
        seen.add(key);
        cells.push([nextRow, nextCol]);
      }
    }
    const rows = cells.map(([cellRow]) => cellRow);
    const cols = cells.map(([, cellCol]) => cellCol);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    if (width >= 4 && height >= 4 && cells.length === width * height) {
      result.push({ row: minRow, col: minCol, width, height });
    }
  }
  return result.sort((a, b) => a.row - b.row || a.col - b.col || a.width - b.width || a.height - b.height);
}

function samePictureBounds(actual: readonly PictureBounds[], expected: readonly PictureBounds[]): boolean {
  const normalize = (items: readonly PictureBounds[]) => [...items]
    .sort((a, b) => a.row - b.row || a.col - b.col || a.width - b.width || a.height - b.height)
    .map(({ row, col, width, height }) => `${row},${col},${width},${height}`);
  return normalize(actual).join("|") === normalize(expected).join("|");
}

function pictureIsReferencedByArrow(grid: Grid, picture: PictureBounds): boolean {
  const slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 2 }).slots;
  return slots.some((slot) => {
    const directionKey = slot.dir === DIRS.right ? 6 : 8;
    const entry = (CLUE_MAP[grid.codes[slot.r]?.[slot.c] ?? 0] ?? []).find((item) => item.dirKey === directionKey);
    if (!entry) return false;
    const [dr, dc] = CLUE_POSITION_OFFSETS[entry.cluePos] ?? [0, 0];
    const clueRow = slot.r + dr;
    const clueCol = slot.c + dc;
    return clueRow >= picture.row && clueRow < picture.row + picture.height &&
      clueCol >= picture.col && clueCol < picture.col + picture.width;
  });
}

function weightedLength(rng: SeededRandom, weights?: Readonly<Record<number, number>>): number {
  if (!weights) return 3 + rng.int(5);
  const total = Array.from({ length: 9 }, (_, index) => Math.max(0, weights[index + 3] ?? 0)).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return 3 + rng.int(5);
  let cursor = rng.next() * total;
  for (let length = 3; length <= 11; length += 1) {
    cursor -= Math.max(0, weights[length] ?? 0);
    if (cursor <= 0) return length;
  }
  return 7;
}

const CONNECTED_BACKBONES: Readonly<Record<number, readonly number[]>> = {
  5: [2, 3],
  7: [2, 3, 4, 5],
  8: [3, 5],
  9: [2, 4, 5, 7],
  10: [3, 7],
};

function connectedBackbone(rng: SeededRandom, weights?: Readonly<Record<number, number>>): { period: number; slope: number } {
  const targetLength = weightedLength(rng, weights);
  // Period five produces mostly four-letter crossings and remains far more
  // fillable than a dense six-letter lattice with this dictionary.  The
  // five-letter weight therefore also samples this backbone; local groups,
  // pictures and edges still create many genuine 5–7-letter slots.
  const period = targetLength <= 5 ? 5 : targetLength <= 6 ? 7 : Math.min(10, targetLength + 1);
  return { period, slope: rng.pick(CONNECTED_BACKBONES[period]) };
}

export const MASK_FAMILIES = ["periodic", "banded", "woven"] as const;
export type MaskFamily = (typeof MASK_FAMILIES)[number];

export function buildMask(request: TemplateGenerationRequest, rng: SeededRandom, lengthWeights?: Readonly<Record<number, number>>, family: MaskFamily = "periodic"): { mask: Cell[][]; pictures: PictureBounds[]; orientation: string } | null {
  const cutout = buildCutout(request, rng);
  const pictures = placeRequestedPictures(request, cutout.cells, rng);
  if (!pictures) return null;
  const pictureCells = new Set<string>();
  const pictureMargin = new Set<string>();
  for (const picture of pictures) for (let row = picture.row; row < picture.row + picture.height; row += 1) for (let col = picture.col; col < picture.col + picture.width; col += 1) pictureCells.add(`${row},${col}`);
  for (const picture of pictures) for (let row = picture.row - 1; row <= picture.row + picture.height; row += 1) for (let col = picture.col - 1; col <= picture.col + picture.width; col += 1) {
    if ((row === picture.row - 1 || row === picture.row + picture.height) && (col === picture.col - 1 || col === picture.col + picture.width)) continue;
    if (row >= 0 && col >= 0 && row < request.rows && col < request.cols && !pictureCells.has(`${row},${col}`)) pictureMargin.add(`${row},${col}`);
  }
  const densePhotos = pictures.length >= 3;
  const backbone = connectedBackbone(rng, lengthWeights);
  const period = densePhotos ? Math.max(7, Math.min(10, weightedLength(rng, lengthWeights) + 2)) : backbone.period;
  const slope = densePhotos ? rng.pick(period === 7 ? [2, 5] : period === 8 ? [3, 5] : period === 9 ? [2, 7] : [3, 7]) : backbone.slope;
  const phase = rng.int(period);
  const topPattern = boundaryPattern(request.cols, rng, () => weightedLength(rng, lengthWeights));
  const leftPattern = boundaryPattern(request.rows, rng, () => weightedLength(rng, lengthWeights));
  // Coarse phase changes break global diagonal repetition. The woven family
  // varies both axes; independent seeded bands do not share a global period.
  const rowBands = Array.from({ length: Math.ceil(request.rows / 5) }, () => family === "periodic" ? 0 : rng.int(3) - 1);
  const colBands = Array.from({ length: Math.ceil(request.cols / 5) }, () => family === "woven" ? rng.int(3) - 1 : 0);
  const mask = Array.from({ length: request.rows }, (_, row) => Array.from({ length: request.cols }, (_, col): Cell => {
    const key = `${row},${col}`;
    if (cutout.cells.has(key)) return "%";
    if (pictureCells.has(key)) return "#";
    if (pictureMargin.has(key)) return "*";
    // Short inward starts alternate with words running along the boundary.
    if (row === 0) return topPattern[col];
    if (col === 0) return leftPattern[row];
    // Parallel 45-degree blockers split the word graph into disconnected
    // diagonal bands.  A coprime slope other than ±1 links neighbouring bands
    // while keeping horizontal and vertical runs in the dictionary's 4–9 range.
    const structural = ((row + slope * col + phase + rowBands[Math.floor(row / 5)] + colBands[Math.floor(col / 5)]) % period + period) % period === 0;
    return structural ? "#" : "*";
  }));

  const edgeProtected = new Set<string>();
  const protect = (row: number, col: number) => {
    const key = `${row},${col}`;
    if (cutout.cells.has(key) || pictureCells.has(key)) return;
    mask[row][col] = "*";
    edgeProtected.add(key);
  };
  // Do not force words through a side that is intentionally cut away.
  if (!["top", "bottom", "top-bottom"].includes(cutout.orientation)) {
    for (let col = 0; col < request.cols; col += 1) if (mask[0][col] === "*" && (mask[0][col - 1] === "#" || mask[0][col + 1] === "#")) {
      for (let row = 1; row < Math.min(3, request.rows); row += 1) protect(row, col);
    }
  }
  if (!["left", "right", "left-right"].includes(cutout.orientation)) {
    for (let row = 0; row < request.rows; row += 1) if (mask[row][0] === "*" && (mask[row - 1]?.[0] === "#" || mask[row + 1]?.[0] === "#")) {
      for (let col = 1; col < Math.min(3, request.cols); col += 1) protect(row, col);
    }
  }

  // The periodic blockers are almost all isolated.  In the 2XY corpus a
  // sizeable share of clue cells form pairs or small groups. Extend a subset
  // of interior blockers by one cell, then reject any geometry whose shortened
  // runs cannot satisfy the word/arrow invariants.
  const groupSeeds: Array<[number, number]> = [];
  for (let row = 1; row < request.rows - 1; row += 1) for (let col = 1; col < request.cols - 1; col += 1) {
    const key = `${row},${col}`;
    if (mask[row][col] === "#" && !pictureCells.has(key)) groupSeeds.push([row, col]);
  }
  for (const [row, col] of groupSeeds) {
    // Photo margins remove many eligible pair locations, so compensate when a
    // picture is present instead of publishing an isolated-clue texture.
    if (rng.next() >= (densePhotos ? 0.65 : pictures.length ? 0.18 : 0.12)) continue;
    const [dr, dc] = densePhotos ? [0, 1] : rng.pick([[0, 1], [1, 0]] as const);
    const rr = row + dr;
    const cc = col + dc;
    const key = `${rr},${cc}`;
    if (mask[rr][cc] === "*" && !pictureMargin.has(key) && !edgeProtected.has(key)) mask[rr][cc] = "#";
  }

  // A periodic backbone gives every candidate a dense, well-connected set of
  // crossings. Seeded local mutations provide enough geometric variety for
  // large batches; the invariant pass below discards mutations that create
  // short, disconnected or under-crossed words.
  const mutableCells: Array<[number, number]> = [];
  for (let row = 1; row < request.rows; row += 1) for (let col = 1; col < request.cols; col += 1) {
    const key = `${row},${col}`;
    if (!cutout.cells.has(key) && !pictureCells.has(key) && !pictureMargin.has(key) && !edgeProtected.has(key)) mutableCells.push([row, col]);
  }
  const mutationLimit = Math.max(2, Math.floor((request.rows * request.cols) / 90));
  const mutationCount = rng.int(mutationLimit + 1);
  for (let index = 0; index < mutationCount && mutableCells.length; index += 1) {
    const selected = rng.int(mutableCells.length);
    const [row, col] = mutableCells[selected];
    mutableCells[selected] = mutableCells[mutableCells.length - 1];
    mutableCells.pop();
    mask[row][col] = mask[row][col] === "#" ? "*" : "#";
  }
  // A few isolated cells arise where a photo margin or a cutout interrupts a
  // periodic run. They may become clue cells, but never erase a whole region
  // to rescue a disconnected structure (the old preview defect).
  const covered = new Set([
    ...maximalRuns(mask, "right"),
    ...maximalRuns(mask, "down"),
  ].flatMap((run) => run.cells.map(([row, col]) => `${row},${col}`)));
  const repair: Array<[number, number]> = [];
  for (let row = 0; row < request.rows; row += 1) for (let col = 0; col < request.cols; col += 1) {
    const key = `${row},${col}`;
    if (mask[row][col] === "*" && !covered.has(key) && !pictureMargin.has(key)) repair.push([row, col]);
  }
  if (!densePhotos) {
    if (repair.length > Math.max(2, Math.floor(request.rows * request.cols * 0.02))) return null;
    for (const [row, col] of repair) mask[row][col] = "#";
  }
  return { mask, pictures, orientation: cutout.orientation };
}

function balanceClues(maskInput: Cell[][], pictures: readonly PictureBounds[], rng: SeededRandom, profileStrength: number, lengthWeights?: Readonly<Record<number, number>>, diagnostics?: Record<string, number>, adaptiveSearch = false, regionalRepair = true, dictionaryCounts?: Readonly<Record<number, number>>): { grid: Grid; regionalRepairCount: number } | null {
  const mask = maskInput.map((row) => [...row]);
  if (!assignArrows(mask) && !repairStructuralMask(mask, pictures, rng)) { if (diagnostics) diagnostics.repairRejected = (diagnostics.repairRejected ?? 0) + 1; return null; }
  // A two-letter start is optional and rare, rather than forced into every grid.
  const minLength = lengthWeights?.[2] && rng.next() < Math.min(0.05, lengthWeights[2] * mask.length * mask[0].length) ? 2 : 3;
  const initialGrid = assignArrows(mask, minLength);
  if (!initialGrid) return null;
  let grid: Grid = initialGrid;
  const runIndex = new MaskRunIndex(mask, minLength);
  const area = grid.rows * grid.cols;
  const maxIterations = Math.min(180, Math.max(24, Math.ceil(area / 12)));
  const sampleLimit = Math.min(200, Math.max(50, Math.ceil(area * 0.22)));
  const photoMargin = new Set<string>();
  for (const picture of pictures) for (let row = picture.row - 1; row <= picture.row + picture.height; row += 1) {
    for (let col = picture.col - 1; col <= picture.col + picture.width; col += 1) {
      if ((row === picture.row - 1 || row === picture.row + picture.height) && (col === picture.col - 1 || col === picture.col + picture.width)) continue;
      if (row >= 0 && col >= 0 && row < grid.rows && col < grid.cols) photoMargin.add(`${row},${col}`);
    }
  }
  type BalanceState = { gap: number; bad: number; score: number; targetDoubleStarts: number; matchingPossible: boolean; supplyDeficit: number; edgeDirectionDeficit: number };
  const inspect = (candidate: Grid, report = verifyTemplateInvariants(candidate)): BalanceState | null => {
    if (!report.valid) return null;
    const ownership = clueAssignmentDiagnostics(candidate, pictures);
    if (!ownership.matchingExhaustive && diagnostics) diagnostics.matchingBudgetExhaustions = (diagnostics.matchingBudgetExhaustions ?? 0) + 1;
    const gap = ownership.answerCount - ownership.resourceCount;
    const bad = ownership.noOptionResources.length + ownership.noOptionStarts.length;
    const targetDoubleStarts = targetDoubleArrowCount(ownership.answerCount);
    const matchingDeficit = ownership.unmatchedSingleStarts + ownership.unmatchedDoubleStarts;
    const supplyDeficit = templateSupplyDeficit(report.lengthDistribution, report.slotCount, dictionaryCounts, lengthWeights);
    const quality = evaluateTemplateQuality(candidate, pictures, report, lengthWeights);
    const edgeDirectionDeficit = quality.edgeDirectionDeficit;
    const feasibilityScore = 4 * edgeDirectionDeficit + Math.abs(gap) + 5 * bad + 3 * matchingDeficit + 5 * supplyDeficit;
    return {
      gap, bad, targetDoubleStarts, supplyDeficit, edgeDirectionDeficit, matchingPossible: !ownership.matchingExhaustive || matchingDeficit === 0,
      // A shared start may point right and down, but it must consume two separate clues.
      // Corpus templates commonly contain a few such starts; do not optimize them away.
      // Dictionary-style arrow density only becomes a strong preference as the
      // assignment approaches feasibility, so difficult cutouts can still converge.
      score: feasibilityScore + 8 * quality.qualityScore
        * (5 / (5 + feasibilityScore)) * profileStrength / 3,
    };
  };
  const initialState = inspect(grid);
  if (!initialState) return null;
  let state: BalanceState = initialState;
  let fallback: { grid: Grid; regionalRepairCount: number } | null = null;
  let fallbackScore = Infinity;
  const visited = new Set<string>();
  const maskKey = () => mask.map((row) => row.join("")).join("/");
  visited.add(maskKey());
  const cache = new Map<string, { grid: Grid | null; state: BalanceState | null }>();
  const evaluateMove = (changed: readonly ChangedCell[]) => {
    const key = maskKey();
    if (visited.has(key)) return { grid: null, state: null };
    const saved = cache.get(key);
    if (saved) { if (diagnostics) diagnostics.cacheHits = (diagnostics.cacheHits ?? 0) + 1; return saved; }
    const evaluated = evaluateArrowMask(mask, runIndex.runs(changed));
    const result = { grid: evaluated?.grid ?? null, state: evaluated ? inspect(evaluated.grid, evaluated.report) : null };
    if (cache.size >= 512) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    if (diagnostics) diagnostics.evaluations = (diagnostics.evaluations ?? 0) + 1;
    return result;
  };
  let bestObserved = state.score;
  let stagnant = 0;
  let noise = 0;
  let regionalRepairs = 0;
  let regionalRepairCount = 0;

  for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
    if (state.gap === 0 && state.bad === 0 && state.supplyDeficit === 0 && state.edgeDirectionDeficit === 0 && state.matchingPossible) {
      const matched = assignUniqueClues(grid, pictures, 2048);
      if (matched && !verifyClueOwnership(matched, pictures).length && samePictureBounds(recognizePictureBounds(matched), pictures)) {
        const doubleStarts = clueAssignmentDiagnostics(matched, pictures).doubleStarts;
        const minimumDoubleStarts = state.targetDoubleStarts === 0 ? 0 : Math.max(1, state.targetDoubleStarts - 1);
        const report = verifyTemplateInvariants(matched);
        const shortCount = report.lengthDistribution[3] ?? 0;
        if (doubleStarts >= minimumDoubleStarts && (!lengthWeights || shortCount <= Math.ceil(report.slotCount * Math.max(0.06, (lengthWeights[3] ?? 0) * 2 + 0.03)) + 1)) return { grid: matched, regionalRepairCount };
        if (state.score < fallbackScore) {
          fallback = { grid: matched, regionalRepairCount };
          fallbackScore = state.score;
        }
      }
    }
    if (iteration === maxIterations) break;
    const cells: Array<[number, number]> = [];
    for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
      if (mask[row][col] !== "%" && !photoMargin.has(`${row},${col}`)) cells.push([row, col]);
    }
    const sampled = Math.min(sampleLimit, cells.length);
    for (let index = 0; index < sampled; index += 1) {
      const selected = index + rng.int(cells.length - index);
      [cells[index], cells[selected]] = [cells[selected], cells[index]];
    }
    const conflict = clueAssignmentDiagnostics(grid, pictures);
    const focus = [...conflict.noOptionStarts, ...conflict.unmatchedStarts, ...conflict.noOptionResources, ...conflict.unmatchedResources]
      .filter((key) => !key.startsWith("photo:"))
      .map((key): [number, number] => { const [row, col] = key.replace(/^clue:/u, "").split(",").map(Number); return [row, col]; });
    if (state.edgeDirectionDeficit) {
      const edges = boundaryDirectionMetrics(grid, pictures);
      if (edges.top.eligible && !edges.top.along) for (let col = 1; col < grid.cols - 1; col += 1) focus.push([0, col]);
      if (edges.left.eligible && !edges.left.along) for (let row = 1; row < grid.rows - 1; row += 1) focus.push([row, 0]);
    }
    const isNearConflict = ([row, col]: [number, number]) => focus.some(([r, c]) => Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2);
    cells.sort((a, b) => Number(isNearConflict(b)) - Number(isNearConflict(a)));
    type Move = { changes: MaskChange[]; grid: Grid; state: BalanceState };
    const tryCells = (start: number, end: number, allowUphill = false): Move | null => {
      let best: Move | null = null;
      for (let index = start; index < end; index += 1) {
        const [row, col] = cells[index];
        const previous = mask[row][col];
        mask[row][col] = previous === "#" ? "*" : "#";
        const evaluated = evaluateMove([[row, col]]);
        const candidate = evaluated.grid;
        const candidateState = evaluated.state;
        if (candidate && candidateState && !visited.has(maskKey()) && candidateState.score < state.score + (allowUphill ? 8 : 0) &&
          (!best || candidateState.score < best.state.score)) {
          best = { changes: [{ row, col, cell: mask[row][col] }], grid: candidate, state: candidateState };
        }
        mask[row][col] = previous;
      }
      return best;
    };
    let best = tryCells(0, sampled);
    if (!best) best = tryCells(sampled, cells.length);
    if (!best) {
      const mutable = new Set(cells.map(([r, c]) => `${r},${c}`));
      for (const [row, col] of cells.slice(0, 60)) for (const [dr, dc] of [[1, 0], [0, 1], [1, 1]] as const) {
        const rr = row + dr; const cc = col + dc;
        if (!mutable.has(`${rr},${cc}`)) continue;
        const previous = mask[row][col]; const other = mask[rr][cc];
        mask[row][col] = previous === "#" ? "*" : "#";
        mask[rr][cc] = other === "#" ? "*" : "#";
        const evaluated = evaluateMove([[row, col], [rr, cc]]);
        const candidate = evaluated.grid;
        const candidateState = evaluated.state;
        if (candidate && candidateState && !visited.has(maskKey()) && candidateState.score < state.score && (!best || candidateState.score < best.state.score)) best = {
          changes: [{ row, col, cell: mask[row][col] }, { row: rr, col: cc, cell: mask[rr][cc] }], grid: candidate, state: candidateState,
        };
        mask[row][col] = previous; mask[rr][cc] = other;
      }
    }
    if (!best && regionalRepair && regionalRepairs < 2) {
      regionalRepairs += 1;
      const repair = searchRegionalRepair(mask, {
        mutable: cells, focus, rng, currentScore: state.score,
        evaluate: (changed) => {
          const trial = evaluateMove(changed);
          return trial.grid && trial.state ? { score: trial.state.score, value: { grid: trial.grid, state: trial.state } } : null;
        },
      });
      if (diagnostics) {
        diagnostics.regionalRepairCalls = (diagnostics.regionalRepairCalls ?? 0) + 1;
        diagnostics.regionalRepairTrials = (diagnostics.regionalRepairTrials ?? 0) + repair.evaluations;
      }
      if (repair.best) {
        best = { changes: repair.best.changes, ...repair.best.value };
        regionalRepairCount += 1;
        if (diagnostics) diagnostics.regionalRepairMoves = (diagnostics.regionalRepairMoves ?? 0) + 1;
      }
    }
    if (!best && adaptiveSearch) {
      if (noise > 0 && rng.next() < noise) {
        // Hoos-style adaptive noise: diversify only on plateaus, retaining every
        // geometric invariant and the best valid fallback throughout the walk.
        for (const [row, col] of cells.slice(0, sampled)) {
          const previous = mask[row][col];
          mask[row][col] = previous === "#" ? "*" : "#";
          const evaluated = evaluateMove([[row, col]]);
          if (evaluated.grid && evaluated.state && evaluated.state.score < state.score + 8) best = { changes: [{ row, col, cell: mask[row][col] }], grid: evaluated.grid, state: evaluated.state };
          mask[row][col] = previous;
          if (best) break;
        }
      }
    }
    if (!best) best = tryCells(0, sampled, true);
    if (!best) break;
    for (const change of best.changes) mask[change.row][change.col] = change.cell;
    runIndex.commit(best.changes.map(({ row, col }) => [row, col]));
    visited.add(maskKey());
    grid = best.grid;
    state = best.state;
    if (state.score < bestObserved) { bestObserved = state.score; stagnant = 0; noise *= 0.9; }
    else stagnant += 1;
    if (adaptiveSearch && stagnant >= 12) { noise = Math.min(0.5, noise + (1 - noise) * 0.2); stagnant = 0; }
  }
  if (!fallback && diagnostics) { diagnostics.balanceRejected = (diagnostics.balanceRejected ?? 0) + 1; diagnostics.lastGap = state.gap; diagnostics.lastBad = state.bad; diagnostics.lastScore = state.score; const d = clueAssignmentDiagnostics(grid, pictures); diagnostics.lastUnmatched = d.unmatchedSingleStarts + d.unmatchedDoubleStarts; }
  return fallback;
}

/** Repair conflicts before demanding a fully valid arrow grid. Photos/cutouts stay fixed. */
export function repairStructuralMask(mask: Cell[][], pictures: readonly PictureBounds[], rng: SeededRandom, onProgress?: (state: { score: number; uncovered: number; weak: number; missing: number; components: number }) => void): boolean {
  const rows = mask.length;
  const cols = mask[0].length;
  const fixed = new Set<string>();
  for (const p of pictures) for (let r = p.row - 1; r <= p.row + p.height; r += 1) for (let c = p.col - 1; c <= p.col + p.width; c += 1) {
    if ((r === p.row - 1 || r === p.row + p.height) && (c === p.col - 1 || c === p.col + p.width)) continue;
    fixed.add(`${r},${c}`);
  }
  const inspect = () => {
    const runs = [...maximalRuns(mask, "right").map((run) => ({ ...run, direction: "right" as const })), ...maximalRuns(mask, "down").map((run) => ({ ...run, direction: "down" as const }))];
    const membership = new Map<string, number[]>();
    runs.forEach((run, id) => run.cells.forEach(([r, c]) => { const key = `${r},${c}`; membership.set(key, [...(membership.get(key) ?? []), id]); }));
    const crossings = runs.map(() => 0);
    const graph = runs.map(() => new Set<number>());
    for (const ids of membership.values()) if (ids.length > 1) for (const a of ids) { crossings[a] += 1; for (const b of ids) if (a !== b) graph[a].add(b); }
    let components = 0;
    const visited = new Set<number>();
    for (let id = 0; id < runs.length; id += 1) if (!visited.has(id)) { components += 1; const queue = [id]; visited.add(id); for (let i = 0; i < queue.length; i += 1) for (const next of graph[queue[i]]) if (!visited.has(next)) { visited.add(next); queue.push(next); } }
    const focus = new Set<string>();
    const add = (r: number, c: number) => {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const rr = r + dr; const cc = c + dc; const key = `${rr},${cc}`;
        if (rr >= 0 && cc >= 0 && rr < rows && cc < cols && mask[rr][cc] !== "%" && !fixed.has(key)) focus.add(key);
      }
    };
    let uncovered = 0;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) if (mask[r][c] === "*" && !membership.has(`${r},${c}`)) {
      uncovered += 1; add(r, c);
      // A photo collar can force a long run. Its repair point may be far away
      // from the uncovered cell, outside the protected collar.
      for (const [dr, dc] of [[1, 0], [0, 1]] as const) {
        let rr = r; let cc = c;
        while (mask[rr - dr]?.[cc - dc] === "*") { rr -= dr; cc -= dc; }
        while (mask[rr]?.[cc] === "*") { add(rr, cc); rr += dr; cc += dc; }
      }
    }
    let weak = 0;
    runs.forEach((run, id) => { if (crossings[id] < 2) { weak += 1; run.cells.forEach(([r, c]) => add(r, c)); } });
    const grid = { rows, cols, data: mask.map((row) => row.join("")) };
    const starts = new Map<string, Array<"right" | "down">>();
    for (const run of runs) { const key = `${run.r},${run.c}`; starts.set(key, [...(starts.get(key) ?? []), run.direction]); }
    let missing = 0;
    for (const [key, directions] of starts) { const [r, c] = key.split(",").map(Number); if (firstArrowCode(grid, r, c, directions.map((direction) => direction === "right" ? 6 : 8)) == null) { missing += 1; add(r, c); } }
    return { score: 20 * uncovered + 4 * weak + 8 * missing + 6 * Math.max(0, components - 1), focus: [...focus], uncovered, weak, missing, components };
  };
  let state = inspect();
  onProgress?.(state);
  const tabu = new Set<string>();
  for (let iteration = 0; iteration < 80; iteration += 1) {
    if (assignArrows(mask)) return true;
    if (!state.focus.length) return false;
    const choices = state.focus.map((key) => ({ key, order: rng.next() })).sort((a, b) => a.order - b.order).slice(0, 40);
    let best: { key: string; score: number } | null = null;
    for (const { key } of choices) {
      const [r, c] = key.split(",").map(Number); const previous = mask[r][c];
      mask[r][c] = previous === "#" ? "*" : "#";
      const fingerprint = mask.map((row) => row.join("")).join("/");
      const score = tabu.has(fingerprint) ? Infinity : inspect().score;
      mask[r][c] = previous;
      if (!best || score < best.score) best = { key, score };
    }
    if (!best || !Number.isFinite(best.score) || best.score > state.score + 12) return false;
    const [r, c] = best.key.split(",").map(Number);
    mask[r][c] = mask[r][c] === "#" ? "*" : "#";
    tabu.add(mask.map((row) => row.join("")).join("/"));
    state = inspect();
    onProgress?.(state);
  }
  return Boolean(assignArrows(mask));
}

export function generateStructuralCandidate(
  requestInput: TemplateGenerationRequest,
  rng: SeededRandom,
  knownFingerprints: ReadonlySet<string> = new Set(),
  attemptBudget = 5_000,
  lengthWeights?: Readonly<Record<number, number>>,
  selection: { poolSize?: number; dictionaryCounts?: Readonly<Record<number, number>>; diagnostics?: Record<string, number>; adaptiveSearch?: boolean; regionalRepair?: boolean; diversityFingerprints?: readonly string[]; maskFamily?: MaskFamily } = {},
): GeneratedTemplate | null {
  const request = normalizeGenerationRequest(requestInput);
  let best: GeneratedTemplate | null = null;
  let bestScore = Infinity;
  let collected = 0;
  for (let attempt = 0; attempt < attemptBudget; attempt += 1) {
    const maskFamily = selection.maskFamily ?? MASK_FAMILIES[attempt % MASK_FAMILIES.length];
    if (selection.diagnostics) selection.diagnostics[`familyAttempts_${maskFamily}`] = (selection.diagnostics[`familyAttempts_${maskFamily}`] ?? 0) + 1;
    const built = buildMask(request, rng, lengthWeights, maskFamily);
    if (!built) { if (selection.diagnostics) selection.diagnostics.maskRejected = (selection.diagnostics.maskRejected ?? 0) + 1; continue; }
    // Two opposing edge bites leave far fewer legal clue positions, especially
    // alongside a photo; the corpus-density preference must remain softer there.
    const profileStrength = request.cutoutPresetId === "opposite-edge-bites" ? 1 : 3;
    const balanced = balanceClues(built.mask, built.pictures, rng, profileStrength, selection.dictionaryCounts ? lengthWeights : undefined, selection.diagnostics, selection.adaptiveSearch, selection.regionalRepair, selection.dictionaryCounts);
    if (!balanced) continue;
    const { grid, regionalRepairCount } = balanced;
    if (verifyClueOwnership(grid, built.pictures).length) continue;
    if (!samePictureBounds(recognizePictureBounds(grid), built.pictures)) continue;
    if (built.pictures.some((picture) => !pictureIsReferencedByArrow(grid, picture))) continue;
    const report = verifyTemplateInvariants(grid);
    if (!report.valid) continue;
    const fingerprint = geometryFingerprint(grid);
    if (knownFingerprints.has(fingerprint)) continue;
    if (!isDiverseGeometry(fingerprint, selection.diversityFingerprints ?? [...knownFingerprints])) {
      if (selection.diagnostics) selection.diagnostics.similarityRejected = (selection.diagnostics.similarityRejected ?? 0) + 1;
      continue;
    }
    if (templateSupplyDeficit(report.lengthDistribution, report.slotCount, selection.dictionaryCounts, lengthWeights)) {
      if (selection.diagnostics) selection.diagnostics.supplyRejected = (selection.diagnostics.supplyRejected ?? 0) + 1;
      continue;
    }
    const quality = evaluateTemplateQuality(grid, built.pictures, report, lengthWeights);
    if (quality.edgeDirectionDeficit) continue;
    const candidate: GeneratedTemplate = {
      grid,
      fsh: buildFsh(grid),
      fingerprint,
      metrics: {
        slotCount: report.slotCount,
        intersections: report.intersections,
        averageIntersections: report.averageIntersections,
        lengthDistribution: report.lengthDistribution,
        pictureBounds: built.pictures,
        cutoutOrientation: built.orientation,
        dictionaryVerified: false,
        regionalRepairCount,
        maskFamily,
        ...quality,
      },
    };
    if (quality.qualityScore < bestScore) { best = candidate; bestScore = quality.qualityScore; }
    collected += 1;
    if (collected >= Math.max(1, selection.poolSize ?? 1)) break;
  }
  return best;
}

export function buildSolverRows(grid: Grid): string[] {
  return grid.data.map((row) => [...row].map((cell) => cell === "#" || cell === "%" ? "#" : ".").join(""));
}

export function slotsForSolver(grid: Grid): Slot[] {
  return scanSlotsDetailed(grid, { mode: "arrow", minLen: 2 }).slots;
}
