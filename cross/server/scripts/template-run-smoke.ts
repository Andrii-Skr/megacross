import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markerFor } from "@megacross/cross-format";
import type { Cell, Grid } from "../src/types";
import { assignArrows, buildSolverRows, maximalRuns, repairStructuralMask, SeededRandom, slotsForSolver, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { MaskRunIndex } from "../src/templateGenerator/topology";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import { createGenerationControl, generateNativeCandidate, releaseGenerationControl } from "../src/templateGenerator/nativeGenerator";
import { calculateLengthWeights, countDictionaryByLength } from "../src/templateGenerator/weights";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/template-runs.json", import.meta.url), "utf8")) as {
  cases: Array<{ name: string; mask: string[]; codes: number[][]; valid: boolean }>;
};
for (const fixture of fixtures.cases) {
  const grid: Grid = { rows: fixture.mask.length, cols: fixture.mask[0].length,
    marker: markerFor(fixture.mask.length, fixture.mask[0].length, 2), formatVersion: 2,
    data: fixture.mask, codes: fixture.codes };
  const report = verifyTemplateInvariants(grid);
  assert.equal(report.valid, fixture.valid, `${fixture.name}: ${report.errors.join(", ")}`);
  if (fixture.name === "vertical-gap-covered-by-horizontal-words") {
    assert.ok(report.errors.includes("letter run at 1,2 direction down length 3 has no complete word"));
    assert.ok(!report.errors.some((error) => error.includes("not covered")), "perpendicular coverage must not hide the missing word");
  }
  if (fixture.name.includes("two-cell-gap")) assert.ok(report.errors.some((error) => /length 2 has no complete word/u.test(error)));
  const mask = grid.data.map((row) => [...row].map((cell) => cell === "#" || cell === "%" ? cell : "*") as Cell[]);
  const assigned = assignArrows(mask);
  if (fixture.valid) assert.ok(assigned && verifyTemplateInvariants(assigned).valid);
  if (fixture.name === "multiple-two-letter-runs" || fixture.name === "overlong-run") assert.equal(assigned, null);
  const index = new MaskRunIndex(mask);
  const scan = () => [...maximalRuns(mask, "right").map((run) => ({ ...run, direction: "right" })),
    ...maximalRuns(mask, "down").map((run) => ({ ...run, direction: "down" }))];
  assert.deepEqual(index.runs(), scan());
  const before = mask[1][1];
  mask[1][1] = before === "#" ? "*" : "#";
  assert.deepEqual(index.runs([[1, 1]]), scan(), "trial must rescan both directions, including two-cell and overlong runs");
  mask[1][1] = before;
  assert.deepEqual(index.runs(), scan(), "rollback preserves the committed index");
  mask[1][1] = before === "#" ? "*" : "#";
  index.commit([[1, 1]]);
  assert.deepEqual(index.runs(), scan());
}
// A surplus of geometric two-letter runs must be repaired, never hidden.
for (const rows of [
  ["#####", "#***#", "#***#", "#####"],
  ["##############", "#************#", "#************#", "#************#", "##############"],
]) {
  const repairMask = rows.map((row) => [...row] as Cell[]);
  assert.equal(assignArrows(repairMask), null);
  assert.ok(repairStructuralMask(repairMask, [], new SeededRandom("run-repair")));
  const repaired = assignArrows(repairMask);
  assert.ok(repaired && verifyTemplateInvariants(repaired).valid);
}
console.log(`Mandatory runs: ${fixtures.cases.length} shared TypeScript/Rust fixtures passed`);

if (process.argv.includes("--fill")) {
  const { loadDictionary } = await import("../src/services/dictionary");
  const { solveCspNativeAsync } = await import("../src/utils/nativeDlx");
  const dictionary = await loadDictionary({ langCode: "ru", lengths: Array.from({ length: 10 }, (_, i) => i + 2) });
  assert.ok(dictionary.size, "integration check requires the configured Russian dictionary");
  const counts = countDictionaryByLength(dictionary);
  const control = createGenerationControl();
  const started = performance.now();
  let accepted = 0;
  try {
    for (let attempt = 0; attempt < 10 && accepted < 2; attempt += 1) {
      const seed = `mandatory-runs-fill-${attempt}`;
      const request = accepted === 0
        ? { rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto" as const, count: 0 }, cutoutPresetId: "none" as const, seed }
        : { rows: 19, cols: 14, resultCount: 1, pictures: { mode: "manual" as const, items: [{ width: 5, height: 4 }] }, cutoutPresetId: "corner" as const, seed };
      const { candidate } = generateNativeCandidate({ request, rngPosition: new SeededRandom(seed).position,
        fingerprints: [], weights: calculateLengthWeights(counts), dictionaryCounts: counts, attemptBudget: 40, maxMs: 10000 }, control);
      if (!candidate) continue;
      assert.ok(verifyTemplateInvariants(candidate.grid).valid);
      assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
      const slots = slotsForSolver(candidate.grid);
      const solved = await solveCspNativeAsync(buildSolverRows(candidate.grid), slots, dictionary, {
        uniqueWords: true, firstSolution: true, searchPortfolio: true, shuffle: true,
        seed: attempt, lcv: true, restarts: 2, parallelRestarts: 2, maxMs: 10000, maxNodes: 2000000,
      });
      console.log(JSON.stringify({ attempt, generated: true, filled: !!solved, slots: slots.length }));
      if (!solved) continue;
      const words = slots.map((slot) => slot.cells.map(([r, c]) => solved[r][c]).join(""));
      assert.equal(new Set(words).size, words.length);
      for (const word of words) assert.ok(dictionary.get(word.length)?.includes(word));
      accepted += 1;
    }
    assert.equal(accepted, 2, "two generated templates must have complete unique dictionary fills");
    console.log(JSON.stringify({ accepted, ms: Math.round(performance.now() - started), dictionaryVerified: true }));
  } finally { releaseGenerationControl(control); }
}
