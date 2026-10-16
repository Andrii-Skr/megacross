import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { generateStructuralCandidate, SeededRandom } from "../src/templateGenerator/generator";
import { cancelGeneration, createGenerationControl, generateNativeCandidate, releaseGenerationControl, TEMPLATE_NATIVE_ARROWS } from "../src/templateGenerator/nativeGenerator";
import { CUTOUT_PRESETS } from "../src/templateGenerator/types";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";

const request = { rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto" as const, count: 0 }, cutoutPresetId: "none" as const, seed: "profile-15-11" };
const input = { request, rngPosition: new SeededRandom(request.seed).position, fingerprints: [], weights: calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS), dictionaryCounts: { ...DEFAULT_DICTIONARY_COUNTS } };
const first = createGenerationControl();
try {
  const a = generateNativeCandidate(input, first);
  const b = generateNativeCandidate(input, first);
  assert.ok(a.candidate);
  assert.equal(a.candidate.metrics.generationEngine, "rust");
  assert.deepEqual(a, b, "same native seed must reproduce bytes, metrics and random state");
  assert.throws(() => generateNativeCandidate({ ...input, attemptBudget: 5001 }, first), /budget/);
  const timed = generateNativeCandidate({ ...input, request: { ...request, rows: 40, cols: 40 }, attemptBudget: 5000, poolSize: 150, maxMs: 5 }, first);
  assert.ok(timed.stopped, "native deadline must stop computation cooperatively");
  for (const options of [{ regionalRepair: false, adaptiveSearch: false }, { regionalRepair: true, adaptiveSearch: true }]) {
    const rng = new SeededRandom("parity-3");
    const native = generateNativeCandidate({ ...input, request: { ...request, seed: "parity-3" }, rngPosition: rng.position, ...options }, first);
    const reference = generateStructuralCandidate({ ...request, seed: "parity-3" }, rng, new Set(), 6, input.weights, { dictionaryCounts: input.dictionaryCounts, ...options });
    assert.equal(native.rngPosition, rng.position);
    assert.equal(native.candidate?.fingerprint, reference?.fingerprint);
  }
  const presets = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    const fixture = { ...request, cutoutPresetId: CUTOUT_PRESETS[i % CUTOUT_PRESETS.length], seed: `rust-control-${i}` };
    const result = generateNativeCandidate({ ...input, request: fixture, rngPosition: new SeededRandom(fixture.seed).position }, first);
    if (result.candidate) presets.add(fixture.cutoutPresetId);
  }
  assert.equal(presets.size, CUTOUT_PRESETS.length, "all cutouts must pass independent native-result validation");
  const manual = { ...request, rows: 19, cols: 14, pictures: { mode: "manual" as const, items: [{ width: 5, height: 4 }] }, cutoutPresetId: "corner" as const, seed: "quality-picture" };
  const manualResult = generateNativeCandidate({ ...input, request: manual, rngPosition: new SeededRandom(manual.seed).position, attemptBudget: 40 }, first);
  assert.ok(manualResult.candidate);
  assert.equal(manualResult.candidate.metrics.pictureBounds[0].width, 5);
  assert.equal(manualResult.candidate.metrics.pictureBounds[0].height, 4);
  cancelGeneration(first);
  const cancelled = generateNativeCandidate(input, first);
  assert.equal(cancelled.candidate, null);
  assert.ok(cancelled.stopped);
  assert.equal(cancelled.rngPosition, input.rngPosition);
} finally { releaseGenerationControl(first); }
assert.throws(() => generateNativeCandidate(input, first), /cancelled/);

// Start native work in a second Node isolate, then cancel it from the main one.
// A running acknowledgement excludes the easier case of cancelling during bootstrap.
const control = createGenerationControl();
const nativePath = process.env.CROSS_TEMPLATE_NATIVE_PATH || fileURLToPath(new URL("../native/template-generator/template_generator.node", import.meta.url));
const worker = new Worker(`
const { parentPort, workerData } = require('node:worker_threads');
const native = require(workerData.nativePath);
parentPort.on('message', json => {
 parentPort.postMessage({ running: true });
 const result = JSON.parse(native.generateTemplate(json, workerData.control));
 parentPort.postMessage(result);
});
parentPort.postMessage({ ready: true });
`, { eval: true, workerData: { nativePath, control } });
let started = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let safety: ReturnType<typeof setTimeout> | undefined;
try {
  const result = await new Promise<{ stopped: boolean; rngPosition: number }>((resolve, reject) => {
    safety = setTimeout(() => { cancelGeneration(control); reject(new Error("active native cancellation timed out")); }, 3000);
    worker.once("error", reject);
    worker.on("message", (message: { ready?: boolean; running?: boolean; stopped: boolean; rngPosition: number }) => {
      if (message.ready) worker.postMessage(JSON.stringify({ ...input, request: { ...request, rows: 40, cols: 40 }, attemptBudget: 5000, poolSize: 150, maxMs: 5000, arrows: TEMPLATE_NATIVE_ARROWS }));
      else if (message.running) { started = performance.now(); timer = setTimeout(() => cancelGeneration(control), 20); }
      else resolve(message);
    });
  });
  assert.ok(result.stopped);
  assert.notEqual(result.rngPosition, input.rngPosition, "native generation must have actually started");
  assert.ok(performance.now() - started < 1500, "cancellation must finish before the native 5-second deadline");
} finally {
  clearTimeout(timer); clearTimeout(safety);
  cancelGeneration(control); releaseGenerationControl(control);
  await worker.terminate();
}
console.log("Rust generator: deterministic, independently validated, deadline-limited, and cancellable during active native work");
