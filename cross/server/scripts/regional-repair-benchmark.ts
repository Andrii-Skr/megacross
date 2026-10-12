import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma";
import { loadDictionaryByTemplate } from "../src/services/dictionary";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import { buildSolverRows, SeededRandom, slotsForSolver, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { searchStructure } from "../src/templateGenerator/structureSearch";
import type { TemplateGenerationRequest } from "../src/templateGenerator/types";
import { calculateLengthWeights, countDictionaryByLength } from "../src/templateGenerator/weights";
import { solveCspNativeAsync } from "../src/utils/nativeDlx";

// Read-only paired experiment; neither jobs nor results are inserted/updated.
try {
  const job = await prisma.scanword_template_generation_jobs.findUniqueOrThrow({ where: { id: BigInt(process.argv[2] ?? "13") } });
  const base = job.parameters as unknown as TemplateGenerationRequest;
  assert.ok(base.dictionaryFilterId);
  const filter = await prisma.dictionary_filter_templates.findUniqueOrThrow({ where: { id: base.dictionaryFilterId } });
  const dictionary = await loadDictionaryByTemplate(filter, { lengths: Array.from({ length: 10 }, (_, i) => i + 2) });
  const counts = countDictionaryByLength(dictionary);
  const weights = calculateLengthWeights(counts);
  for (const [index, seed] of [job.seed, "regional-control-1", "regional-control-2"].entries()) {
    // Alternate order to reduce warmup bias.
    for (const regionalRepair of index % 2 ? [true, false] : [false, true]) {
      const controller = new AbortController();
      const request = { ...base, resultCount: 1, seed };
      let rng = new SeededRandom(seed);
      const tested = new Set<string>();
      const start = Date.now();
      let solved = false;
      let moves = 0;
      let trials = 0;
      let attempts = 0;
      try {
        while (!solved && attempts < 6 && Date.now() - start < 120_000) {
          attempts += 1;
          const result = await searchStructure({ request, rngPosition: rng.position, fingerprints: [...tested], weights, dictionaryCounts: counts, dictionary: [...dictionary], regionalRepair, stagnantBatches: attempts - 1, maxMs: 120_000 - (Date.now() - start) }, controller.signal);
          rng = new SeededRandom(seed, result.rngPosition);
          trials += result.diagnostics?.regionalRepairTrials ?? 0;
          const candidate = result.candidate;
          if (!candidate) continue;
          tested.add(candidate.fingerprint);
          assert.ok(verifyTemplateInvariants(candidate.grid).valid);
          assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
          const slots = slotsForSolver(candidate.grid);
          const witness = await solveCspNativeAsync(candidate.solverRows ?? buildSolverRows(candidate.grid), slots, dictionary, { uniqueWords: true, shuffle: true, seed: rng.position, lcv: true, restarts: 2, parallelRestarts: 2, searchPortfolio: true, firstSolution: true, splitComponents: false, maxMs: Math.min(30_000, Math.max(1, 120_000 - (Date.now() - start))), maxNodes: 2_000_000 });
          if (!witness) continue;
          const words = slots.map((slot) => slot.cells.map(([r, c]) => witness[r][c]).join(""));
          assert.equal(new Set(words).size, words.length);
          words.forEach((word) => assert.ok(dictionary.get(word.length)?.includes(word)));
          moves = candidate.metrics.regionalRepairCount ?? 0;
          solved = true;
        }
      } finally { controller.abort(); }
      console.log({ seed, regionalRepair, solved, seconds: Math.round((Date.now() - start) / 100) / 10, attempts, acceptedRegionalMoves: moves, trials });
      assert.ok(solved, `no complete fill for ${seed}, regionalRepair=${regionalRepair}`);
    }
  }
} finally { await prisma.$disconnect(); }
