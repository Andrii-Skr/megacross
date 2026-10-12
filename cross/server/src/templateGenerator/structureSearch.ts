import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import type { GeneratedTemplate, TemplateGenerationRequest } from "./types";

type SearchInput = {
  request: TemplateGenerationRequest;
  rngPosition: number;
  fingerprints: string[];
  weights: Record<number, number>;
  dictionaryCounts: Record<number, number>;
  maxMs?: number;
  dictionary?: Array<[number, string[]]>;
  stagnantBatches?: number;
  regionalRepair?: boolean;
};
export type SearchResult = { candidate: GeneratedTemplate | null; rngPosition: number; diagnostics?: Record<string, number> };
const workers = new WeakMap<AbortSignal, Worker>();

// Bootstrap TypeScript explicitly: Node workers do not inherit tsx's registered loader.
const bootstrap = `
const { parentPort, workerData } = require('node:worker_threads');
const { tsImport } = require(workerData.loader);
(async () => {
  const { generateStructuralCandidate, SeededRandom } = await tsImport(workerData.moduleUrl, workerData.moduleUrl);
  const { analyzeFillability } = await tsImport(workerData.fillabilityUrl, workerData.fillabilityUrl);
  let dictionary;
  const rejected = new Set();
  parentPort.on('message', input => {
  const rng = new SeededRandom(input.request.seed, input.rngPosition);
  const diagnostics = {};
  if (input.dictionary) dictionary = new Map(input.dictionary);
  const known = new Set([...input.fingerprints, ...rejected]);
  let candidate = null;
  for (let batch = 0; batch < 3; batch++) {
    const next = generateStructuralCandidate(input.request, rng, known, 3, input.weights,
      { poolSize: 1, dictionaryCounts: input.dictionaryCounts, diagnostics, adaptiveSearch: (input.stagnantBatches || 0) >= 4 && batch === 2, regionalRepair: input.regionalRepair });
    if (!next) continue;
    known.add(next.fingerprint);
    const check = dictionary ? analyzeFillability(next.grid, dictionary) : { feasible: true, constrainedShare: 0 };
    if (!check.feasible) { rejected.add(next.fingerprint); diagnostics.dictionaryRejected = (diagnostics.dictionaryRejected || 0) + 1; continue; }
    if (check.fixedRows) next.solverRows = check.fixedRows;
    candidate = next;
    break;
  }
  parentPort.postMessage({ candidate, rngPosition: rng.position, diagnostics });
  });
  parentPort.postMessage({ ready: true });
})().catch(error => { throw error; });
`;

export function searchStructure(input: SearchInput, signal: AbortSignal): Promise<SearchResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("generation cancelled")); return; }
    let worker = workers.get(signal);
    const existing = Boolean(worker);
    if (!worker) {
      worker = new Worker(bootstrap, {
        eval: true,
        workerData: { loader: createRequire(import.meta.url).resolve("tsx/esm/api"), moduleUrl: new URL("./generator.ts", import.meta.url).href, fillabilityUrl: new URL("./fillability.ts", import.meta.url).href },
      });
      workers.set(signal, worker);
      const current = worker;
      signal.addEventListener("abort", () => { workers.delete(signal); void current.terminate(); }, { once: true });
    }
    const current = worker;
    current.ref();
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: SearchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      current.removeListener("message", onMessage);
      current.removeListener("error", onError);
      current.removeListener("exit", onExit);
      if (error || !result?.candidate && input.maxMs != null && timeoutExpired) { workers.delete(signal); void current.terminate(); }
      else current.unref();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new Error("generation cancelled"));
    let timeoutExpired = false;
    const onMessage = (result: SearchResult & { ready?: boolean }) => {
      if (result.ready) current.postMessage(input);
      else finish(undefined, result);
    };
    const onError = (error: Error) => finish(error);
    const onExit = (code: number) => { workers.delete(signal); if (!settled) finish(new Error(`structure worker exited before returning a result (${code})`)); };
    signal.addEventListener("abort", abort, { once: true });
    if (input.maxMs != null) timeout = setTimeout(() => { timeoutExpired = true; finish(undefined, { candidate: null, rngPosition: input.rngPosition }); }, Math.max(1, input.maxMs));
    current.on("message", onMessage);
    current.once("error", onError);
    current.once("exit", onExit);
    if (existing) current.postMessage(input);
  });
}
