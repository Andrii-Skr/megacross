import type { Cell } from "../types";

export type MaskRun = { r: number; c: number; cells: [number, number][]; direction: "right" | "down" };
export type ChangedCell = readonly [number, number];

/** Trial flips only rescan their rows/columns. Committed runs are never mutated. */
export class MaskRunIndex {
  private horizontal: MaskRun[][];
  private vertical: MaskRun[][];

  constructor(private readonly mask: Cell[][], private readonly minLength: number) {
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
      if (cells.length >= this.minLength && cells.length <= 11) runs.push({ r: cells[0][0], c: cells[0][1], cells, direction });
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

/** Same largest eligible component policy as assignArrows, without string graphs. */
export function selectConnectedRuns(mask: Cell[][], input: readonly MaskRun[]): { runs: MaskRun[]; intersections: number; intersectionSum: number; valid: boolean } | null {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  let shortRuns = 0;
  const runs = input.filter((run) => run.cells.length !== 2 || shortRuns++ === 0);
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
  const seen = new Uint8Array(runs.length);
  let largest: number[] = [];
  for (let root = 0; root < runs.length; root += 1) {
    if (counts[root] < 2 || seen[root]) continue;
    const component = [root];
    seen[root] = 1;
    for (let index = 0; index < component.length; index += 1) {
      const run = runs[component[index]];
      const opposite = run.direction === "right" ? vertical : horizontal;
      for (const [row, col] of run.cells) {
        const next = opposite[row * cols + col];
        if (next < 0 || counts[next] < 2 || seen[next]) continue;
        seen[next] = 1;
        component.push(next);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (!largest.length) return null;
  const selected = new Uint8Array(runs.length);
  largest.forEach((id) => { selected[id] = 1; });
  let intersections = 0;
  const selectedCounts = new Int32Array(runs.length);
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    const cell = row * cols + col;
    const h = horizontal[cell]; const v = vertical[cell];
    const inH = h >= 0 && selected[h]; const inV = v >= 0 && selected[v];
    if (mask[row][col] !== "#" && mask[row][col] !== "%" && !inH && !inV) return null;
    if (inH && inV) { intersections += 1; selectedCounts[h] += 1; selectedCounts[v] += 1; }
  }
  // Removing ineligible runs can remove crossings from an otherwise eligible run.
  return { runs: runs.filter((_, id) => selected[id]), intersections, intersectionSum: intersections * 2, valid: largest.every((id) => selectedCounts[id] >= 2) };
}
