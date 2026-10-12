import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/db/prisma";
import { fillSolverComparisonAccess } from "../src/services/fillJobService";
import { buildUsageRebalanceMetrics } from "../src/utils/usageRebalance";
import { resolveProbeBudget, resolveProbeOutcome, runSolverProbe } from "../src/utils/fillFallback";
import { solve, type SolveFailInfo } from "../src/utils/solver";
import { compareFillRuns } from "../src/utils/fillDiversityMetrics";

const output = process.argv[2] ?? "/private/tmp/fill-batch-comparison.json";
const productionDefaults = process.argv.includes("--production-defaults");
const randomizeProbe = process.argv.includes("--randomize-probe");
const repeatCount = Number(process.argv.find((arg) => arg.startsWith("--repeats="))?.slice("--repeats=".length) ?? 1);
assert.ok(Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 5);
const requestedEngine = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
assert.ok(!requestedEngine || ["dlx", "csp"].includes(requestedEngine));
const report: { measuredAt: string; sourceJobId: string; rows: Array<Record<string, unknown>>; summaries: Array<Record<string, unknown>>; comparisons: Array<Record<string, unknown>> } = {
  measuredAt: new Date().toISOString(), sourceJobId: "129", rows: [], summaries: [], comparisons: [],
};
try {
  const source = await prisma.scanword_fill_jobs.findUniqueOrThrow({ where: { id: 129n }, select: { options: true } });
  const baseOptions = fillSolverComparisonAccess.parseOptions(productionDefaults ? undefined : source.options);
  if (productionDefaults) report.sourceJobId = "production-defaults";
  // Freeze files, dictionaries and historical usage for BOTH modes before solving.
  const contexts = await Promise.all([77n, 78n].map((issue) => fillSolverComparisonAccess.loadContext(issue, baseOptions)));
  for (const [dataset, context] of contexts.entries()) {
    assert.equal(context.sortedEntries.length, dataset === 0 ? 56 : 96);
    const historical = context.usageCountByWord;
    // Alternate engine order across datasets; each mode has its own in-run state.
    const order = dataset === 0 ? ["dlx", "csp"] as const : ["csp", "dlx"] as const;
    for (const engine of order.filter((value) => !requestedEngine || value === requestedEngine)) {
      for (let run = 1; run <= repeatCount; run += 1) {
      const options = { ...baseOptions, engine };
      const state = { solvedWordsByTemplate: new Map<string, Set<string>>(), usedWordsInJob: new Set<string>(), usedWordCountInJob: new Map<string, number>(), usedDefinitionKeys: new Set<string>() };
      const metrics = {
        uniqueFallbackStats: { probeAttempted: 0, probeSolved: 0, probeUnsat: 0, probeUnknown: 0, strictAttempted: 0, strictLimited: 0, strictSkippedByDeficit: 0, strictSolved: 0, adaptiveAttempted: 0, adaptiveSolved: 0, neighborAttempted: 0, neighborSolved: 0 },
        usageRebalanceMetrics: buildUsageRebalanceMetrics(),
        usageCostMetrics: { templatesPolished: 0, replacements: 0, totalDeltaCost: 0, examinedCandidates: 0 },
        editionHotBanMetrics: { loaded: context.editionHotBannedWords.size, applied: 0, relaxed: 0, relaxedByLen: new Map<number, number>(), unresolvedByLen: new Map<number, number>() },
      };
      const allWords: string[] = [];
      let filled = 0;
      let solverMs = 0;
      const start = performance.now();
      const modeRows: Array<Record<string, unknown>> = [];
      for (const [index, entry] of context.sortedEntries.entries()) {
        const started = performance.now();
        let templateSolverMs = 0;
        // A CSP profile must also use CSP in the probe. Otherwise the common
        // DLX shortcut can fill every easy grid before CSP is ever called.
        const probeSolver: NonNullable<Parameters<typeof fillSolverComparisonAccess.solveTemplate>[5]>["probeSolver"] = (rows, slots, dict, probeOptions = {}) => {
          let failInfo: SolveFailInfo | null = null;
          const probeStart = performance.now();
          if (productionDefaults && !randomizeProbe) {
            const result = runSolverProbe(rows, slots, dict, probeOptions);
            templateSolverMs += performance.now() - probeStart;
            return result;
          }
          const witness = solve(rows, slots, dict, {
            engine, nativeDlx: true, shuffle: randomizeProbe, seed: 12345 + (run - 1) * 100_000 + index, lcv: true, uniqueWords: probeOptions.uniqueWords ?? true,
            splitComponents: true, restarts: 1, parallelRestarts: 1,
            ...resolveProbeBudget(probeOptions.maxNodes, probeOptions.maxMs),
            wordPriority: probeOptions.wordPriority, lcvPrioritySlack: probeOptions.lcvPrioritySlack,
            strongPropagation: engine === "csp", firstSolution: true,
            onFail: (info) => { failInfo = info; },
          });
          templateSolverMs += performance.now() - probeStart;
          return { solved: witness, failInfo, outcome: resolveProbeOutcome(witness, failInfo) };
        };
        const result = await fillSolverComparisonAccess.solveTemplate(entry, context, options, state, metrics, {
          probeSolver,
          solverTuning: productionDefaults && !randomizeProbe ? undefined : { seed: 12345 + (run - 1) * 100_000 + index, strongPropagation: engine === "csp", firstSolution: false },
          onSolverTiming: (ms) => { templateSolverMs += ms; },
        });
        let words: string[] = [];
        if (!("error" in result)) {
          words = [...result.reviewTemplate.slots].sort((a, b) => a.slotId - b.slotId).map((slot) => slot.word);
          assert.equal(words.length, entry.slots.length);
          assert.equal(new Set(words).size, words.length, "within-template duplicate");
          for (const word of words) assert.ok(context.dict.get(word.length)?.includes(word), "word outside frozen dictionary");
          filled += 1;
          allWords.push(...words);
        }
        solverMs += templateSolverMs;
        const row = { issueId: context.issue.issueId.toString(), engine, run, index: index + 1, template: entry.sourceName, templateKey: entry.key,
          filled: !("error" in result), error: "error" in result ? result.error : null,
          solverMs: Math.round(templateSolverMs), elapsedMs: Math.round(performance.now() - started), wordCount: words.length,
          words, meanHistoricalUsage: words.length ? words.reduce((sum, word) => sum + (historical.get(word) ?? 0), 0) / words.length : null };
        modeRows.push(row); report.rows.push(row);
        console.log(JSON.stringify({ ...row, words: undefined }));
        if ((index + 1) % 5 === 0) await writeFile(output, JSON.stringify(report, null, 2));
      }
      const counts = new Map<string, number>();
      allWords.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
      const durations = modeRows.map((row) => Number(row.solverMs)).sort((a, b) => a - b);
      const summary = { issueId: context.issue.issueId.toString(), engine, run, requested: context.sortedEntries.length, filled,
        solverMs: Math.round(solverMs), elapsedMs: Math.round(performance.now() - start),
        medianSolverMs: durations[Math.floor(durations.length * 0.5)], p95SolverMs: durations[Math.floor((durations.length - 1) * 0.95)],
        words: allWords.length, duplicateWords: [...counts.values()].filter((count) => count > 1).length,
        duplicateOccurrences: allWords.length - counts.size, maxUsesInBatch: Math.max(0, ...counts.values()),
        meanHistoricalUsage: allWords.length ? allWords.reduce((sum, word) => sum + (historical.get(word) ?? 0), 0) / allWords.length : null,
        historicalHotOccurrences: allWords.filter((word) => (historical.get(word) ?? 0) > (context.usageRebalanceContext?.thresholdByLen.get(word.length)?.hardThreshold ?? Infinity)).length,
        usageByLength: Object.fromEntries([...new Set(allWords.map((word) => word.length))].sort((a, b) => a - b).map((length) => {
          const subset = allWords.filter((word) => word.length === length);
          return [length, { words: subset.length, meanHistoricalUsage: subset.reduce((sum, word) => sum + (historical.get(word) ?? 0), 0) / subset.length,
            duplicateOccurrences: subset.length - new Set(subset).size }];
        })),
        options, cspStrongPropagation: engine === "csp", mainSearchFirstSolution: false,
        probeShuffle: randomizeProbe || (productionDefaults && engine === "csp" && options.shuffle),
        selectedEngineProbe: true, uniqueFallbackStats: metrics.uniqueFallbackStats, polish: metrics.usageCostMetrics };
      Object.assign(summary, { randomizeProbe });
      report.summaries.push(summary);
      await writeFile(output, JSON.stringify(report, null, 2));
      console.log("SUMMARY", JSON.stringify(summary));
      }
      const templatesForRun = (run: number) => report.rows.filter((row) => row.issueId === context.issue.issueId.toString() && row.engine === engine && row.run === run)
        .map((row) => ({ key: String(row.templateKey), filled: Boolean(row.filled), words: row.words as string[] }));
      for (let left = 1; left < repeatCount; left += 1) for (let right = left + 1; right <= repeatCount; right += 1) {
        report.comparisons.push({ issueId: context.issue.issueId.toString(), engine, leftRun: left, rightRun: right, randomizeProbe,
          ...compareFillRuns(templatesForRun(left), templatesForRun(right)) });
      }
      await writeFile(output, JSON.stringify(report, null, 2));
    }
  }
} finally { await prisma.$disconnect(); }
