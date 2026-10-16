import { DIRS, scanSlotsDetailed } from "@megacross/cross-format";
import type { Cell, Grid } from "../types";
import type { PictureBounds } from "./types";

type RandomSource = { int(maxExclusive: number): number; next(): number };

/** Mixed-length edge segments permit both inward starts and words along an edge. */
export function boundaryPattern(length: number, rng: RandomSource, sampleLength: () => number): Cell[] {
  const cells: Cell[] = [];
  while (cells.length < length) {
    const clues = 1 + Number(rng.next() < 0.25);
    for (let i = 0; i < clues && cells.length < length; i += 1) cells.push("#");
    const letters = rng.next() < 0.5 ? 1 : Math.max(3, Math.min(7, sampleLength()));
    for (let i = 0; i < letters && cells.length < length; i += 1) cells.push("*");
  }
  // Short sampled segments must not recreate the former all-inward border.
  if (length >= 8 && !cells.join("").includes("***")) {
    const start = 1 + rng.int(length - 5);
    cells[start - 1] = "#";
    for (let i = start; i < start + 3; i += 1) cells[i] = "*";
    cells[start + 3] = "#";
  }
  return cells;
}

/** Cutouts and photos can leave too little usable edge for meaningful mixing. */
export function boundaryDirectionMetrics(grid: Grid, pictures: readonly PictureBounds[], slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 2 }).slots) {
  const available = (r: number, c: number) => grid.data[r]?.[c] !== "%" && !pictures.some((p) => r >= p.row && r < p.row + p.height && c >= p.col && c < p.col + p.width);
  const longest = (size: number, cell: (index: number) => boolean) => {
    let best = 0; let run = 0;
    for (let i = 0; i < size; i += 1) { run = cell(i) ? run + 1 : 0; best = Math.max(best, run); }
    return best;
  };
  const hasCollar = (index: number, horizontal: boolean) => {
    for (let depth = 0; depth < Math.min(3, horizontal ? grid.rows : grid.cols); depth += 1) {
      if (!available(horizontal ? depth : index, horizontal ? index : depth)) return false;
    }
    return true;
  };
  const top = { along: 0, inward: 0, eligible: longest(grid.cols, (c) => hasCollar(c, true)) >= 8 };
  const left = { along: 0, inward: 0, eligible: longest(grid.rows, (r) => hasCollar(r, false)) >= 8 };
  for (const slot of slots) {
    if (slot.r === 0) { if (slot.dir === DIRS.right) top.along += 1; else top.inward += 1; }
    if (slot.c === 0) { if (slot.dir === DIRS.down) left.along += 1; else left.inward += 1; }
  }
  const eligible = [top, left].filter((edge) => edge.eligible);
  const edgeDirectionPenalty = eligible.reduce((sum, edge) => {
    const share = edge.along / Math.max(1, edge.along + edge.inward);
    return sum + (edge.inward === 0 ? 1 : Math.max(0, 0.15 - share) / 0.15 + Math.max(0, share - 0.6) / 0.4);
  }, 0) / Math.max(1, eligible.length);
  const edgeDirectionDeficit = eligible.filter((edge) => edge.along === 0).length;
  return { top, left, edgeDirectionPenalty, edgeDirectionDeficit };
}
