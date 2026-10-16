import assert from "node:assert/strict";
import { boundaryDirectionMetrics } from "../src/templateGenerator/boundary";
import { geometryDistance, MIN_GEOMETRY_DISTANCE } from "../src/templateGenerator/diversity";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import { SeededRandom, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { searchStructure } from "../src/templateGenerator/structureSearch";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import type { TemplateGenerationRequest } from "../src/templateGenerator/types";

// Geometry-only benchmark: no database, native word search or persisted jobs.
// Success here certifies geometry/ownership, not dictionary fillability.
const fixtures: TemplateGenerationRequest[] = [
  { rows: 15, cols: 11, resultCount: 2, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "none", seed: "profile-15-11" },
  { rows: 19, cols: 14, resultCount: 2, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "corner", seed: "quality-picture" },
  { rows: 23, cols: 31, resultCount: 2, pictures: { mode: "auto", count: 4 }, cutoutPresetId: "none", seed: "quality-23" },
];
const selected = process.argv.includes("--quick") ? fixtures.slice(0, 1) : process.argv.includes("--large") ? fixtures.slice(2) : fixtures;
for (const request of selected) {
  const controller = new AbortController();
  const started = performance.now();
  const fingerprints: string[] = [];
  let position = new SeededRandom(request.seed!).position;
  const deadline = Date.now() + 240_000;
  try {
    for (let batch = 0; batch < 20 && fingerprints.length < request.resultCount && Date.now() < deadline; batch += 1) {
      const result = await searchStructure({ request, rngPosition: position, fingerprints, weights: calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS), dictionaryCounts: { ...DEFAULT_DICTIONARY_COUNTS }, maxMs: deadline - Date.now() }, controller.signal);
      position = result.rngPosition;
      if (!result.candidate) continue;
      const { candidate } = result;
      const report = verifyTemplateInvariants(candidate.grid);
      assert.ok(report.valid, report.errors.join(", "));
      assert.equal(boundaryDirectionMetrics(candidate.grid, candidate.metrics.pictureBounds).edgeDirectionDeficit, 0);
      assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
      assert.ok(candidate.metrics.qualityScore! <= result.diagnostics!.firstQualityScore);
      const distance = fingerprints.length ? Math.min(...fingerprints.map((f) => geometryDistance(f, candidate.fingerprint))) : null;
      if (distance !== null) assert.ok(distance >= MIN_GEOMETRY_DISTANCE);
      fingerprints.push(candidate.fingerprint);
      console.log(JSON.stringify({ seed: request.seed, result: fingerprints.length, ms: Math.round(performance.now() - started), distance, metrics: candidate.metrics, diagnostics: result.diagnostics }));
    }
    console.log(JSON.stringify({ seed: request.seed, found: fingerprints.length, requested: request.resultCount, ms: Math.round(performance.now() - started) }));
    assert.equal(fingerprints.length, request.resultCount, "geometry benchmark must complete its batch within budget");
  } finally { controller.abort(); }
}
