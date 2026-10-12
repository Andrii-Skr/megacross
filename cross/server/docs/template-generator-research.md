# Template search: research and implementation

The task is to construct an arrowword geometry and prove that a filtered dictionary
fills every answer, with unique words. A plausible geometry or arc-consistent word
domains alone are not a proof. The native CSP witness remains the acceptance gate.

## Sources and selected techniques

* [Ingrid arc consistency](https://docs.rs/ingrid_core/latest/ingrid_core/arc_consistency/index.html)
  propagates both crossing letters and singleton duplicate exclusions until stable.
  `fillability.ts` now implements both rules, caches letter supports by domain
  version, and exports forced letters to the native solver. Its operation budget
  may stop propagation early; that does not certify satisfiability.
* [Ingrid search](https://docs.rs/ingrid_core/latest/ingrid_core/backtracking_search/index.html)
  combines maintained arc consistency, adaptive variable ordering and restarts.
  The optional native `strongPropagation` mode now maintains arc consistency after
  assignments using bitset letter indexes and the undo trail, and orders variables
  by domain size divided by accumulated conflict degree. Only domains changed by
  forward checking are queued after each assignment. This is our dom/wdeg variant,
  not a copy of Ingrid's entire search implementation.
  The generator uses a two-worker portfolio: classic MRV/LCV and this MAC strategy.
  Both use distinct seeded random tie breakers. `firstSolution` stops the search
  and its sibling as soon as a complete valid witness is found; other fill callers
  retain their existing optimization behavior unless they explicitly opt in.
* [Hoos, adaptive noise for WalkSAT](https://www.cs.ubc.ca/labs/lci/papers/docs2002/hoos-aaai02-adapt.pdf)
  raises diversification during stagnation and reduces it when improvement returns.
  We adapt that principle to valid single-cell moves in clue balancing. Adaptive
  search is a fallback in the third structural batch after four consecutive
  unsuccessful batches, retaining the original
  greedy search and the best valid geometry. This is an adaptation to arrowwords,
  not an implementation of a SAT solver.
* [Dr.Fill](https://arxiv.org/abs/1401.4597) uses weighted CSPs and limited discrepancy
  search for uncertain clue answers. Our dictionary is a hard domain and templates
  have no clue text yet, so clue-probability ranking is not directly applicable.

## Other optimizations

The deterministic geometric objective is cached for at most 512 neighboring masks
per balancing run. Evaluations of already visited masks are skipped. Cache hits do
not consume random numbers; only adaptive search changes the seeded trajectory.

## Reproducing validation

Run `pnpm exec tsx scripts/template-search-benchmark.ts <job-id> --worker` against a
local database. This reads the job's geometry, seed and dictionary filter without
modifying it, and checks every returned witness for dictionary membership and
word uniqueness. `pnpm run test:structure-worker` checks cancellation/deadlines;
the fillability unit tests compare pruning and forced letters against exhaustive
solutions of small crossing grids.

The previous version completed job 9 (same parameters/seed as failed job 8):
23×31, four photos, dictionary filter 1, four results, seven batches, 241.141 seconds.
Comparisons must report successful fills and elapsed time, not just geometries.
One seed is a regression benchmark, not evidence of universal superiority.
The aggressive adaptive-noise experiment returned four fills in 330 seconds;
the conservative fallback returned four in 242 seconds. Early diversification
therefore is not the default. A row-scanner cache was removed after its isolated
benchmark was slower than the direct scan.

The final seeded solver portfolio completed the same four-result regression in
233 seconds (first fill after 24 seconds). A prior run completed in 217 seconds;
these are individual runs, not a statistically established speedup. On the four
persisted geometries, native filling took 3.802 seconds for classic search versus
0.046 seconds for the first-solution portfolio. This measures filling only: the
end-to-end generator is still dominated by structural balancing.

After deploying the rebuilt addon and restarting the local backend, live job 12
completed all four results in 221.595 seconds and five batches, using the same
parameters and seed as job 8. All persisted witnesses were independently checked
for dictionary membership, unique words, geometric invariants and clue ownership.
Each result has four photos with one owned clue per photo and five or six double
arrows. Three-letter answers account for 6.3–8.7% of answers; there are no
two-letter answers in this particular batch (they remain allowed sparingly).

## Geometry construction: October 12 follow-up

Sources were rechecked specifically for layout, not just dictionary filling:

* [Quick generation of crosswords using concatenation (IEEE CoG 2022)](https://ieee-cog.org/2022/assets/papers/paper_194.pdf)
  combines first/best-improvement search and simulated annealing. Its unconstrained
  word-concatenation model does not guarantee our full rectangular coverage,
  embedded definitions or photo ownership, so it is not a drop-in replacement.
* [Ropke & Pisinger, adaptive large neighborhood search](https://pubsonline.informs.org/doi/10.1287/trsc.1050.0135)
  supports multiple competing destroy/repair operators. The follow-up below
  implements a bounded region-level repair inspired by this principle, not the
  full adaptive heuristic from the vehicle-routing paper.
* [Timefold incremental score calculation](https://docs.timefold.ai/timefold-solver/latest/constraints-and-score/score-calculation)
  recommends updating only affected portions instead of recomputing an entire
  problem after every move. This principle is implemented without adding Timefold.
* [Botea's hierarchical CSP](https://www.cse.cuhk.edu.hk/~jlee/cp07Model/pdf/crossword.pdf)
  explicitly fixes blocked cells during solving; despite its title, it is not a
  method for selecting our clue/photo mask.

CPU profiling the first control candidate found 9,777 trial evaluations. Most
time was spent rebuilding string-keyed graphs, enumerating arrow tables and
rescanning the same slots for invariant checks. `MaskRunIndex` now stores runs by
row/column, rescans only trial-flipped lines, and commits line changes only after
accepting a move. Paired trials and rollbacks leave the committed index unchanged.
Connectivity/coverage still receive a full check per trial, using integer cell
indexes and typed arrays rather than string maps. The resulting crossing/length
report is reused during scoring. Final candidates continue to pass the independent
format scanner, ownership verification and complete dictionary witness solver.
Arrow choices are compiled once from the shared format table, preserving ordering
and all supported single/double arrows; no geometric constraint is relaxed.

The first control candidate dropped from 8.222 seconds under CPU profiling to
2.445 seconds in a normal run, with identical fingerprint, RNG position and trial
count. These timings have different instrumentation and are only indicative.
The full read-only four-result benchmark took 81 seconds (previous live run:
221.595 seconds), with the same lengths and five batches. This is one regression
seed, not a general speed guarantee. Topology tests compare 600 seeded masks
against the former string-map algorithm, exercise trial/rollback/paired commits
on grids up to 40×40, and exhaust all 256 local clue neighborhoods for each arrow
direction combination. All seven cutout presets and morphology/diversity smoke
fixtures remain covered.

The installed backend then completed live job 13 in 80.971 seconds: four results,
five batches, no errors. Each result's fingerprint and FSH bytes exactly match its
job-12 counterpart; dictionary witnesses, ownership and all geometric invariants
were independently revalidated. This paired live comparison is approximately
2.74× faster (221.595 / 80.971), preserving the entire control package's geometry.
The selected API/UI/unit suite passed 39 tests; TypeScript/lint passed in both
projects, as did the structure-worker and full generator smoke checks.

## Bounded regional destroy/repair

After exhausting improving single-cell and adjacent-pair moves, clue balancing
can now free a 2×3, 3×2 or 3×3 rectangle near unmatched definitions/answer starts.
`regionalRepair.ts` enumerates the free cells' binary assignments in Gray-code
order. It only evaluates moves affecting at least three cells; singles/pairs were
already covered. Non-mutable cells, photo rectangles/margins and `%` stay fixed.
Every trial is restored in `finally`, including when evaluation throws. Only a
strictly better score with valid connected/covered arrow geometry is accepted.
The incremental run index commits all changed lines together after acceptance.

The repair is limited to two calls per balancing run and 384 evaluations per
call (the utility also enforces a hard 512 ceiling). It does not run on easy
iterations, replace the fast search, or relax any published-result invariant.
`regionalRepairCount` is stored in each result's JSON metrics so an actually
accepted regional move can be distinguished from merely trying the neighborhood.
The best prior fully matched fallback retains its own move count. The usual full
clue/photo ownership, short-word supply and complete dictionary witness checks
still gate publication. No schema migration is needed.

Use `pnpm run test:template-search-benchmark 13 --worker --strong` to test the new
path; append `--no-regional` for the previous search. The seed trajectory changes
once regional search consumes RNG, even if no regional move is accepted: this
must not be confused with a controlled proof that every gain is caused by repair.
The first four-fill experiment took 32 seconds versus about 81 seconds without
repair, and one published geometry used a regional move. This is an individual
run, not a universal speed claim. `pnpm run test:regional-repair-benchmark 13`
compares three seeds with alternating strategy order and checks full witnesses,
dictionary membership and uniqueness without modifying the database.

Tests cover escape from a plateau requiring three simultaneous flips, protected
cells, bounded/reproducible trials, rejection of invalid/non-improving states and
rollback on exceptions. The selected API/UI/unit suite now passes 44 tests.

The paired first-fill experiment completed all six runs with valid witnesses:

| Seed | Previous search | Regional fallback | Batches (previous/new) |
| --- | ---: | ---: | ---: |
| job-13 control | 3.3 s | 10.5 s | 1 / 1 |
| regional-control-1 | 58.0 s | 13.1 s | 2 / 1 |
| regional-control-2 | 49.5 s | 16.5 s | 2 / 1 |

No accepted regional move was needed in these *first* results. On the original
control seed the first geometry takes the same path (no regional trials), so the
timing difference illustrates run-to-run cost variance rather than a regional
algorithm regression. The other seeds consumed regional trials and changed the
subsequent seeded trajectory. Actual accepted regional repair was demonstrated
by the third result in the four-result benchmark, not by this first-fill table.

After installation, live job 14 completed four of four results in 34.534 seconds
and four batches, compared with job 13's 80.971 seconds/five batches on the same
parameters. The first FSH geometry is unchanged; the remaining three differ.
The third result records one accepted regional repair. Independent validation
confirmed complete unique dictionary witnesses, connected covered grids, four
photos with one clue each, five/six double starts and 6.0–8.2% three-letter answers.
No results were appended to an edition. This is a successful control regression,
not a statistically established general speedup or diversity-quality measure.
