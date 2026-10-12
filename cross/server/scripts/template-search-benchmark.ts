import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma";
import { loadDictionaryByTemplate } from "../src/services/dictionary";
import { generateStructuralCandidate, buildSolverRows, slotsForSolver, SeededRandom, verifyTemplateInvariants } from "../src/templateGenerator/generator";
import { verifyClueOwnership } from "../src/templateGenerator/clueMatcher";
import type { GeneratedTemplate, TemplateGenerationRequest } from "../src/templateGenerator/types";
import { calculateLengthWeights, countDictionaryByLength } from "../src/templateGenerator/weights";
import { solveCspNativeAsync } from "../src/utils/nativeDlx";
import { searchStructure } from "../src/templateGenerator/structureSearch";

const jobId = BigInt(process.argv[2] ?? "8");
const controller = new AbortController();
try {
  const job = await prisma.scanword_template_generation_jobs.findUniqueOrThrow({ where: { id: jobId } });
  const request = job.parameters as unknown as TemplateGenerationRequest;
  assert.ok(request.dictionaryFilterId);
  const filter = await prisma.dictionary_filter_templates.findUniqueOrThrow({ where: { id: request.dictionaryFilterId } });
  const dictionary = await loadDictionaryByTemplate(filter, { lengths: Array.from({ length: 10 }, (_, i) => i + 2) });
  const counts = countDictionaryByLength(dictionary);
  const weights = calculateLengthWeights(counts);
  let rng = new SeededRandom(job.seed);
  const known = new Set<string>();
  const started = Date.now();
  let stagnantBatches = 0;
  for (let attempt = 1; attempt <= 20 && known.size < request.resultCount && Date.now() - started < 600_000; attempt += 1) {
    const diagnostics: Record<string, number> = {};
    let candidate: GeneratedTemplate | null;
    if (process.argv.includes("--worker")) {
      const result = await searchStructure({ request, rngPosition: rng.position, fingerprints: [...known], weights, dictionaryCounts: counts, dictionary: [...dictionary], stagnantBatches, regionalRepair: !process.argv.includes("--no-regional"), maxMs: 600_000 - (Date.now() - started) }, controller.signal);
      rng = new SeededRandom(job.seed, result.rngPosition);
      candidate = result.candidate;
      Object.assign(diagnostics, result.diagnostics);
    } else candidate = generateStructuralCandidate(request, rng, known, 5, weights, { dictionaryCounts: counts, diagnostics, regionalRepair: !process.argv.includes("--no-regional") });
    if (!candidate) { stagnantBatches += 1; console.log({ attempt, phase: "structure", diagnostics }); continue; }
    assert.ok(verifyTemplateInvariants(candidate.grid).valid);
    assert.deepEqual(verifyClueOwnership(candidate.grid, candidate.metrics.pictureBounds), []);
    const slots = slotsForSolver(candidate.grid);
    const strongPropagation = process.argv.includes("--strong");
    const solved = await solveCspNativeAsync(candidate.solverRows ?? buildSolverRows(candidate.grid), slots, dictionary, { uniqueWords: true, shuffle: strongPropagation, seed: rng.position, lcv: true, restarts: 2, parallelRestarts: 2, splitComponents: false, searchPortfolio: strongPropagation, firstSolution: strongPropagation, maxMs: 30_000, maxNodes: 2_000_000 });
    if (solved) {
      const words = slots.map((slot) => slot.cells.map(([r, c]) => solved[r][c]).join(""));
      assert.equal(new Set(words).size, words.length);
      words.forEach((word) => assert.ok(dictionary.get(word.length)?.includes(word)));
      known.add(candidate.fingerprint);
      stagnantBatches = 0;
    }
    else stagnantBatches += 1;
    console.log({ attempt, solved: Boolean(solved), found: known.size, seconds: Math.round((Date.now() - started) / 1000), lengths: candidate.metrics.lengthDistribution, cacheHits: diagnostics.cacheHits ?? 0, evaluations: diagnostics.evaluations ?? 0, regionalRepairMoves: diagnostics.regionalRepairMoves ?? 0, regionalRepairTrials: diagnostics.regionalRepairTrials ?? 0 });
  }
  console.log({ found: known.size, requested: request.resultCount, seconds: Math.round((Date.now() - started) / 1000) });
  assert.equal(known.size, request.resultCount, "benchmark must produce the complete requested batch with verified unique dictionary words");
} finally { controller.abort(); await prisma.$disconnect(); }
