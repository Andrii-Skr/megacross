import assert from "node:assert/strict";
import { generateStructuralCandidate, SeededRandom, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { searchStructure } from "../src/templateGenerator/structureSearch";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../src/templateGenerator/weights";

const request = { rows: 15, cols: 11, resultCount: 1, pictures: { mode: "auto" as const, count: 0 }, cutoutPresetId: "none" as const, seed: "profile-15-11" };
const input = { request, rngPosition: new SeededRandom(request.seed).position, fingerprints: [], weights: calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS), dictionaryCounts: { ...DEFAULT_DICTIONARY_COUNTS } };
let ticks = 0;
const interval = setInterval(() => { ticks += 1; }, 5);
let result: Awaited<ReturnType<typeof searchStructure>>;
try { result = await searchStructure(input, new AbortController().signal); }
finally { clearInterval(interval); }
assert.ok(ticks > 0, "structure search must leave the API event loop responsive");
assert.ok(result.candidate);
assert.ok(verifyTemplateInvariants(result.candidate.grid).valid);
const first = generateStructuralCandidate(request, new SeededRandom(request.seed), new Set(), 20, input.weights, { dictionaryCounts: input.dictionaryCounts });
assert.ok(first);
assert.ok(result.candidate.metrics.qualityScore! <= first.metrics.qualityScore!, "shortlist must not score worse than its first candidate");
const timedOut = await searchStructure({ ...input, maxMs: 1 }, new AbortController().signal);
assert.equal(timedOut.candidate, null);
const cancelled = new AbortController();
const pending = searchStructure({ ...input, request: { ...request, rows: 40, cols: 40 } }, cancelled.signal);
setTimeout(() => cancelled.abort(), 20);
await assert.rejects(pending, /cancelled/);
console.log("structure worker: responsive, ranked, deadline-limited and cancellable");
