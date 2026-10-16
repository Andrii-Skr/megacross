import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { generateStructuralCandidate, SeededRandom } from "../src/templateGenerator/generator";
import { createGenerationControl, generateNativeCandidate, releaseGenerationControl } from "../src/templateGenerator/nativeGenerator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import { CUTOUT_PRESETS, type TemplateGenerationRequest } from "../src/templateGenerator/types";

// Compare equal work, not two different stochastic outcomes. No database or word solver.
const fixtures: TemplateGenerationRequest[] = Array.from({ length: 20 }, (_, i) => ({
  rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto", count: 0 },
  cutoutPresetId: CUTOUT_PRESETS[i % CUTOUT_PRESETS.length], seed: `rust-control-${i}`,
}));
fixtures.push(
  { rows: 19, cols: 14, resultCount: 1, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "corner", seed: "quality-picture" },
  { rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto", count: 4 }, cutoutPresetId: "none", seed: "quality-23" },
  { rows: 21, cols: 25, resultCount: 1, pictures: { mode: "manual", items: [{ width: 4, height: 5 }] }, cutoutPresetId: "center-window", seed: "rust-manual" },
  { rows: 40, cols: 40, resultCount: 1, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "corner", seed: "rust-maximum" },
);
const selected = process.argv.includes("--quick") ? fixtures.slice(0, 3) : fixtures;
const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
let tsMs = 0; let rustMs = 0; let found = 0; let regionalMoves = 0;
for (const [ordinal, request] of selected.entries()) {
  const budget = request.rows === 40 ? 1 : 6;
  const initial = new SeededRandom(request.seed!).position;
  const reference = () => {
    const rng = new SeededRandom(request.seed!, initial);
    const started = performance.now();
    const candidate = generateStructuralCandidate(request, rng, new Set(), budget, weights, { dictionaryCounts: DEFAULT_DICTIONARY_COUNTS });
    return { candidate, rngPosition: rng.position, ms: performance.now() - started };
  };
  const rust = () => {
    const control = createGenerationControl();
    try {
      const started = performance.now();
      const result = generateNativeCandidate({ request, rngPosition: initial, fingerprints: [], weights, dictionaryCounts: DEFAULT_DICTIONARY_COUNTS, attemptBudget: budget }, control);
      return { ...result, ms: performance.now() - started };
    } finally { releaseGenerationControl(control); }
  };
  // Alternate order to reduce systematic warmup/thermal bias.
  const pair = ordinal % 2 ? (() => { const native = rust(); return [reference(), native] as const; })() : [reference(), rust()] as const;
  const [ts, native] = pair;
  assert.equal(native.rngPosition, ts.rngPosition, `random trajectory changed: ${request.seed}`);
  assert.equal(native.candidate?.fingerprint, ts.candidate?.fingerprint, `geometry changed: ${request.seed}`);
  if (ts.candidate && native.candidate) {
    assert.deepEqual(native.candidate.fsh, ts.candidate.fsh, `FSH changed: ${request.seed}`);
    assert.ok(Math.abs(native.candidate.metrics.qualityScore! - ts.candidate.metrics.qualityScore!) < 1e-10);
    found += 1; regionalMoves += native.candidate.metrics.regionalRepairCount ?? 0;
  }
  tsMs += ts.ms; rustMs += native.ms;
  console.log(JSON.stringify({ seed: request.seed, rows: request.rows, cols: request.cols, preset: request.cutoutPresetId, found: Boolean(native.candidate), tsMs: Math.round(ts.ms), rustMs: Math.round(native.ms), speedup: Number((ts.ms / native.ms).toFixed(2)) }));
}
console.log(JSON.stringify({ cases: selected.length, found, regionalMoves, tsMs: Math.round(tsMs), rustMs: Math.round(rustMs), speedup: Number((tsMs / rustMs).toFixed(2)), trajectoryAndFshParity: true }));
