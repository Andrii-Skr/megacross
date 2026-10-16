import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { createGenerationControl, cancelGeneration, releaseGenerationControl } from "./nativeGenerator";
import type { GeneratedTemplate, TemplateGenerationRequest } from "./types";

type SearchInput = {
  request: TemplateGenerationRequest;
  rngPosition: number;
  fingerprints: string[];
  diversityFingerprints?: string[];
  weights: Record<number, number>;
  dictionaryCounts: Record<number, number>;
  maxMs?: number;
  dictionary?: Array<[number, string[]]>;
  stagnantBatches?: number;
  regionalRepair?: boolean;
  engine?: "rust" | "typescript";
  compareAllCandidates?: boolean;
};
export type SearchResult = { candidate: GeneratedTemplate | null; rngPosition: number; diagnostics?: Record<string, number> };
const workers = new WeakMap<AbortSignal, Worker>();
const sentDictionaries = new WeakMap<Worker, SearchInput["dictionary"]>();

// Bootstrap TypeScript explicitly: Node workers do not inherit tsx's registered loader.
const bootstrap = `
const { parentPort, workerData } = require('node:worker_threads');
const { tsImport } = require(workerData.loader);
(async () => {
  const { generateStructuralCandidate, SeededRandom } = await tsImport(workerData.moduleUrl, workerData.moduleUrl);
  const { generateNativeCandidate } = await tsImport(workerData.nativeUrl, workerData.nativeUrl);
  const { analyzeFillability } = await tsImport(workerData.fillabilityUrl, workerData.fillabilityUrl);
  const { sufficientTemplateQuality, templateSelectionScore } = await tsImport(workerData.selectionUrl, workerData.selectionUrl);
  let dictionary;
  const rejected = new Set();
  parentPort.on('message', input => {
  let rng = new SeededRandom(input.request.seed, input.rngPosition);
  const started = Date.now();
  const diagnostics = {};
  if (input.dictionary) dictionary = new Map(input.dictionary);
  const known = new Set([...input.fingerprints, ...rejected]);
  let candidate = null;
  let selectionScore = Infinity;
  for (let batch = 0; batch < 3; batch++) {
    let next;
    let stopped = false;
    const geometryStarted = performance.now();
    diagnostics.searchCalls = (diagnostics.searchCalls || 0) + 1;
    if (input.engine === 'rust') {
      const native = generateNativeCandidate({ request: input.request, rngPosition: rng.position,
        fingerprints: [...known], diversityFingerprints: input.diversityFingerprints ?? input.fingerprints,
        weights: input.weights, dictionaryCounts: input.dictionaryCounts, attemptBudget: 6,
        adaptiveSearch: (input.stagnantBatches || 0) >= 4 && batch === 2, regionalRepair: input.regionalRepair,
        maxMs: input.maxMs == null ? undefined : Math.max(0, input.maxMs - (Date.now() - started)) }, input.nativeControlId);
      rng = new SeededRandom(input.request.seed, native.rngPosition);
      for (const [key, value] of Object.entries(native.diagnostics)) {
        diagnostics[key] = key.startsWith('last') ? value : (diagnostics[key] || 0) + value;
      }
      next = native.candidate;
      stopped = native.stopped;
    } else {
      next = generateStructuralCandidate(input.request, rng, known, 6, input.weights,
        { diversityFingerprints: input.diversityFingerprints ?? input.fingerprints, dictionaryCounts: input.dictionaryCounts, diagnostics,
          adaptiveSearch: (input.stagnantBatches || 0) >= 4 && batch === 2, regionalRepair: input.regionalRepair });
      if (next) next.metrics.generationEngine = 'typescript';
    }
    diagnostics.geometryMs = (diagnostics.geometryMs || 0) + performance.now() - geometryStarted;
    if (!next) { if (stopped) break; continue; }
    known.add(next.fingerprint);
    const precheckStarted = performance.now();
    const check = dictionary ? analyzeFillability(next.grid, dictionary) : { feasible: true, constrainedShare: 0, converged: false };
    diagnostics.precheckMs = (diagnostics.precheckMs || 0) + performance.now() - precheckStarted;
    diagnostics.precheckOperations = (diagnostics.precheckOperations || 0) + (check.operations || 0);
    if (!check.converged) diagnostics.precheckIncomplete = (diagnostics.precheckIncomplete || 0) + 1;
    next.metrics.fillabilityConverged = check.converged;
    next.metrics.constrainedShare = check.constrainedShare;
    if (!check.feasible) { rejected.add(next.fingerprint); diagnostics.dictionaryRejected = (diagnostics.dictionaryRejected || 0) + 1; continue; }
    if (check.fixedRows) next.solverRows = check.fixedRows;
    if (!candidate) diagnostics.firstQualityScore = next.metrics.qualityScore;
    diagnostics.shortlisted = (diagnostics.shortlisted || 0) + 1;
    const score = templateSelectionScore(next.metrics, dictionary ? check : undefined);
    if (!candidate || score < selectionScore) { candidate = next; selectionScore = score; }
    parentPort.postMessage({ checkpoint: true, candidate, rngPosition: rng.position, diagnostics });
    if (!input.compareAllCandidates && sufficientTemplateQuality(candidate.metrics, dictionary ? { converged: candidate.metrics.fillabilityConverged === true, constrainedShare: candidate.metrics.constrainedShare ?? 1 } : undefined)) {
      diagnostics.qualityEarlyStops = (diagnostics.qualityEarlyStops || 0) + 1;
      break;
    }
    if (stopped) break;
  }
  diagnostics.structureMs = Date.now() - started;
  parentPort.postMessage({ candidate, rngPosition: rng.position, diagnostics });
  });
  parentPort.postMessage({ ready: true });
})().catch(error => { throw error; });
`;

export function searchStructure(input: SearchInput, signal: AbortSignal): Promise<SearchResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("generation cancelled")); return; }
    const engine = input.engine ?? process.env.CROSS_TEMPLATE_ENGINE ?? "rust";
    if (engine !== "rust" && engine !== "typescript") { reject(new Error("CROSS_TEMPLATE_ENGINE must be rust or typescript")); return; }
    const nativeControlId = engine === "rust" ? createGenerationControl() : undefined;
    const submitted = { ...input, compareAllCandidates: input.compareAllCandidates ?? (process.env.CROSS_TEMPLATE_COMPARE_ALL_CANDIDATES === "1"), engine, nativeControlId };
    let worker = workers.get(signal);
    const existing = Boolean(worker);
    if (!worker) {
      try {
      worker = new Worker(bootstrap, {
        eval: true,
        workerData: { loader: createRequire(import.meta.url).resolve("tsx/esm/api"), moduleUrl: new URL("./generator.ts", import.meta.url).href, fillabilityUrl: new URL("./fillability.ts", import.meta.url).href, nativeUrl: new URL("./nativeGenerator.ts", import.meta.url).href, selectionUrl: new URL("./selection.ts", import.meta.url).href },
      });
      } catch (error) {
        if (nativeControlId != null) releaseGenerationControl(nativeControlId);
        reject(error);
        return;
      }
      workers.set(signal, worker);
      const current = worker;
      signal.addEventListener("abort", () => { workers.delete(signal); void current.terminate(); }, { once: true });
    }
    const current = worker;
    current.ref();
    let settled = false;
    let checkpoint: SearchResult | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: SearchResult) => {
      if (settled) return;
      settled = true;
      if (nativeControlId != null) { cancelGeneration(nativeControlId); releaseGenerationControl(nativeControlId); }
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      current.removeListener("message", onMessage);
      current.removeListener("error", onError);
      current.removeListener("exit", onExit);
      if (error || timeoutExpired) { workers.delete(signal); void current.terminate(); }
      else current.unref();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new Error("generation cancelled"));
    let timeoutExpired = false;
    const onMessage = (result: SearchResult & { ready?: boolean; checkpoint?: boolean }) => {
      if (result.ready) postInput();
      else if (result.checkpoint) checkpoint = result;
      else finish(undefined, result);
    };
    const onError = (error: Error) => finish(error);
    const onExit = (code: number) => { workers.delete(signal); if (!settled) finish(new Error(`structure worker exited before returning a result (${code})`)); };
    const postInput = () => {
      try {
        const dictionary = sentDictionaries.get(current) === submitted.dictionary ? undefined : submitted.dictionary;
        current.postMessage({ ...submitted, dictionary });
        sentDictionaries.set(current, submitted.dictionary);
      }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    };
    signal.addEventListener("abort", abort, { once: true });
    if (input.maxMs != null) timeout = setTimeout(() => { timeoutExpired = true; finish(undefined, checkpoint ?? { candidate: null, rngPosition: input.rngPosition }); }, Math.max(1, input.maxMs));
    current.on("message", onMessage);
    current.once("error", onError);
    current.once("exit", onExit);
    if (existing) postInput();
  });
}
