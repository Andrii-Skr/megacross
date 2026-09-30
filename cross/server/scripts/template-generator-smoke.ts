import assert from "node:assert/strict";
import { arrowCellForCode, buildFsh, CLUE_MAP, findArrowCode, markerFor, parseFshBytes, scanSlotsDetailed } from "@megacross/cross-format";
import type { Grid } from "../src/types";
import { assignArrows, buildCutout, buildMask, generateStructuralCandidate, recognizePictureBounds, SeededRandom, targetDoubleArrowCount, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import { buildCrw } from "../src/utils/writeCrw";
import { clueAssignmentDiagnostics, verifyClueOwnership } from "../src/templateGenerator/clueMatcher";

const legacy: Grid = {
  rows: 3,
  cols: 4,
  marker: markerFor(3, 4, 1),
  formatVersion: 1,
  templateTypeCode: "2",
  templateType: "scanword",
  data: ["####", "#→**", "####"],
  codes: [[2, 2, 2, 2], [2, 0x18, 1, 1], [2, 2, 2, 2]],
};
const parsedLegacy = parseFshBytes(buildFsh(legacy));
assert.equal(parsedLegacy.marker[0], "2");
assert.deepEqual(parsedLegacy.data, legacy.data);
assert.deepEqual(parsedLegacy.codes, legacy.codes);

const modern: Grid = {
  ...legacy,
  cols: 7,
  marker: markerFor(3, 7, 2),
  formatVersion: 2,
  templateTypeCode: "S",
  data: ["#######", "#→**%**", "#######"],
  codes: [[2, 2, 2, 2, 2, 2, 2], [2, 0x18, 1, 1, 0x25, 1, 1], [2, 2, 2, 2, 2, 2, 2]],
};
const modernBytes = buildFsh(modern);
assert.ok(modernBytes.includes(0x25));
const parsedModern = parseFshBytes(modernBytes);
assert.equal(parsedModern.marker[0], "S");
assert.equal(parsedModern.data[1][4], "%");
assert.equal(scanSlotsDetailed(parsedModern, { mode: "arrow", minLen: 3 }).slots[0]?.len, 3);
const modernSlots = scanSlotsDetailed(parsedModern, { mode: "arrow", minLen: 3 }).slots;
const crw = buildCrw(parsedModern, modernSlots, ["#######", "#АБВ%ГД", "#######"]);
assert.equal(crw.subarray(9, 12).toString("ascii"), parsedModern.marker);
assert.ok(crw.includes(0x25));

for (const code of [...Object.keys(CLUE_MAP).map(Number), 0x2f]) {
  const arrowGrid: Grid = {
    rows: 1,
    cols: 1,
    marker: markerFor(1, 1, 2),
    formatVersion: 2,
    data: [arrowCellForCode(code)],
    codes: [[code]],
  };
  const parsed = parseFshBytes(buildFsh(arrowGrid));
  assert.equal(parsed.codes[0][0], code);
  assert.equal(parsed.data[0][0], arrowCellForCode(code));
}

for (const [codeRaw, entries] of Object.entries(CLUE_MAP)) {
  const code = Number(codeRaw);
  const directions = entries.map((entry) => entry.dirKey === 6 ? "right" as const : "down" as const);
  if (directions.length !== new Set(directions).size) continue;
  const rows = Array.from({ length: 3 }, () => "###");
  const grid = { rows: 3, cols: 3, data: rows };
  const resolved = findArrowCode(grid, 1, 1, directions);
  assert.ok(resolved != null, `arrow ${code.toString(16)} has a reverse-compatible shape`);
}

const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
assert.ok(weights[3] < weights[4]);
assert.ok(weights[3] < weights[5]);
assert.ok(weights[3] < weights[6]);
assert.ok(weights[3] < weights[7]);
assert.equal(Object.keys(weights).some((length) => Number(length) < 3 || Number(length) > 11), false);

// The most common FSH dimensions in temp contain roughly 3–4 double starts per 100 answers.
for (const [slotCount, expected] of [[35, 1], [59, 2], [84, 3], [159, 6], [177, 6]] as const) {
  assert.equal(targetDoubleArrowCount(slotCount), expected);
}
for (const [rows, cols, expected] of [[15, 11, 1], [19, 14, 2], [22, 16, 3]] as const) {
  const request = {
    rows, cols, resultCount: 1, pictures: { mode: "auto" as const, count: 0 },
    cutoutPresetId: "none" as const, seed: `profile-${rows}-${cols}`,
  };
  const candidate = generateStructuralCandidate(request, new SeededRandom(request.seed), new Set(), 5_000, weights);
  assert.ok(candidate, `corpus-sized ${rows}×${cols} fixture must be generated`);
  assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
  assert.equal(clueAssignmentDiagnostics(candidate.grid, candidate.metrics.pictureBounds).doubleStarts, expected);
}

const presets = ["none", "corner", "opposite-corners", "edge-bite", "opposite-edge-bites", "stepped-corner", "center-window"] as const;
for (const [rows, cols, expectedCells] of [[11, 15, 9], [14, 19, 16], [23, 31, 36]] as const) {
  const cutout = buildCutout({
    rows, cols, resultCount: 1, pictures: { mode: "auto", count: 0 },
    cutoutPresetId: "corner", seed: `corpus-${rows}`,
  }, new SeededRandom(`corpus-${rows}`));
  assert.equal(cutout.cells.size, expectedCells, `corner mask for ${rows}×${cols} follows the sample scale`);
  assert.ok(["top-left", "top-right", "bottom-left", "bottom-right"].includes(cutout.orientation));
}

const disconnectedBand = Array.from({ length: 23 }, (_, row) => Array.from({ length: 31 }, (_, col) =>
  row === 0 || col === 0 || (row + col) % 5 === 0 ? "#" as const : "*" as const,
));
const originalBand = disconnectedBand.map((row) => row.join(""));
assert.equal(assignArrows(disconnectedBand), null, "disconnected diagonal bands must be rejected");
assert.deepEqual(disconnectedBand.map((row) => row.join("")), originalBand, "arrow assignment must not erase letters");

for (let index = 0; index < presets.length; index += 1) {
  const request = {
    rows: 17 + index,
    cols: 21 + index,
    resultCount: 1,
    pictures: { mode: "auto" as const, count: index % 3 },
    cutoutPresetId: presets[index],
    seed: `property-${index}`,
  };
  const candidate = generateStructuralCandidate(request, new SeededRandom(request.seed), new Set(), 5_000, weights);
  assert.ok(candidate, `candidate generated for ${presets[index]}`);
  const report = verifyTemplateInvariants(candidate.grid);
  assert.equal(report.valid, true, report.errors.join(", "));
  assert.equal(candidate.grid.marker[0], "S");
  assert.equal(candidate.metrics.pictureBounds.length, request.pictures.count);
  assert.deepEqual(recognizePictureBounds(candidate.grid), [...candidate.metrics.pictureBounds].sort((a, b) => a.row - b.row || a.col - b.col));
  assert.ok(Object.keys(candidate.metrics.lengthDistribution).every((length) => Number(length) >= 3 && Number(length) <= 11));
  assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
  console.log(`preset ${presets[index]}: ok`);
}

const fullGridRequest = {
  rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto" as const, count: 1 },
  cutoutPresetId: "corner" as const, seed: "double-test",
};
const mask = buildMask(fullGridRequest, new SeededRandom(fullGridRequest.seed), weights);
assert.ok(mask);
const assigned = assignArrows(mask.mask);
if (assigned) for (let row = 0; row < fullGridRequest.rows; row += 1) for (let col = 0; col < fullGridRequest.cols; col += 1) {
  if (mask.mask[row][col] === "*") assert.notEqual(assigned.data[row][col], "#", "live cells cannot become blocked");
}
const fullCandidate = generateStructuralCandidate(fullGridRequest, new SeededRandom(fullGridRequest.seed), new Set(), 5_000);
assert.ok(fullCandidate, "a full-grid candidate must be generated for the screenshot dimensions");
assert.deepEqual(verifyClueOwnership(fullCandidate.grid, fullCandidate.metrics.pictureBounds), []);
assert.ok(clueAssignmentDiagnostics(fullCandidate.grid, fullCandidate.metrics.pictureBounds).doubleStarts >=
  targetDoubleArrowCount(fullCandidate.metrics.slotCount) - 1,
"large scanword templates should follow the corpus double-arrow profile");
const blockedShare = [...fullCandidate.grid.data.join("")].filter((cell) => cell === "#").length / (fullGridRequest.rows * fullGridRequest.cols);
assert.ok(blockedShare < 0.4, `generated blocked share ${blockedShare.toFixed(3)} exceeds the real sample profile`);

function groupedClueShare(grid: Grid, pictures: readonly { row: number; col: number; width: number; height: number }[] = []): number {
  const photoCells = new Set<string>();
  for (const picture of pictures) for (let row = picture.row; row < picture.row + picture.height; row += 1) {
    for (let col = picture.col; col < picture.col + picture.width; col += 1) photoCells.add(`${row},${col}`);
  }
  const clues: Array<[number, number]> = [];
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    if (grid.data[row][col] === "#" && !photoCells.has(`${row},${col}`)) clues.push([row, col]);
  }
  if (!clues.length) return 0;
  return clues.filter(([row, col]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) =>
    grid.data[row + dr]?.[col + dc] === "#" && !photoCells.has(`${row + dr},${col + dc}`)
  )).length / clues.length;
}
assert.ok(groupedClueShare(fullCandidate.grid, fullCandidate.metrics.pictureBounds) >= 0.25,
  "picture layouts should still group clue cells outside photo areas");
console.log("full-grid double-arrow fixture: ok");

const morphologyRequest = {
  rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto" as const, count: 0 },
  cutoutPresetId: "none" as const, seed: "double-23-31",
};
const morphologyCandidate = generateStructuralCandidate(morphologyRequest, new SeededRandom(morphologyRequest.seed), new Set(), 5_000);
assert.ok(morphologyCandidate);
const morphologyGrid = morphologyCandidate.grid;
assert.ok(groupedClueShare(morphologyGrid) >= 0.25, "clue cells should form groups rather than an isolated checkerboard");
const edgeCells = [
  ...morphologyGrid.data[0], ...morphologyGrid.data[morphologyGrid.rows - 1],
  ...morphologyGrid.data.slice(1, -1).flatMap((row) => [row[0], row[morphologyGrid.cols - 1]]),
];
assert.ok(edgeCells.filter((cell) => cell === "#").length / edgeCells.length < 0.5, "the grid edge cannot remain a grey frame");
assert.ok(morphologyGrid.data[0].includes("↓"), "top edge must contain inward words");
assert.ok(morphologyGrid.data.some((row) => row[0] === "→"), "left edge must contain inward words");
console.log("morphology fixture: ok");

const diversityRequest = {
  rows: 20,
  cols: 20,
  resultCount: process.env.CROSS_TEMPLATE_STRESS ? 150 : 5,
  pictures: { mode: "auto" as const, count: 0 },
  cutoutPresetId: "none" as const,
  seed: "diversity",
};
const diversityRng = new SeededRandom(diversityRequest.seed);
const fingerprints = new Set<string>();
for (let attempt = 0; attempt < (process.env.CROSS_TEMPLATE_STRESS ? 2_000 : 100) && fingerprints.size < diversityRequest.resultCount; attempt += 1) {
  const candidate = generateStructuralCandidate(diversityRequest, diversityRng, fingerprints, 20, weights);
  if (candidate) fingerprints.add(candidate.fingerprint);
}
assert.equal(fingerprints.size, diversityRequest.resultCount, "large jobs need a broad structural search space");

console.log("template-generator smoke: ok");
