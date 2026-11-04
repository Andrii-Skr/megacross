import assert from "node:assert/strict";
import { DIRS, type Slot } from "../src/types";
import { solve, type SolveOptions } from "../src/utils/solver";
import { solveCspNativeAsync, solveDlxNativeAsync } from "../src/utils/nativeDlx";
import { runSolverProbe } from "../src/utils/fillFallback";
import { findKeywordPlacements } from "../src/services/fillJobTemplateSetupService";
import type { TemplateEntry } from "../src/services/fillJobTemplateService";
import { polishSolvedRowsByCost } from "../src/utils/solutionPolish";

// The right-hand slot is disconnected and remains free to use unmarked DOG.
// Non-contiguous IDs exercise serialization and native component remapping.
const slots: Slot[] = [
  { id: 7, r: 0, c: 0, dir: DIRS.right, len: 3, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 13, r: 0, c: 2, dir: DIRS.down, len: 2, cells: [[0, 2], [1, 2]] },
  { id: 22, r: 1, c: 4, dir: DIRS.right, len: 3, cells: [[1, 4], [1, 5], [1, 6]] },
];
const rows = ["...#...", "..O#D.."];
const dict = new Map([[3, ["DOG", "CAR", "CAT"]], [2, ["TO", "RX"]]]);
const allowed = new Map([[7, new Set(["CAT", "CAR"])]]);
let count = 0;
for (const engine of ["csp", "dlx"] as const) {
  for (const splitComponents of [false, true]) {
    for (const dlxPreprocess of [false, true]) {
      for (const dlxLegacyHeuristic of [false, true]) {
        const options: SolveOptions = {
          engine, splitComponents, dlxPreprocess, dlxLegacyHeuristic,
          allowedWordsBySlot: allowed, shuffle: true, restarts: 2,
          parallelRestarts: 2, uniqueWords: true, maxMs: 5000,
        };
        const check = (solved: string[] | null | undefined) => {
          assert.ok(solved, `${engine}: constrained solve must succeed`);
          assert.equal(solved[0].slice(0, 3), "CAT", "photo candidate must satisfy intersections");
          assert.equal(solved[1].slice(4), "DOG", "ordinary slot can use an unmarked word");
        };
        check(solve(rows, slots, dict, options));
        const asyncSolve = engine === "csp" ? solveCspNativeAsync : solveDlxNativeAsync;
        check(await asyncSolve(rows, slots, dict, options));
        const empty = { ...options, allowedWordsBySlot: new Map([[7, new Set<string>()]]) };
        assert.equal(solve(rows, slots, dict, empty), null, "empty domain cannot fall back to arbitrary words");
        assert.equal(await asyncSolve(rows, slots, dict, empty), null);
        assert.equal(solve(["DOG#...", rows[1]], slots, dict, options), null, "fixed unmarked word must fail");
        count += 1;
      }
    }
  }
  const probe = runSolverProbe(rows, slots, dict, { engine, allowedWordsBySlot: new Map([[7, new Set<string>()]]) });
  assert.equal(probe.solved, null, "probe must preserve photo restrictions");
  assert.ok(solve(rows, slots, dict, { engine }), "unrestricted callers retain previous behavior");
}
const polish = polishSolvedRowsByCost({
  solvedRows: ["CAT"], slots: [{ ...slots[0], id: 0 }],
  dict: new Map([[3, ["CAT", "DOG"]]]), uniqueWords: true,
  priorityByWord: new Map([["CAT", 100], ["DOG", 0]]),
  allowedWordsBySlot: new Map([[0, new Set(["CAT"])]]),
});
assert.deepEqual(polish.solvedRows, ["CAT"], "cost polish must not introduce an unmarked word");
console.log(`Imageability: ${count} native configurations passed (sync/async, empty domains, fixed words, intersections, components, restarts), plus probe and polish checks.`);

// An unsupported keyword letter must not be placed using an unmarked word.
const entry: TemplateEntry = {
  key: "photo", name: "photo", sourceName: "photo.fsh", path: "photo.fsh", order: 0,
  grid: { rows: 1, cols: 3, data: ["..."], codes: [[0, 0, 0]], marker: "000" },
  slots: [{ ...slots[0], id: 0 }], startNumberBySlotId: new Map(), startPositions: [], lenCounts: new Map([[3, 1]]),
  stats: { slots: 1, letters: 3, uniqueCells: 3, intersections: 0, density: 1, maxDegree: 0, avgDegree: 0, degreeSqSum: 0 },
};
const keywordDict = new Map([[3, ["CAT", "DOG"]]]);
assert.ok("placements" in findKeywordPlacements(entry, keywordDict, new Map(), "O"));
const keywordResult = findKeywordPlacements(entry, keywordDict, new Map(), "O", 128, { allowedWordsBySlot: new Map([[0, new Set(["CAT"])]]) });
assert.ok("error" in keywordResult || keywordResult.placements.length === 0, "keyword placement must respect photo domains");
console.log("Imageability: keyword placement preserves photo domains.");
