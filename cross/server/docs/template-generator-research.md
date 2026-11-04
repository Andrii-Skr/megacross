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

## Geometry quality and diversity: October 15

The structure worker now compares up to three dictionary-prechecked candidates
instead of returning the first one. Each of its three search rounds has at most
six mask attempts. Periodic, banded and woven masks alternate within a round;
the latter two vary the backbone phase by seeded row bands or by both row and
column bands. They retain protected photos, margins and cutouts, and pass the
same final invariant and ownership checks as periodic masks. A worker checkpoint
preserves the current best candidate and its RNG state if the package deadline
expires while looking for a better candidate. Cancellation still discards it.

`quality.ts` is the shared objective for local balancing and candidate ranking.
It includes lengths/short-answer excess, isolated clues, the double-start target,
clue density across available quadrants, the photo centroid, short diagonal
repetition and bridges in the word-intersection graph. These are explicit soft
preferences, not new geometric validity rules or a claim to measure every aspect
of editorial quality. Feasibility penalties remain separate. Results record
the individual penalties, `maskFamily` and `qualityVersion: 2`; old quality scores
are not directly comparable with version 2.

Length-supply constraints now participate in balancing feasibility as well as
the final gate. This prevents spending the whole search optimizing a matched
mask containing unavailable lengths (for example, length 10 in the control
dictionary) only to discard it at the end. Scarce three-letter caps use the same
shared deficit calculation in both places.

Exact canonical fingerprints retain their previous encoding. Near duplicates
are additionally rejected using minimum blocker-mask Jaccard distance over all
supported reflections/transpositions, with a fixed threshold of 0.12. Shared
letter cells and shared cutouts do not dilute the distance. Only persisted,
accepted geometries form this diversity history, including after job recovery;
failed word fills remain exact exclusions without excluding nearby alternatives.
The threshold never silently relaxes when the requested package is difficult.

Clue diagnostics and final assignment now share `clueMatching.ts`. It partitions
independent resource conflicts, uses augmenting paths for singles and branches
over coupled double choices, including leaving a double unmatched in partial
diagnostics. A relaxed bipartite maximum supplies an admissible upper bound.
Diagnostics allow 16 branching nodes; if that budget cannot establish the
optimum they report `matchingExhaustive: false`, and search diagnostics count
`matchingBudgetExhaustions`. Balancing allows 2,048 branching nodes for a full
assignment at a trial state; the standalone assignment API retains its 100,000
default. A truncated search never certifies impossibility or publishes a partial
assignment. Final ownership verification still requires every resource exactly
once. This bounds repeated expensive assignment attempts during local search.

`node --import tsx scripts/template-quality-benchmark.ts` is a database-free,
geometry-only benchmark of two-result packages: 15×11 without photos, 19×14 with
a photo/corner cutout, and 23×31 with four photos. `--quick` selects the first
fixture and `--large` the last. Each fixture has a 240-second budget. The script
checks invariants, ownership, the quality ranking and pairwise distance, and
prints timing, family, quality components and search diagnostics. It deliberately
does not certify dictionary fillability or benchmark the native word solver.

Unit tests compare maximum clue coverage with exhaustive enumeration on 400
seeded small conflict graphs, including full-assignment feasibility. They also
cover a misleading greedy double choice, explicit budget exhaustion, symmetry-
aware near duplicates, reproducible mask families with protected regions, spatial
concentration, diagonal repetition, crossing bridges and photo balance. Service
tests distinguish rejected word fills from accepted diversity history.

The final geometry-only control run completed all three two-result packages:

| Grid / photos | Results | Elapsed | Distance between results |
| --- | ---: | ---: | ---: |
| 15×11 / none | 2/2 | 1.703 s | ≥ 0.12 |
| 19×14 / one, corner cutout | 2/2 | 3.097 s | 0.803 |
| 23×31 / four | 2/2 | 49.652 s | 0.776 |

The large package's second shortlist improved from its first candidate's 0.5242
to the selected candidate's 0.4515 under quality version 2. These are individual
seeded checks, not a statistical speedup, a human quality evaluation or a proof
of dictionary fillability. The selected unit/API/UI suite passed 55 tests;
the generator/worker smoke checks and TypeScript/lint in both projects passed.

## Mixed directions on the top and left boundaries

The former top-row period of two and left-column period of three seeded almost
exclusively downward starts on row 0 and rightward starts on column 0. Boundary
seeding now mixes variable clue groups, short inward starts and 3–7-cell letter
runs. The initial inward collars are protected only at run ends adjacent to a
clue, leaving interior cells available for legal arrows and clue matching.

`boundary.ts` measures actual scanned word directions. If an edge has an
uninterrupted eight-cell segment with a three-cell-deep collar unobstructed by
photos/cutouts, candidate acceptance requires a word running along that edge.
The existing two-crossing invariant then also requires inward words crossing it.
Smaller/obstructed fragments are exempt. This rule applies to generated results,
not to validation of imported legacy templates. Missing parallel words contribute
to balancing feasibility and add boundary locations to regional repair focus.
An additional soft penalty discourages heavily skewed direction proportions.
Quality version 3 records `edgeDirectionPenalty`, `edgeDirectionDeficit`,
`topEdgeAlongWords` and `leftEdgeAlongWords`; version-2 scores above are historical.

Boundary tests cover seeded variation, all-inward versus mixed directions,
cutout/photo collar exemptions, and a fully generated template with valid
topology and unique clue ownership. The geometry benchmark and all preset smoke
fixtures also check the boundary rule; the 23×31 morphology fixture explicitly
requires both directions on row 0 and column 0.

The updated selected suite passed 59 tests; generator/worker smoke checks and
TypeScript/lint passed in both projects. A separate 23×31, one-photo geometry
preview (`double-test`, no dictionary validation) has three horizontal starts on
row 0 alongside thirteen downward starts, and two downward starts on column 0
alongside eight rightward starts. It passes topology and unique clue ownership.
These are geometry checks, not a word-fill or performance claim. An exploratory
150-second run of the screenshot seed with default dictionary counts did not
produce a candidate; its actual dictionary filter was unavailable, so this is
not a reproduction of the original job. The stricter boundary gate can require
more structural search; the earlier version-2 package timings do not measure it.

## Rust geometry engine

The production worker now uses the separate N-API addon in
`native/template-generator` by default. The Rust port includes mask construction,
all cutout/photo placement rules, incremental runs, topology, clue diagnostics and
full assignment, quality version 3, mixed boundaries, regional repair, adaptive
search, canonical fingerprints and similarity filtering. It receives the shared
format arrow table from TypeScript rather than maintaining another copy.

The job API, request/dictionary handling, dictionary precheck, final word-witness
gate and FSH format stay in their existing layers. `nativeGenerator.ts` performs
an independent TypeScript validation of every returned result, including exact
requested cutout cells, photo sizes, ownership, topology, supply, diversity,
boundaries and every quality component. Generated metrics identify the engine.
`CROSS_TEMPLATE_ENGINE=typescript` explicitly selects the reference engine;
missing/incompatible Rust binaries fail with an actionable build instruction.

Native calls execute inside the structure worker. A process-wide registry of
reference-counted atomic stop flags lets the parent interrupt a call after native
work has started, and native deadlines bound work independently of worker timers.
Tokens are released on completion, timeout, cancellation and startup/post errors.
No forced worker termination is relied upon to interrupt native code.

The paired release-build benchmark uses 24 deterministic scenarios, alternating
engine order, with identical attempt budgets. All RNG states and outcomes match;
the 21 successful geometries have byte-identical FSH. Three scenarios exhaust
their budgets in both engines. Accepted results include five regional repairs,
every cutout, automatic photos and a 40×40 grid; manual-photo behavior is also
independently exercised by the native smoke test.

| Measurement | TypeScript | Rust |
| --- | ---: | ---: |
| Sum of 24 geometry-search calls | 53.300 s | 9.145 s |
| Successful geometries | 21 | 21 |
| Exhausted identical attempt budgets | 3 | 3 |

The observed aggregate speedup is **5.83×** for these calls, including the native
bridge and independent result validation. This does not measure complete job
latency with dictionary prechecking and word filling. It is a local comparison;
future platform/toolchain changes must rerun parity checks. The native worker also
completed the three existing two-result geometry packages; the 23×31/four-photo
package completed in 19.480 seconds, without a paired full-package TS timing.

Validation: 59 selected TypeScript unit/API/UI tests, six Rust unit tests,
Rust Clippy, TypeScript/lint in both projects, native smoke, both worker engines,
all-cutout checks, native deadlines, and cancellation of an actively running native
call. Docker packaging builds and checks the addon in the existing builder/runner
stages. Build and test instructions are in `native/template-generator/README.md`.

## Remaining latency after the Rust port: job 26 replay

A read-only replay of the actual 23×31/four-result request (one automatic photo,
seed `021b3338064faa5811b58ab8`, dictionary filter 1) reproduced the original
83.875-second job in 81.701 seconds. Of that, geometry plus independent checks
consumed 48.936 s, dictionary propagation 1.193 s, and word filling 31.388 s.
A single failed fill used the full 30 s; four successful fills used 1.385 s.
All nine old prechecks hit their five-million-operation cap without converging.
There were 427675 geometry evaluations and just 307 memo-cache hits. Blindly
increasing the cache was therefore not the priority.

Changes:

- Bitset dictionary domains with reusable letter indexes complete propagation
  rather than repeatedly allocating/filtering word-string arrays. Incomplete
  propagation remains an uncertain result, never a rejection proof.
- Comparison can stop at a sufficiently balanced candidate after complete
  propagation; otherwise the worker still compares three candidates. The default
  score threshold is 0.45. A trial threshold of 0.50 reduced latency further but
  slightly worsened average geometry quality on this request, so it was tightened.
- Candidate ranking includes propagation uncertainty and narrow domains.
- A 2.5-second fill probe defers hard candidates. A bounded queue retries them with
  the remaining 30-second budget and a different seed if fresh candidates stall.
  Deferred candidates must still satisfy diversity against subsequently accepted
  results. The solver implementation is unchanged.
- Rust caches rendered slot scans/current-state matching diagnostics, shares
  immutable run coordinates, compacts small matching components and replaces
  repeated visited-buffer allocations with visitation stamps. Optional stage
  profiling found matching dominated the measured kernel search.
- Worker diagnostics and accepted metrics expose stage timings. The dictionary
  is sent/indexed once per job instead of cloned into the worker for every batch.

The final replay completed four verified templates in **41.790 s**:

| Stage | Before | After |
| --- | ---: | ---: |
| Geometry and independent validation | 48.936 s | 37.987 s |
| Dictionary precheck | 1.193 s | 0.065 s |
| Fill verification | 31.388 s | 3.485 s |
| Total package | 81.701 s | 41.790 s |

All four individual quality scores match the original job (mean 0.520772888).
The benchmark independently verifies every solved word against the selected
vocabulary, word uniqueness, geometry/ownership and accepted-result diversity.
`pnpm test:template-pipeline --job-id 26` reproduces the read-only pipeline replay;
`--compare-all --full-fill-budget` disables the scheduling optimizations. This is
one complete request, not an across-the-board speed guarantee. Hard geometry
search remains the largest cost and still benefits from further algorithm work.

A second seed, loaded read-only from job 25, also completed four independently
verified fills (38.634 s). Its mean geometry penalty was 0.530701418 versus
0.489691428 in the saved original package. Early stopping changes the stochastic
trajectory and accepted geometries, so equal or better quality on every seed is
not guaranteed. All hard geometry/dictionary/uniqueness constraints still apply;
use `compareAllCandidates: true` to retain exhaustive shortlist comparison when
that tradeoff is undesirable. This second run is a correctness/quality observation,
not a paired latency comparison with the original job.

Validation after scheduling and native matching changes: 76 unit/API/UI tests,
seven Rust unit tests, all 24 TS/Rust RNG/FSH parity cases (21 successes and three
matched budget exhaustions), native active-cancellation/deadline smoke, both
worker engines, TypeScript and lint in both projects, and Rust Clippy.

Set `CROSS_TEMPLATE_COMPARE_ALL_CANDIDATES=1` for the job service to disable early
shortlist stopping globally. An explicit worker `compareAllCandidates` argument
overrides this setting.

## Mandatory geometric words (2026-10-29)

Every maximal horizontal/vertical letter run of length at least two is now a
mandatory word. This includes runs bounded by the field edge, photos and cutouts;
single-cell runs still need coverage in the other direction. The structural
scanners retain overlong and two-letter runs instead of hiding them. Assignment
rejects excess two-letter words, overlong words, weak words and disconnected
components without selecting a subset. Structural repair scores excess short and
overlong runs and includes their surrounding mutable cells in the repair focus.
Photo/cutout protection and all existing word/clue/dictionary constraints remain.

Final Rust verification compares the materialized arrow slots against all
geometric runs. Independent TypeScript validation compares direction, start and
all cells, with a diagnostic containing the run coordinates and length. Existing
clue ownership checks still require one definition per word. This is confined to
template generation: imports, stored templates and file formats are unchanged.

`pnpm test:template-runs` exercises shared TS/Rust fixtures (including the missing
two-cell word), incremental rollback/commit and structural repairs. Run
`cargo test --locked --manifest-path native/template-generator/Cargo.toml` for the
Rust side, and `node --import tsx scripts/template-run-smoke.ts --fill` to read the
configured Russian dictionary and check two complete unique fills, one with a
5×4 photo and corner cutout. This integration check does not persist results.

The additional constraint changes the search trajectory and can reduce yield
under a fixed budget, particularly with photos and a dictionary missing entire
word lengths. The photo geometry smoke therefore tests geometry independently
of the synthetic sparse dictionary; the integration check retains real dictionary
constraints. On two 15×11 seeds (`profile-15-11`, `parity-3`, 40 attempts, no
photos/cutouts or dictionary constraints), both versions returned 2/2 candidates;
the original native calls took 18/8 ms and the updated independently validated
calls took 23/37 ms. These small, single-run measurements are illustrative, not a
latency guarantee. The real-dictionary integration accepted two filled templates
in about 10.6 seconds across ten seeded search calls, including the photo case.

The broad TypeScript smoke is computationally expensive after this change. The
first run passed the corpus-sized fixtures and the first six cutout cases; its
large enclosed-window search was stopped. The enclosed-window smoke now uses a
15×11 representative mask (large masks remain in the following fixtures). A
separate 23×31 photo stress case did not finish within a 90-second cap, and the
remaining broad TS run was stopped rather than counted as passing. The bounded
native smoke passed all seven cutouts, RNG parity, manual photo geometry and
cancellation; 13 shared geometry fixtures, eight Rust tests, real-dictionary fills,
TypeScript, lint and Clippy passed. No complete large-TS stress result is claimed.

## Search allocation and matching reuse (2026-10-29)

Profiling the strict-run generator found clue matching taking roughly 60–75% of
the large-case native search time. The following changes preserve the search
trajectory, rather than relaxing constraints or changing candidate preferences:

- TypeScript matching uses component-local resource ranks and reusable typed
  arrays for augmenting paths, reservations and selected options. Recursive
  matching no longer allocates Maps/Sets for each single-word completion.
- Both engines cache small conflict components (at most eight starts). Keys
  include resource incidence, option order, remaining shared branch budget and
  full/partial mode; values are option indices, never objects from an old grid.
  Caches live within one structural search, are FIFO-bounded to 2048 entries and
  also cap key storage. A truncated match cannot masquerade as an exact result.
- Rust reuses matching work arrays, maintains reservation counts incrementally,
  and compiles arrow lookup tables by code/direction once per request. The input
  JSON arrow array, code ordering and duplicate-code first-match behavior remain
  unchanged. Final clue ownership and geometric verification remain independent.

`pnpm test:template-search-profile` reports six fixed-seed geometry scenarios.
Use `--typescript --attempts=1` for the TS reference, or the default six attempts
for native profiling. `CROSS_TEMPLATE_TS_MODULE` and `CROSS_TEMPLATE_NATIVE_PATH`
can point to saved baseline versions. Output includes RNG position, geometry,
FSH SHA-256, quality and stage diagnostics. These are bounded geometry trials,
not a promise that every difficult grid can be completed in the attempt budget.

Three paired runs, alternating before/after order and using separate processes,
produced these median totals across the same six cases:

| Engine | Before | After | Speedup |
| --- | ---: | ---: | ---: |
| TypeScript (one attempt per case) | 19.457 s | 10.269 s | 1.895× |
| Rust (six attempts per case) | 10.802 s | 10.128 s | 1.067× |

The three large TS cases improved by 1.732×, 1.973× and 2.063×; small cases were
approximately unchanged (one was about 4% slower). Every pair retained identical
RNG positions, candidate presence, FSH hashes, geometry and quality. Yield stayed
2/6 for these deliberately tight budgets; this is a throughput improvement, not
an improved success rate per attempt. The exact search can do more work before a
wall-clock deadline, while intrinsically difficult layouts still require retries.

Validation: 10 Rust tests, 10 TS quality/search tests, 16,000 direct comparisons
against the previous TS matcher, 13 shared mandatory-run fixtures, deterministic
native/TS smoke including all cutouts and active cancellation, TypeScript/lint
in both projects and Clippy. Two generated grids, including a 5×4 photo with a
corner cutout, also passed complete unique filling against the configured Russian
dictionary without writing jobs/results to the database.

## 23×31 convergence budget (2026-10-29)

The previous balancing limit was `ceil(area / 12)`, or 60 committed moves on a
23×31 board. Under the mandatory-run rule, large masks repeatedly exhausted that
budget before clue ownership and dictionary length supply could converge. The
final change uses `ceil(area / 4)` for boards of at least 600 cells: 179 moves at
23×31. Smaller boards retain the previous limit; the global 180-move ceiling,
cooperative deadlines/cancellation and all geometry/dictionary rules are retained.
Both TypeScript and Rust use the same budget. Large-board RNG trajectories can
therefore differ from the earlier version; this intentionally changes search
scheduling, unlike the matching-only optimization above.

Diagnostics now include `balanceIterations` (state checks, including the final
check) and `balanceIterationLimitStops` (masks discarded at the iteration cap).
`pnpm test:template-large --max-ms=15000` replays three captured requests, with
zero/one photos and the actual dictionary's length counts, without accessing the
DB. Every result is independently checked for mandatory runs, clue ownership,
photo count and dictionary supply. This geometry smoke does not claim full fills.

On the same seeds, counts, 40-attempt cap and 15-second deadline, the prior native
module returned 0/3 grids. The final version returned 3/3 in 8.981, 6.215 and
8.132 seconds. The selected dictionary contains 1323 ten-letter words; the replay
uses that captured count rather than the older synthetic zero-count benchmark.

A read-only full worker replay of the latest no-photo request also completed:
176 unique dictionary words in 35.094 seconds (two fill probes, 0.424227 geometry
penalty). The previous module produced no grid or filled result within a
60-second replay of the same job. These are fixed-seed observations, not a
universal latency guarantee or a four-template package measurement.

The replay script accepts `--result-count` to cap the original package size and
`--max-ms` to bound a run. For example, from `cross/server`:

```
node --import tsx scripts/template-pipeline-benchmark.ts --job-id 36 --result-count 1 --max-ms 90000
```

This reads the job/filter/dictionary but never resumes the job or persists a
result. Failed runs print totals before asserting the requested count.

Photo grids remain harder to fill: the unchanged placement/selection strategy
found valid geometry, but the tested photo worker replay did not complete a fill
within 90 seconds. Longer fill probes did not resolve the tested candidate.
Experiments with corner placement and earlier adaptive diversification were
inconsistent (including slower initial geometry) and were reverted. The final
change retains existing photo placement, quality ranking and fill-probe budgets;
no filled photo result from those experiments is claimed for the shipped code.

Validation of the final code: all three large geometry fixtures; 10 Rust tests;
13 shared mandatory-run fixtures; 20 quality/selection unit tests; native
reproducibility, small TS/Rust parity and active cancellation; a 23×31 one-mask
TS/Rust trajectory comparison; server TypeScript/lint and Clippy. The full
no-photo worker replay above independently verified every filled word, uniqueness,
clue ownership and all geometric invariants.
