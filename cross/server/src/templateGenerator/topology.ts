import type { Cell } from "../types";

export const LARGE_TEMPLATE_AREA = 600;

/** Large boards need time to balance mandatory words before restarting their mask. */
export function balanceIterationBudget(area: number): number {
  return Math.min(180, Math.max(24, Math.ceil(area / (area >= LARGE_TEMPLATE_AREA ? 4 : 12))));
}

export type MaskRun = { r: number; c: number; cells: [number, number][]; direction: "right" | "down" };
export type ChangedCell = readonly [number, number];

/** Trial flips only rescan their rows/columns. Committed runs are never mutated. */
export class MaskRunIndex {
  private horizontal: MaskRun[][];
  private vertical: MaskRun[][];

  constructor(private readonly mask: Cell[][]) {
    this.horizontal = mask.map((_, row) => this.scan(row, "right"));
    this.vertical = Array.from({ length: mask[0]?.length ?? 0 }, (_, col) => this.scan(col, "down"));
  }

  private scan(line: number, direction: MaskRun["direction"]): MaskRun[] {
    const size = direction === "right" ? this.mask[0].length : this.mask.length;
    const runs: MaskRun[] = [];
    for (let offset = 0; offset < size;) {
      const cells: [number, number][] = [];
      for (; offset < size; offset += 1) {
        const row = direction === "right" ? line : offset;
        const col = direction === "right" ? offset : line;
        if (this.mask[row][col] === "#" || this.mask[row][col] === "%") break;
        cells.push([row, col]);
      }
      if (cells.length >= 2) runs.push({ r: cells[0][0], c: cells[0][1], cells, direction });
      offset += 1;
    }
    return runs;
  }

  runs(changed: readonly ChangedCell[] = []): MaskRun[] {
    const rows = new Set(changed.map(([row]) => row));
    const cols = new Set(changed.map(([, col]) => col));
    const horizontal = this.horizontal.flatMap((runs, row) => rows.has(row) ? this.scan(row, "right") : runs);
    const vertical = this.vertical.flatMap((runs, col) => cols.has(col) ? this.scan(col, "down") : runs);
    // The legacy scanner orders vertical starts row-first, not column-first.
    vertical.sort((a, b) => a.r - b.r || a.c - b.c);
    return [...horizontal, ...vertical];
  }

  commit(changed: readonly ChangedCell[]): void {
    for (const row of new Set(changed.map(([row]) => row))) this.horizontal[row] = this.scan(row, "right");
    for (const col of new Set(changed.map(([, col]) => col))) this.vertical[col] = this.scan(col, "down");
  }
}

/** Every geometric run is mandatory; none may be discarded to obtain coverage. */
export function selectConnectedRuns(mask: Cell[][], input: readonly MaskRun[]): { runs: MaskRun[]; intersections: number; intersectionSum: number; valid: boolean } | null {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const runs = [...input];
  if (runs.some((run) => run.cells.length > 11) || runs.filter((run) => run.cells.length === 2).length > 1) return null;
  const horizontal = new Int32Array(rows * cols).fill(-1);
  const vertical = new Int32Array(rows * cols).fill(-1);
  runs.forEach((run, id) => {
    const membership = run.direction === "right" ? horizontal : vertical;
    for (const [row, col] of run.cells) membership[row * cols + col] = id;
  });
  const counts = new Int32Array(runs.length);
  for (let cell = 0; cell < horizontal.length; cell += 1) if (horizontal[cell] >= 0 && vertical[cell] >= 0) {
    counts[horizontal[cell]] += 1;
    counts[vertical[cell]] += 1;
  }
  if (!runs.length || counts.some((count) => count < 2)) return null;
  const seen = new Uint8Array(runs.length);
  const queue = [0];
  seen[0] = 1;
  for (let index = 0; index < queue.length; index += 1) {
    const run = runs[queue[index]];
    const opposite = run.direction === "right" ? vertical : horizontal;
    for (const [row, col] of run.cells) {
      const next = opposite[row * cols + col];
      if (next < 0 || seen[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  if (queue.length !== runs.length) return null;
  let intersections = 0;
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    const cell = row * cols + col;
    const inH = horizontal[cell] >= 0; const inV = vertical[cell] >= 0;
    if (mask[row][col] !== "#" && mask[row][col] !== "%" && !inH && !inV) return null;
    if (inH && inV) intersections += 1;
  }
  return { runs, intersections, intersectionSum: intersections * 2, valid: true };
}
