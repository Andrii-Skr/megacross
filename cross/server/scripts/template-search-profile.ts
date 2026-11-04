import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SeededRandom } from "../src/templateGenerator/generator";
import { createGenerationControl, generateNativeCandidate, releaseGenerationControl } from "../src/templateGenerator/nativeGenerator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";
import type { TemplateGenerationRequest } from "../src/templateGenerator/types";

const scenarios: TemplateGenerationRequest[] = [
  { rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "none", seed: "profile-15-11" },
  { rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "center-window", seed: "rust-control-6" },
  { rows: 19, cols: 14, resultCount: 1, pictures: { mode: "manual", items: [{ width: 5, height: 4 }] }, cutoutPresetId: "corner", seed: "quality-picture" },
  { rows: 23, cols: 27, resultCount: 1, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "center-window", seed: "property-6" },
  { rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "corner", seed: "double-test" },
  { rows: 23, cols: 31, resultCount: 1, pictures: { mode: "auto", count: 0 }, cutoutPresetId: "none", seed: "double-23-31" },
];
const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
const typescript = process.argv.includes("--typescript");
const reference = typescript ? await import(process.env.CROSS_TEMPLATE_TS_MODULE ?? "../src/templateGenerator/generator") : undefined;
const attempts = Number(process.argv.find((arg) => arg.startsWith("--attempts="))?.split("=")[1] ?? 6);
assert.ok(Number.isInteger(attempts) && attempts >= 1 && attempts <= 100);
const control = typescript ? undefined : createGenerationControl();
try {
  for (const request of process.argv.includes("--quick") ? scenarios.slice(0, 3) : scenarios) {
    const started = performance.now();
    const diagnostics: Record<string, number> = {};
    const rng = new SeededRandom(request.seed!);
    const result = reference
      ? { candidate: reference.generateStructuralCandidate(request, rng, new Set(), attempts, weights, { diagnostics }), rngPosition: rng.position, diagnostics, stopped: false }
      : generateNativeCandidate({ request, rngPosition: rng.position, fingerprints: [], weights, attemptBudget: attempts, poolSize: 1, profile: true }, control!);
    assert.ok(!result.stopped);
    console.log(JSON.stringify({ seed: request.seed, ms: Math.round(performance.now() - started),
      found: !!result.candidate, fingerprint: result.candidate?.fingerprint,
      fshHash: result.candidate ? createHash("sha256").update(result.candidate.fsh).digest("hex") : undefined,
      quality: result.candidate?.metrics.qualityScore, rngPosition: result.rngPosition, diagnostics: result.diagnostics }));
  }
} finally { if (control !== undefined) releaseGenerationControl(control); }
