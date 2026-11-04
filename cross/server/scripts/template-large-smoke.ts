import assert from "node:assert/strict";
import { SeededRandom, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import { createGenerationControl, generateNativeCandidate, releaseGenerationControl } from "../src/templateGenerator/nativeGenerator";
import { calculateLengthWeights, templateSupplyDeficit } from "../src/templateGenerator/weights";
import type { TemplateGenerationRequest } from "../src/templateGenerator/types";

// Read-only geometry replay of three real 23×31 requests. Counts reproduce the
// selected dictionary's supply; no database access or saved results are needed.
// This checks structure and length supply, not a completed dictionary fill.
const dictionaryCounts = { 2: 96, 3: 721, 4: 1979, 5: 3393, 6: 3817, 7: 3497, 8: 2758, 9: 2041, 10: 1323, 11: 996 };
const weights = calculateLengthWeights(dictionaryCounts);
const fixtures: TemplateGenerationRequest[] = [
  { rows: 23, cols: 31, resultCount: 4, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "none", seed: "0236d89594bd1609647d12b3" },
  { rows: 23, cols: 31, resultCount: 4, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "none", seed: "9296e1fe0d6d5bf2d091cfb7" },
  { rows: 23, cols: 31, resultCount: 4, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "none", seed: "021b3338064faa5811b58ab8" },
];
const maxMs = Number(process.argv.find((arg) => arg.startsWith("--max-ms="))?.split("=")[1] ?? 30000);
assert.ok(Number.isFinite(maxMs) && maxMs > 0);
const reportOnly = process.argv.includes("--report-only");
const control = createGenerationControl();
try {
  for (const request of fixtures) {
    const started = performance.now();
    const result = generateNativeCandidate({ request, rngPosition: new SeededRandom(request.seed!).position,
      fingerprints: [], weights, dictionaryCounts, attemptBudget: 40, poolSize: 1, maxMs }, control);
    console.log(JSON.stringify({ seed: request.seed, rows: request.rows, cols: request.cols,
      ms: Math.round(performance.now() - started), found: !!result.candidate, stopped: result.stopped,
      geometryVerified: !!result.candidate, dictionaryVerified: false, diagnostics: result.diagnostics }));
    if (!reportOnly) assert.ok(result.candidate, `23×31 regression must produce a valid grid: ${request.seed}`);
    if (!result.candidate) continue;
    const { candidate } = result;
    const report = verifyTemplateInvariants(candidate.grid);
    assert.ok(report.valid, report.errors.join(", "));
    assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
    assert.equal(templateSupplyDeficit(report.lengthDistribution, report.slotCount, dictionaryCounts, weights), 0);
    assert.equal(candidate.metrics.pictureBounds.length, request.pictures.mode === "auto" ? request.pictures.count : request.pictures.items.length);
  }
} finally { releaseGenerationControl(control); }
