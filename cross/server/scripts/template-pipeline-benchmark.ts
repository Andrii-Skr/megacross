import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createPrismaClient, Prisma } from "../src/db/prisma";
import { loadDictionaryByTemplate, loadDictionary, type DictionaryFilterTemplate } from "../src/services/dictionary";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import { isDiverseGeometry } from "../src/templateGenerator/diversity";
import { normalizeGenerationRequest, SeededRandom, slotsForSolver, buildSolverRows, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { searchStructure } from "../src/templateGenerator/structureSearch";
import { countDictionaryByLength, calculateLengthWeights } from "../src/templateGenerator/weights";
import { solveCspNativeAsync } from "../src/utils/nativeDlx";
import type { GeneratedTemplate, TemplateGenerationRequest } from "../src/templateGenerator/types";

// Read-only replay: load a job's request/dictionary; never create jobs or save results.
const jobArg = process.argv.indexOf("--job-id");
const jobId = process.argv[jobArg + 1];
if (jobArg < 0 || !/^\d+$/u.test(jobId ?? "")) throw new Error("Usage: template-pipeline-benchmark.ts --job-id ID [--compare-all] [--full-fill-budget]");
const prisma = createPrismaClient();
const started = performance.now();
let request: TemplateGenerationRequest;
let dictionary: Map<number, string[]>;
let baseline: Array<{ qualityScore: number; fingerprint: string }>;
try {
  const [job] = await prisma.$queryRaw<Array<{ parameters: TemplateGenerationRequest }>>(Prisma.sql`SELECT parameters FROM scanword_template_generation_jobs WHERE id=${BigInt(jobId)} LIMIT 1`);
  if (!job) throw new Error("job not found");
  request = normalizeGenerationRequest(job.parameters);
  baseline = await prisma.$queryRaw<Array<{ qualityScore: number; fingerprint: string }>>(Prisma.sql`SELECT fingerprint, (metrics->>'qualityScore')::float AS "qualityScore" FROM scanword_template_generation_results WHERE "jobId"=${BigInt(jobId)} ORDER BY ordinal`);
  const lengths = Array.from({ length: 10 }, (_, i) => i + 2);
  if (request.dictionaryFilterId) {
    const [filter] = await prisma.$queryRaw<DictionaryFilterTemplate[]>(Prisma.sql`SELECT * FROM dictionary_filter_templates WHERE id=${request.dictionaryFilterId} AND is_deleted=false LIMIT 1`);
    if (!filter) throw new Error("dictionary filter not found");
    dictionary = await loadDictionaryByTemplate(filter, { lengths });
  } else dictionary = await loadDictionary({ langCode: "ru", lengths });
} finally { await prisma.$disconnect(); }
const counts = countDictionaryByLength(dictionary), weights = calculateLengthWeights(counts), entries = [...dictionary];
const controller = new AbortController();
const fingerprints = new Set<string>(), diversity: string[] = [], candidates: GeneratedTemplate[] = [];
const deferred: Array<{ candidate: GeneratedTemplate; seed: number; remainingMs: number }> = [];
const totals = { geometryMs: 0, precheckMs: 0, solverMs: 0, evaluations: 0, earlyStops: 0, precheckIncomplete: 0, solverChecks: 0, searchCalls: 0 };
const probeMs = process.argv.includes("--full-fill-budget") ? 30000 : 2500;
const deadline = Date.now() + 300000;
let rng = new SeededRandom(request.seed!), attempts = 0, stagnant = 0;
console.log(JSON.stringify({ stage: "loaded", jobId, request, ms: Math.round(performance.now() - started) }));
try {
  while (candidates.length < request.resultCount && Date.now() < deadline && (attempts < 20 || deferred.length)) {
    const retry = deferred.length > 0 && (deferred.length >= 4 || stagnant >= 3 || attempts >= 20) ? deferred.shift() : undefined;
    let candidate: GeneratedTemplate, seed: number;
    if (retry) {
      if (!isDiverseGeometry(retry.candidate.fingerprint, diversity)) continue;
      candidate = retry.candidate; seed = (retry.seed ^ 0x9e3779b9) >>> 0;
    } else {
      attempts += 1;
      const t = performance.now();
      const result = await searchStructure({ request, rngPosition: rng.position, fingerprints: [...fingerprints], diversityFingerprints: diversity, weights, dictionaryCounts: counts, dictionary: entries, stagnantBatches: stagnant, maxMs: deadline - Date.now(), compareAllCandidates: process.argv.includes("--compare-all") }, controller.signal);
      rng = new SeededRandom(request.seed!, result.rngPosition);
      const d = result.diagnostics ?? {};
      totals.geometryMs += d.geometryMs ?? 0; totals.precheckMs += d.precheckMs ?? 0;
      totals.evaluations += d.evaluations ?? 0; totals.earlyStops += d.qualityEarlyStops ?? 0;
      totals.precheckIncomplete += d.precheckIncomplete ?? 0; totals.searchCalls += d.searchCalls ?? 0;
      console.log(JSON.stringify({ stage: "structure", attempt: attempts, ms: Math.round(performance.now() - t), found: !!result.candidate, quality: result.candidate?.metrics.qualityScore, diagnostics: d }));
      if (!result.candidate) { stagnant += 1; continue; }
      candidate = result.candidate; seed = rng.position;
    }
    fingerprints.add(candidate.fingerprint);
    const t = performance.now();
    const budget = Math.max(1, Math.min(retry?.remainingMs ?? probeMs, deadline - Date.now()));
    const solved = await solveCspNativeAsync(candidate.solverRows ?? buildSolverRows(candidate.grid), slotsForSolver(candidate.grid), dictionary, { shuffle: true, seed, lcv: true, restarts: 2, parallelRestarts: 2, uniqueWords: true, splitComponents: false, searchPortfolio: true, firstSolution: true, maxMs: budget, maxNodes: 2000000 });
    const ms = performance.now() - t;
    totals.solverMs += ms; totals.solverChecks += 1;
    console.log(JSON.stringify({ stage: "fill", attempt: attempts, retry: !!retry, ms: Math.round(ms), solved: !!solved }));
    if (!solved) {
      if (!retry && budget < 30000) deferred.push({ candidate, seed, remainingMs: 30000 - budget });
      stagnant += 1; continue;
    }
    const words = slotsForSolver(candidate.grid).map((slot) => slot.cells.map(([r, c]) => solved[r][c]).join(""));
    assert.equal(new Set(words).size, words.length, "fill must use unique words");
    for (const word of words) assert.ok(dictionary.get(word.length)?.includes(word), "fill must use the selected dictionary");
    assert.ok(verifyTemplateInvariants(candidate.grid).valid);
    assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
    assert.ok(isDiverseGeometry(candidate.fingerprint, diversity));
    candidate.metrics.dictionaryVerified = true;
    diversity.push(candidate.fingerprint); candidates.push(candidate); stagnant = 0;
    console.log(JSON.stringify({ stage: "accepted", ordinal: candidates.length, elapsedMs: Math.round(performance.now() - started), metrics: candidate.metrics }));
  }
} finally { controller.abort(); }
assert.equal(candidates.length, request.resultCount, "replay must complete the requested package");
const mean = (scores: number[]) => scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length);
console.log(JSON.stringify({ stage: "total", accepted: candidates.length, attempts, wallMs: Math.round(performance.now() - started), ...totals, meanQuality: mean(candidates.map((c) => c.metrics.qualityScore!)), originalMeanQuality: mean(baseline.map((c) => c.qualityScore)), minQuality: Math.min(...candidates.map((c) => c.metrics.qualityScore!)), maxQuality: Math.max(...candidates.map((c) => c.metrics.qualityScore!)), sameOriginalFingerprints: baseline.length === candidates.length && candidates.every((c, i) => c.fingerprint === baseline[i].fingerprint), verifiedFills: true, readOnly: true }));
