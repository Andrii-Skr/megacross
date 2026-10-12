import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/db/prisma";
import { loadDictionaryByTemplate } from "../src/services/dictionary";
import { buildSolverRows, slotsForSolver } from "../src/templateGenerator/generator";
import type { Grid } from "../src/types";
import { loadEditionUsageSnapshot } from "../src/utils/editionUsageSnapshot";
import { sortDictionaryByUsagePriority } from "../src/utils/fillShared";
import { solveCspNativeAsync, solveDlxNativeAsync } from "../src/utils/nativeDlx";
import { buildCostHardFirstRebalanceBlockedVariants, buildUsageRebalanceContext, resolveUsageRebalanceThresholds } from "../src/utils/usageRebalance";

const modes = ["legacy-dlx", "improved-dlx", "csp"] as const;
assert.ok(process.env.DLX_BASELINE_PATH, "set DLX_BASELINE_PATH to the saved pre-change native addon");
const baseline = createRequire(import.meta.url)(process.env.DLX_BASELINE_PATH) as {
  solveDlxAsync?: (input: string, progress: (error: unknown, payload?: unknown) => void) => Promise<string[] | null>;
  solve_dlx_async?: (input: string, progress: (error: unknown, payload?: unknown) => void) => Promise<string[] | null>;
};
const baselineSolve = baseline.solveDlxAsync ?? baseline.solve_dlx_async;
assert.ok(baselineSolve);
const rows: Array<Record<string, unknown>> = [];
try {
  const job = await prisma.scanword_fill_jobs.findUniqueOrThrow({ where: { id: BigInt(process.argv[2] ?? "128") }, select: { id: true, issueId: true, options: true, templates: true, issues: { select: { editionId: true } } } });
  const options = job.options as { filterTemplateId: number; maxNodes: number; restarts: number };
  const filter = await prisma.dictionary_filter_templates.findUniqueOrThrow({ where: { id: options.filterTemplateId } });
  const dictionary = await loadDictionaryByTemplate(filter, { lengths: Array.from({ length: 10 }, (_, i) => i + 2) });
  const usage = await loadEditionUsageSnapshot(dictionary, job.issues.editionId, { usageRebalanceEnabled: true, usageRebalanceMode: "cost", db: prisma });
  sortDictionaryByUsagePriority(dictionary, usage.priorityByWord);
  const rebalance = buildUsageRebalanceContext(dictionary, usage.usageByWord, resolveUsageRebalanceThresholds(dictionary, usage.usageByWord, "cost"));
  const selectedTemplate = process.argv.find((arg) => arg.startsWith("--template="))?.slice("--template=".length);
  const templates = (job.templates as Array<{ sourceName: string }>).filter((item) => !selectedTemplate || item.sourceName === selectedTemplate);
  assert.ok(templates.length, "no selected templates");
  const inputs = await Promise.all(templates.map(async ({ sourceName }) => {
    const match = /^generated_(\d+)_(\d+)\.fsh$/u.exec(sourceName);
    assert.ok(match, "comparison currently expects generated FSH sources");
    const result = await prisma.scanword_template_generation_results.findUniqueOrThrow({ where: { jobId_ordinal: { jobId: BigInt(match[1]), ordinal: Number(match[2]) } } });
    return { name: sourceName, grid: result.grid as unknown as Grid };
  }));
  const summaries: Array<Record<string, unknown>> = [];
  // Each engine receives the same frozen usage snapshot and rebalance policy.
  // Bundle exclusions necessarily evolve with that engine's own previous fills.
  for (const mode of modes) {
    const used = new Set<string>();
    const counts = new Map<string, number>();
    let totalMs = 0;
    let filled = 0;
    const allWords: string[] = [];
    for (const [index, input] of inputs.entries()) {
      const slots = slotsForSolver(input.grid);
      const lenCounts = new Map<number, number>();
      slots.forEach((slot) => lenCounts.set(slot.len, (lenCounts.get(slot.len) ?? 0) + 1));
      const variants = buildCostHardFirstRebalanceBlockedVariants(new Set(used), counts, lenCounts, rebalance, undefined, { allowHardFirst: true });
      const started = performance.now();
      const failures: unknown[] = [];
      let words: string[] | null = null;
      let acceptedVariant: string | null = null;
      for (const variant of variants) {
        const filtered = new Map([...dictionary].map(([length, bucket]) => [length, bucket.filter((word) => !variant.blockedWords.has(word))]));
        const common = { shuffle: true, seed: 12345 + index, lcv: true, lcvPrioritySlack: 1_000_000, restarts: options.restarts, parallelRestarts: 1, maxNodes: options.maxNodes, maxMs: 10_000, uniqueWords: true, splitComponents: false, wordPriority: usage.priorityByWord, firstSolution: true, onFail: (info: unknown) => { failures.push(info); } };
        const witness: string[] | null | undefined = mode === "legacy-dlx"
          ? await baselineSolve(JSON.stringify({ rows: buildSolverRows(input.grid), slots, dict: Object.fromEntries(filtered), options: { ...common, wordPriority: Object.fromEntries(usage.priorityByWord) } }), (error, payload) => {
            const raw = payload ?? error;
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (data && typeof data === "object" && (data as { type?: string }).type === "fail") failures.push(data);
          })
          : mode === "csp"
            ? await solveCspNativeAsync(buildSolverRows(input.grid), slots, filtered, { ...common, strongPropagation: true })
            : await solveDlxNativeAsync(buildSolverRows(input.grid), slots, filtered, { ...common, dlxPreprocess: true, dlxLegacyHeuristic: true });
        if (!witness) continue;
        words = slots.map((slot) => slot.cells.map(([r, c]) => witness[r][c]).join(""));
        assert.equal(new Set(words).size, words.length, "within-template duplicates");
        words.forEach((word) => { assert.ok(filtered.get(word.length)?.includes(word)); assert.ok(!used.has(word), "cross-template duplicate"); });
        acceptedVariant = variant.kind;
        break;
      }
      const ms = performance.now() - started;
      totalMs += ms;
      if (words) {
        filled += 1;
        for (const word of words) { used.add(word); counts.set(word, (counts.get(word) ?? 0) + 1); allWords.push(word); }
      }
      const selectedUsage = words?.map((word) => usage.usageByWord.get(word) ?? 0) ?? [];
      const record = { mode, template: input.name, filled: Boolean(words), ms: Math.round(ms), words: words?.length ?? 0, acceptedVariant,
        meanHistoricalUsage: selectedUsage.length ? selectedUsage.reduce((a, b) => a + b, 0) / selectedUsage.length : null,
        historicalHotWords: words?.filter((word) => (usage.usageByWord.get(word) ?? 0) > (rebalance.thresholdByLen.get(word.length)?.hardThreshold ?? Infinity)).length ?? 0,
        failures };
      rows.push(record);
      console.log(record);
    }
    const historical = allWords.map((word) => usage.usageByWord.get(word) ?? 0);
    summaries.push({ mode, filled, requested: inputs.length, ms: Math.round(totalMs), words: allWords.length,
      duplicates: allWords.length - new Set(allWords).size,
      meanHistoricalUsage: historical.length ? historical.reduce((a, b) => a + b, 0) / historical.length : null,
      usageByLength: Object.fromEntries([...new Set(allWords.map((word) => word.length))].sort((a, b) => a - b).map((length) => {
        const subset = allWords.filter((word) => word.length === length).map((word) => usage.usageByWord.get(word) ?? 0);
        return [length, { count: subset.length, mean: subset.reduce((a, b) => a + b, 0) / subset.length }];
      })) });
  }
  const report = { fillJobId: job.id.toString(), measuredAt: new Date().toISOString(), maxNodesPerAttempt: options.maxNodes, maxMsPerAttempt: 10_000, restarts: options.restarts, parallel: 1, snapshotWords: [...dictionary.values()].reduce((sum, bucket) => sum + bucket.length, 0), summaries, rows };
  console.log(JSON.stringify(report.summaries, null, 2));
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2));
} finally { await prisma.$disconnect(); }
