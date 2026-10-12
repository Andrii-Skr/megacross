# DLX inspection and comparison — October 12, 2026

## Sources and changes

Primary references:

- [Knuth's DLX2 / Algorithm C](https://cs.stanford.edu/~knuth/programs/dlx2.w):
  colored secondary columns and avoiding unlink/relink work on compatible nodes
  of already purified columns. The native solver now uses this optimization.
- [Knuth's DLX-PRE](https://cs.stanford.edu/~knuth/programs/dlx-pre.w):
  preprocessing exact-cover candidates. Our crossword-specific adaptation runs
  letter-domain consistency and singleton uniqueness before constructing the
  matrix; it reuses the tested bitset propagation implementation, not CSP search.
- [Knuth's program catalogue](https://cs.stanford.edu/~knuth/programs.html):
  distinguishes colored exact cover, min-cost cover (DLX5), and domain-consistent
  variants. First valid fill and minimum-usage-cost fill are different objectives.

Other changes: one reusable undo-node trail per DLX matrix replaces separately
allocated removal lists for every purified column; deadline checks also cover
matrix construction. DLX now honors the provided seed. Word priorities,
uniqueness and rebalance policies are not weakened or bypassed.

The experiment replacing weighted selection with strict minimum-column selection
and domain-aware LCV failed on this corpus (0/3 compared with 1/3). Therefore the
historical weighted strategy/static LCV remain the default; the alternative is
opt-in via `dlxLegacyHeuristic: false`. Preprocessing can be disabled with
`dlxPreprocess: false` for regression isolation. Neither option changes the UI's
chosen engine; ordinary fill jobs still default to DLX.

## Protocol

Input: fill job **128**, issue 76, filter 1, generated templates
`generated_16_2.fsh`, `generated_16_3.fsh`, `generated_16_4.fsh`. The pre-change
native addon was saved separately and loaded directly for the baseline.

All modes use one frozen edition-usage snapshot, the same sorted initial
dictionary and cost-mode rebalance cascade, unique words, LCV with priority slack
1,000,000, two serial restarts, **200,000 nodes / 10 seconds per attempt**.
If a hard-ban variant fails, the same cascade retries the base variant. The time
limit is an experimental cap; the original production job did not have it.

The bundle comparison strictly excludes words used in earlier successful fills.
Thus initial inputs and policies are the same, but later exclusion sets depend
on each mode's own earlier answers. A separate one-template comparison supplies
exactly identical dictionaries to all modes. Every returned answer is checked
for dictionary membership, full slot coverage, within-template uniqueness and
cross-template uniqueness. No jobs, files in editions or usage counters are
updated by either benchmark.

CSP uses maintained arc consistency and `firstSolution: true` to match DLX's
first-valid-fill objective; this does not claim globally minimum historical usage.
The old addon ignores `seed`, so shuffled baseline tie choices are not perfectly
reproducible. These are small measured samples, not universal speed rankings.

## Results

### Entire three-template bundle

| Mode | Filled | Total elapsed (including failures) | Words in completed fills | Duplicate occurrences |
| --- | ---: | ---: | ---: | ---: |
| Saved original DLX | 1/3 | 80.275 s | 155 | 0 |
| Improved DLX, retained strategy | 1/3 | 75.036 s | 155 | 0 |
| CSP, maintained consistency | 3/3 | 1.304 s | 459 | 0 |

The small DLX time reduction does not fix its search-budget failures on templates
2 and 3. Timed-out/limited attempts are not UNSAT proofs. CSP completed the hard
rebalance variant for all three fills and maintained zero repetitions across the
entire bundle. This is why CSP fallback merits consideration for these templates;
the production engine has **not** been switched automatically.

### Same single template, same dictionary and usage snapshot

| Mode | Time | Mean previous edition uses / selected word | Words above their length's historical hard threshold | Duplicates |
| --- | ---: | ---: | ---: | ---: |
| Saved original DLX | 2.069 s | 62.93 | 0 | 0 |
| Improved DLX | 1.799 s | 62.24 | 0 | 0 |
| CSP | 0.035 s | 61.17 | 1 | 0 |

Lower average historical usage does **not** imply a win on every length or on the
high-frequency tail. For example, mean usage of length-3 words in this single
template was 112.54 / 121.23 / 118.62 respectively. In the bundle CSP selected two
words above their length's hard threshold, while the completed DLX fills selected
none. The existing length-safe hard-ban policy intentionally does not ban every
word above the threshold. Aggregate means for 1/3 versus 3/3 should not be used
as a direct quality ranking, since their length mixtures and coverage differ.

## Reproduce

Save the old addon before rebuilding, then set `DLX_BASELINE_PATH` to that saved
file and `DLX_NATIVE_PATH` to the test build. Run:

```sh
node --import tsx scripts/dlx-csp-comparison.ts 128 /private/tmp/comparison.json
node --import tsx scripts/dlx-csp-comparison.ts 128 /private/tmp/single.json --template=generated_16_4.fsh
```

The script requires both addons in the same process; do not overwrite a loaded
native library. JSON reports include per-template failures, accepted rebalance
variant and historical usage statistics broken down by word length.

Validation includes exhaustive SAT/UNSAT agreement with brute force on 63 small
dictionary subsets, unique/nonunique modes and preprocessing on/off; fixed
Cyrillic letters, deterministic seed and progress/no-progress parity; native
priority-slack, rebalance, polishing and CSP parity smoke tests. TypeScript/lint
and the selected 44 API/UI/unit tests are also checked.

The final native build was installed after confirming no active recent fill or
generator jobs, and the local backend was restarted. Installed-addon parity and
priority-slack smoke checks passed. The existing default engine remains DLX;
benchmarking did not alter fill job 128, issue files or edition usage counters.
