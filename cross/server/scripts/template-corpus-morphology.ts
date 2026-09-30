import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFshBytes } from "@megacross/cross-format";
import { generateStructuralCandidate, SeededRandom } from "../src/templateGenerator/generator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import type { Grid } from "../src/types";

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile() && file.toLowerCase().endsWith(".fsh")) yield file;
  }
}

function morphology(grid: Grid) {
  const seen = new Set<string>();
  const components: number[] = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    const key = `${row},${col}`;
    if (grid.data[row][col] !== "#" || seen.has(key)) continue;
    const queue: Array<[number, number]> = [[row, col]];
    seen.add(key);
    for (let index = 0; index < queue.length; index += 1) {
      const [r, c] = queue[index];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const rr = r + dr;
        const cc = c + dc;
        const neighbor = `${rr},${cc}`;
        if (rr < 0 || cc < 0 || rr >= grid.rows || cc >= grid.cols || grid.data[rr][cc] !== "#" || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push([rr, cc]);
      }
    }
    components.push(queue.length);
  }
  const edge = [...grid.data[0], ...grid.data[grid.rows - 1]];
  for (let row = 1; row < grid.rows - 1; row += 1) edge.push(grid.data[row][0], grid.data[row][grid.cols - 1]);
  const clueCells = components.filter((size) => size < 16).reduce((sum, size) => sum + size, 0);
  return {
    rows: grid.rows,
    cols: grid.cols,
    isolatedShare: clueCells ? components.filter((size) => size === 1).length / clueCells : 0,
    groupedShare: clueCells ? components.filter((size) => size >= 2 && size < 16).reduce((sum, size) => sum + size, 0) / clueCells : 0,
    edgeBlockedShare: edge.filter((cell) => cell === "#").length / edge.length,
    firstRowBlockedShare: [...grid.data[0]].filter((cell) => cell === "#").length / grid.cols,
    lastRowBlockedShare: [...grid.data[grid.rows - 1]].filter((cell) => cell === "#").length / grid.cols,
    firstColBlockedShare: grid.data.filter((row) => row[0] === "#").length / grid.rows,
    lastColBlockedShare: grid.data.filter((row) => row[grid.cols - 1] === "#").length / grid.rows,
    blockedShare: grid.data.join("").split("").filter((cell) => cell === "#").length / (grid.rows * grid.cols),
    componentSizes: components,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function range(values: number[]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[Math.floor(sorted.length * 0.1)] ?? 0, sorted[Math.floor(sorted.length * 0.9)] ?? 0];
}

const corpus = [] as ReturnType<typeof morphology>[];
const dimensions = new Map<string, number>();
const examples = new Map<string, string[]>();
for await (const file of walk(path.resolve("../../temp"))) {
  try {
    const grid = parseFshBytes(await readFile(file));
    if (grid.templateTypeCode !== "2") continue;
    corpus.push(morphology(grid));
    const key = `${grid.rows}×${grid.cols}`;
    dimensions.set(key, (dimensions.get(key) ?? 0) + 1);
    const paths = examples.get(key) ?? [];
    if (paths.length < 2) paths.push(file);
    examples.set(key, paths);
  } catch { /* some FSH files are malformed or other template types */ }
}
const generated = [] as ReturnType<typeof morphology>[];
const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
for (let index = 0; index < 20; index += 1) {
  const request = { rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto" as const, count: index % 3 }, cutoutPresetId: "none" as const, seed: `morphology-${index}` };
  const candidate = generateStructuralCandidate(request, new SeededRandom(request.seed), new Set(), 2_000, weights);
  if (candidate) generated.push(morphology(candidate.grid));
}
for (const [label, items] of [["corpus", corpus], ["generated", generated]] as const) {
  console.log(label, items.length, {
    isolatedShare: median(items.map((item) => item.isolatedShare)),
    groupedShare: median(items.map((item) => item.groupedShare)),
    edgeBlockedShare: median(items.map((item) => item.edgeBlockedShare)),
    firstRowBlockedShare: median(items.map((item) => item.firstRowBlockedShare)),
    lastRowBlockedShare: median(items.map((item) => item.lastRowBlockedShare)),
    firstColBlockedShare: median(items.map((item) => item.firstColBlockedShare)),
    lastColBlockedShare: median(items.map((item) => item.lastColBlockedShare)),
    blockedShare: median(items.map((item) => item.blockedShare)),
    isolatedRange: range(items.map((item) => item.isolatedShare)),
    edgeRange: range(items.map((item) => item.edgeBlockedShare)),
  });
}
console.log("dimensions", [...dimensions].sort((a, b) => b[1] - a[1]).slice(0, 12));
for (const dimension of ["15×11", "19×14", "22×16", "22×12", "16×16", "19×10", "15×7", "14×14", "19×21"]) {
  const items = corpus.filter((item) => `${item.rows}×${item.cols}` === dimension);
  console.log(dimension, items.length, {
    isolatedShare: median(items.map((item) => item.isolatedShare)),
    edgeBlockedShare: median(items.map((item) => item.edgeBlockedShare)),
    firstRowBlockedShare: median(items.map((item) => item.firstRowBlockedShare)),
    firstColBlockedShare: median(items.map((item) => item.firstColBlockedShare)),
    groupSizes: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((size) => [size, items.reduce((sum, item) => sum + item.componentSizes.filter((value) => value === size).length, 0)])),
    examples: examples.get(dimension),
  });
}
