import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CLUE_MAP, CLUE_POSITION_OFFSETS, DIRS, parseFshBytes, scanSlotsDetailed } from "@megacross/cross-format";
import { generateStructuralCandidate, recognizePictureBounds, SeededRandom } from "../src/templateGenerator/generator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import type { Grid } from "../src/types";

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile() && file.toLowerCase().endsWith(".fsh")) yield file;
  }
}

function audit(grid: Grid) {
  const slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 1 }).slots;
  const clueRefs = new Map<string, number>();
  const badRefs: string[] = [];
  for (const slot of slots) {
    const code = grid.codes[slot.r]?.[slot.c] ?? 0;
    const entry = (CLUE_MAP[code] ?? []).find((item) => item.dirKey === (slot.dir === DIRS.right ? 6 : 8));
    if (!entry) { badRefs.push(`${slot.r},${slot.c}`); continue; }
    const [dr, dc] = CLUE_POSITION_OFFSETS[entry.cluePos] ?? [0, 0];
    const row = slot.r + dr;
    const col = slot.c + dc;
    if (grid.data[row]?.[col] !== "#") { badRefs.push(`${row},${col}`); continue; }
    const key = `${row},${col}`;
    clueRefs.set(key, (clueRefs.get(key) ?? 0) + 1);
  }
  const pictures = recognizePictureBounds(grid);
  const photoCells = new Set<string>();
  const photoRefs: number[] = [];
  for (const picture of pictures) {
    let count = 0;
    for (let row = picture.row; row < picture.row + picture.height; row += 1) for (let col = picture.col; col < picture.col + picture.width; col += 1) {
      const key = `${row},${col}`;
      photoCells.add(key);
      count += clueRefs.get(key) ?? 0;
    }
    photoRefs.push(count);
  }
  const ordinaryRefs: number[] = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    const key = `${row},${col}`;
    if (grid.data[row][col] === "#" && !photoCells.has(key)) ordinaryRefs.push(clueRefs.get(key) ?? 0);
  }
  const dualArrows = grid.codes.flat().filter((code) => {
    const entries = CLUE_MAP[code] ?? [];
    return entries.length === 2 && entries.every((entry) => entry.dirKey === 6 || entry.dirKey === 8);
  }).length;
  const diagonalSingles = grid.codes.flat().filter((code) => code === 0x07).length;
  const unknownDoubleCodes = grid.codes.flat().filter((code) => code === 0x2f).length;
  const upDirectionDoubleCodes = grid.codes.flat().filter((code) => code === 0x2a).length;
  return {
    rows: grid.rows, cols: grid.cols, slots: slots.length, ordinary: ordinaryRefs.length,
    ordinaryZero: ordinaryRefs.filter((count) => count === 0).length,
    ordinaryOne: ordinaryRefs.filter((count) => count === 1).length,
    ordinaryMany: ordinaryRefs.filter((count) => count > 1).length,
    photoCount: pictures.length, photoRefs, dualArrows, diagonalSingles, unknownDoubleCodes, upDirectionDoubleCodes, badRefs: badRefs.length,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * share)] ?? 0;
}

const corpus = [] as ReturnType<typeof audit>[];
for await (const file of walk(path.resolve("../../temp"))) {
  try {
    const grid = parseFshBytes(await readFile(file));
    if (grid.templateTypeCode === "2") corpus.push(audit(grid));
  } catch { /* malformed and non-scanword templates are excluded */ }
}
const generated = [] as ReturnType<typeof audit>[];
const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
const generatedCount = Number(process.env.CROSS_TEMPLATE_AUDIT_GENERATED ?? 0);
for (let index = 0; index < generatedCount; index += 1) {
  const request = { rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto" as const, count: index % 3 }, cutoutPresetId: "none" as const, seed: `clue-audit-${index}` };
  const candidate = generateStructuralCandidate(request, new SeededRandom(request.seed), new Set(), 2_000, weights);
  if (candidate) generated.push(audit(candidate.grid));
}
for (const [label, items] of [["corpus", corpus], ["generated", generated]] as const) {
  if (!items.length) continue;
  console.log(label, items.length, {
  slots: median(items.map((item) => item.slots)),
  ordinary: median(items.map((item) => item.ordinary)),
  zero: median(items.map((item) => item.ordinaryZero)),
  one: median(items.map((item) => item.ordinaryOne)),
  many: median(items.map((item) => item.ordinaryMany)),
  photos: median(items.map((item) => item.photoCount)),
  photoArrows: median(items.flatMap((item) => item.photoRefs)),
  dualArrows: median(items.map((item) => item.dualArrows)),
  unknownDoubleCodes: items.reduce((sum, item) => sum + item.unknownDoubleCodes, 0),
  upDirectionDoubleCodes: items.reduce((sum, item) => sum + item.upDirectionDoubleCodes, 0),
  badRefs: median(items.map((item) => item.badRefs)),
  });
}
const dimensions = new Map<string, typeof corpus>();
for (const item of corpus) {
  const key = `${item.rows}×${item.cols}`;
  const group = dimensions.get(key) ?? [];
  group.push(item);
  dimensions.set(key, group);
}
console.log("double-arrow profile by dimensions", [...dimensions.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 20)
  .map(([size, items]) => ({
    size, count: items.length, medianSlots: median(items.map((item) => item.slots)),
    doublesP25: percentile(items.map((item) => item.dualArrows), 0.25),
    doublesMedian: median(items.map((item) => item.dualArrows)),
    doublesP75: percentile(items.map((item) => item.dualArrows), 0.75),
    doublesP90: percentile(items.map((item) => item.dualArrows), 0.9),
    diagonalSinglesMedian: median(items.map((item) => item.diagonalSingles)),
    doublesPer100SlotsMedian: percentile(items.map((item) => 100 * item.dualArrows / Math.max(1, item.slots)), 0.5).toFixed(1),
  })));
console.log("photo split", [...dimensions.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 8)
  .flatMap(([size, items]) => [
    { size, kind: "no-photo", items: items.filter((item) => item.photoCount === 0) },
    { size, kind: "with-photo", items: items.filter((item) => item.photoCount > 0) },
  ])
  .filter((group) => group.items.length >= 5)
  .map((group) => ({
    size: group.size, kind: group.kind, count: group.items.length,
    medianSlots: median(group.items.map((item) => item.slots)),
    medianDoubles: median(group.items.map((item) => item.dualArrows)),
  })));
