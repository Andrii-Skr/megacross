import type { Cell } from "../types";
import type { ChangedCell } from "./topology";

export type MaskChange = { row: number; col: number; cell: Cell };
type RandomSource = { int(maxExclusive: number): number };
type RepairOptions<T> = {
  mutable: readonly ChangedCell[];
  focus: readonly ChangedCell[];
  rng: RandomSource;
  currentScore: number;
  evaluate: (changed: readonly ChangedCell[]) => { score: number; value: T } | null;
  maxEvaluations?: number;
};

/** Bounded LNS-style repair: free a small rectangle and solve its binary mask.
 * Intermediate trials may be invalid; only a strictly better evaluated geometry
 * can be returned. The caller commits it; every trial is rolled back here.
 */
export function searchRegionalRepair<T>(mask: Cell[][], options: RepairOptions<T>): {
  best: { changes: MaskChange[]; value: T; score: number } | null;
  evaluations: number;
} {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const allowed = new Set(options.mutable.filter(([row, col]) =>
    row >= 0 && row < rows && col >= 0 && col < cols && mask[row][col] !== "%",
  ).map(([row, col]) => row * cols + col));
  const anchors = options.focus.length ? options.focus : options.mutable;
  const budget = Math.min(512, Math.max(0, Math.floor(options.maxEvaluations ?? 384)));
  let evaluations = 0;
  let best: { changes: MaskChange[]; value: T; score: number } | null = null;
  if (!allowed.size || !anchors.length || !budget) return { best, evaluations };
  const shapes = [[2, 3], [3, 2], [3, 3]] as const;
  const shapeOffset = options.rng.int(shapes.length);
  const seenRegions = new Set<string>();
  for (let region = 0; region < 6 && evaluations < budget; region += 1) {
    const [height, width] = shapes[(region + shapeOffset) % shapes.length];
    const [anchorRow, anchorCol] = anchors[options.rng.int(anchors.length)];
    const top = Math.max(0, Math.min(rows - height, anchorRow - options.rng.int(height)));
    const left = Math.max(0, Math.min(cols - width, anchorCol - options.rng.int(width)));
    const cells: ChangedCell[] = [];
    for (let row = top; row < Math.min(rows, top + height); row += 1) for (let col = left; col < Math.min(cols, left + width); col += 1) {
      if (allowed.has(row * cols + col)) cells.push([row, col]);
    }
    if (cells.length < 3) continue;
    const key = cells.map(([row, col]) => row * cols + col).join(",");
    if (seenRegions.has(key)) continue;
    seenRegions.add(key);
    const previous = cells.map(([row, col]) => mask[row][col]);
    // Gray-code order visits adjacent assignments without consuming more RNG.
    // The full changed region is supplied to the incremental row/column index.
    try {
      for (let assignment = 1; assignment < 2 ** cells.length && evaluations < budget; assignment += 1) {
        const bits = assignment ^ (assignment >>> 1);
        const changes: MaskChange[] = [];
        cells.forEach(([row, col], id) => {
          const flipped = Boolean(bits & (1 << id));
          mask[row][col] = flipped ? previous[id] === "#" ? "*" : "#" : previous[id];
          if (flipped) changes.push({ row, col, cell: mask[row][col] });
        });
        // Singles and pairs were already searched before this neighborhood.
        if (changes.length < 3) continue;
        evaluations += 1;
        const candidate = options.evaluate(cells);
        if (candidate && Number.isFinite(candidate.score) && candidate.score < (best?.score ?? options.currentScore)) {
          best = { changes, value: candidate.value, score: candidate.score };
        }
      }
    } finally {
      cells.forEach(([row, col], id) => { mask[row][col] = previous[id]; });
    }
  }
  return { best, evaluations };
}
