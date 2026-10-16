# Rust template generator

This is the arrowword **geometry generator**, separate from `dlx-solver`. It builds
and repairs masks, places photos and cutouts, checks topology, assigns unique clue
resources, scores quality and rejects duplicate/similar geometries. It preserves
mixed starts on row 0 and column 0. The word solver is unchanged.

The production structure worker uses Rust by default. TypeScript retains request
validation, dictionary loading/prechecking, final word-witness validation, FSH
serialization, job persistence, API/UI, and an independent check of every native
result. The former TypeScript search remains the explicit reference engine.

## Build and run

From `cross/server`, with Node.js/pnpm and the Rust toolchain installed:

```sh
pnpm build:template-native
pnpm test:template-rust
node --import tsx scripts/structure-worker-smoke.ts
cargo test --release --locked --manifest-path native/template-generator/Cargo.toml
cargo clippy --release --locked --manifest-path native/template-generator/Cargo.toml -- -D warnings
```

The build uses the checked-in Cargo.lock and atomically installs
`native/template-generator/template_generator.node`. Build it on the target
platform; a macOS binary cannot be copied into a Linux deployment. The server
Dockerfile builds the addon in its existing Rust builder stage, copies only the
binary to the runner, and checks its exports. Restart the backend after a rebuild
so that Node loads the new addon. No database migration is needed.

Configuration:

- `CROSS_TEMPLATE_ENGINE=rust` is the default. A missing/incompatible addon fails
  the job with a build instruction; it does not silently change algorithms.
- `CROSS_TEMPLATE_ENGINE=typescript` explicitly selects the reference search.
- `CROSS_TEMPLATE_NATIVE_PATH` overrides the addon path.

Generated metrics identify `generationEngine`. Seeds and saved RNG states retain
the existing xorshift32 representation; they are passed to Rust without rehashing.

## Runtime boundary

The synchronous N-API `generateTemplate(json, controlId)` call runs **inside the
structure worker**, once per bounded search round. The bridge transmits the shared
format's arrow table and compact parameters, not individual trial evaluations.
The CPU-intensive inner loop uses integer cell/resource IDs and native arrays;
run indexes and bounded mask caches retain the TypeScript search's ordering.

A control token owns an Arc<AtomicBool> in a process-wide registry. The parent
can cancel active work in another Node isolate. Releasing a token both stops it
and removes the registry entry; an in-flight call keeps its Arc alive safely.
Native deadlines and cooperative stop checks cover structural repair, balancing,
matching and regional repair. Parent worker deadlines/cancellation remain active.
Simply terminating a worker is not relied upon to interrupt native execution.

Every returned geometry is independently checked in TypeScript: dimensions,
requested cutout cells and photos, coverage, connected word graph, intersections,
length supply, clue/photo ownership, diversity, mixed boundary directions and all
quality components. Only then is its FSH built. Dictionary prechecking and the
complete unique-word witness remain the publication gates in the job service.

## Validation and measured performance

```sh
pnpm test:template-rust-benchmark
# Short development run:
pnpm test:template-rust-benchmark -- --quick
```

The comparison alternates engine order over 24 deterministic cases: every cutout,
auto/manual photos, 15×11 through 40×40. It compares identical attempt budgets and
asserts RNG state, geometry, quality and exact FSH parity. Failed searches count as
failed searches for both engines, not as successful templates.

The initial local release-build comparison produced identical outcomes in all 24
cases, with 21 successful geometries and three exhausted budgets. Total measured
search-call time, including the native bridge and independent result validation:
**53.300 s TypeScript versus 9.145 s Rust (5.83×)**. Five accepted regional repairs
were exercised. This is a local geometry-search measurement, not an end-to-end
job speed guarantee; dictionary checks, word filling, database and UI are outside
that timing. Floating-point behavior on other toolchains/platforms still needs
parity checks rather than an assumption of universal byte identity.

Rust tests compare clue matching against exhaustive enumeration of 400 small
problems and incremental scans through trial/rollback/commit on grids up to 40×40.
The Node smoke verifies all seven cutouts, manual photos, deterministic results,
input validation, deadlines and cancellation **after native work has started**.

## Pipeline scheduling and read-only profiling

The worker stops candidate comparison early only after completed dictionary
propagation and conservative quality limits: score ≤0.45, length deviation ≤0.25,
repetition ≤0.45, bridge share ≤0.02, no missing boundary direction, and at most
5% narrow word domains. Otherwise it retains the three-candidate comparison.
`compareAllCandidates: true` is available for controlled comparisons.

Dictionary AC-3 uses bitset word domains and per-position letter indexes, cached
for the immutable dictionary within a job. An exhausted propagation budget is
reported as incomplete; it is never treated as proof of an impossible fill.
Ranking accounts for incomplete propagation and narrow domains.

The job service probes each new candidate for up to 2500 ms, configurable through
`CROSS_TEMPLATE_SOLVER_PROBE_MAX_MS`. Hard candidates wait in a bounded queue;
after three unsuccessful batches or four queued candidates, they receive the
remaining part of `CROSS_TEMPLATE_SOLVER_MAX_MS` (default 30000 ms) with another
seed. Their geometry is checked against results accepted while they waited.
The native word solver and all unique-word publication checks are unchanged.
Accepted metrics record geometry/precheck time and fill verification time/count.

Rust reuses rendered slot scans and current-state clue diagnostics. Word runs
share immutable coordinate buffers. Matching solves small conflict components
with compact arrays and uses visitation stamps rather than allocating/resetting
a global resource array for every augmenting path. `profile: true` on a native
search adds `topologyMs`, `matchingMs` and `qualityMs` counters without changing
its random trajectory; profiling is off by default.

```sh
# Reads request and dictionary from an existing job; never changes jobs/results.
pnpm test:template-pipeline --job-id 26
# Disable early stopping and short probes for a scheduling comparison:
pnpm test:template-pipeline --job-id 26 --compare-all --full-fill-budget
```

A local replay of job 26 (23×31, four templates, one automatic photo) took
**81.701 s before versus 41.790 s after**. Geometry/precheck/fill times changed
from 48.936/1.193/31.388 s to 37.987/0.065/3.485 s. All four fills passed dictionary,
uniqueness, topology, clue ownership and diversity checks. Individual geometry
quality scores matched the original job, with identical mean 0.520772888.
These are complete package timings for this seed/dictionary, not a general SLA.

Early stopping changes later random trajectories: a second package replay (job
25) completed four verified fills in 38.634 s, with mean geometry penalty
0.530701418 versus 0.489691428 in its saved package. Quality equality is therefore
specific to the job 26 comparison above. Set `compareAllCandidates: true` when
calling the worker to keep full shortlist comparison; hard publication constraints
remain in force in either mode.

Set `CROSS_TEMPLATE_COMPARE_ALL_CANDIDATES=1` for the job service to disable early
shortlist stopping globally. An explicit worker `compareAllCandidates` argument
overrides this setting.
