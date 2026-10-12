import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/db/prisma";
import { loadDictionaryByTemplate } from "../src/services/dictionary";
import { buildSolverRows, slotsForSolver } from "../src/templateGenerator/generator";
import type { Grid } from "../src/types";
import { solveCspNativeAsync } from "../src/utils/nativeDlx";

try {
  const job = await prisma.scanword_template_generation_jobs.findUniqueOrThrow({ where: { id: BigInt(process.argv[2] ?? "9") }, include: { results: true } });
  const params = job.parameters as { dictionaryFilterId: number };
  const filter = await prisma.dictionary_filter_templates.findUniqueOrThrow({ where: { id: params.dictionaryFilterId } });
  const dictionary = await loadDictionaryByTemplate(filter, { lengths: Array.from({ length: 10 }, (_, id) => id + 2) });
  const totals = { classic: 0, mac: 0, portfolio: 0 };
  for (const result of job.results) {
    const grid = result.grid as unknown as Grid;
    const slots = slotsForSolver(grid);
    for (const mode of result.ordinal % 2 ? ["classic", "mac", "portfolio"] as const : ["portfolio", "mac", "classic"] as const) {
      const started = performance.now();
      const solved = await solveCspNativeAsync(buildSolverRows(grid), slots, dictionary, { strongPropagation: mode === "mac", searchPortfolio: mode === "portfolio", firstSolution: mode === "portfolio", seed: 12345, uniqueWords: true, lcv: true, shuffle: mode === "portfolio", restarts: 2, parallelRestarts: 2, splitComponents: false, maxMs: 30_000, maxNodes: 2_000_000 });
      const ms = performance.now() - started;
      assert.ok(solved, `result ${result.ordinal} must fill with mode ${mode}`);
      const words = slots.map((slot) => slot.cells.map(([r, c]) => solved[r][c]).join(""));
      assert.equal(new Set(words).size, words.length);
      words.forEach((word) => assert.ok(dictionary.get(word.length)?.includes(word)));
      totals[mode] += ms;
      console.log({ ordinal: result.ordinal, mode, ms: Math.round(ms), words: words.length });
    }
  }
  console.log({ totals, checkedTemplates: job.results.length });
} finally { await prisma.$disconnect(); }
