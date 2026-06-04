#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { DIRS, type Slot } from "../src/types";
import { solve } from "../src/utils/solver";
import { isNativeCspAvailable, isNativeDlxAvailable } from "../src/utils/nativeDlx";

const rows = ["...", "...", "..."];
const slots: Slot[] = [
  { id: 0, r: 0, c: 0, dir: DIRS.right, len: 3, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 1, r: 1, c: 0, dir: DIRS.right, len: 3, cells: [[1, 0], [1, 1], [1, 2]] },
  { id: 2, r: 2, c: 0, dir: DIRS.right, len: 3, cells: [[2, 0], [2, 1], [2, 2]] },
  { id: 3, r: 0, c: 0, dir: DIRS.down, len: 3, cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 4, r: 0, c: 1, dir: DIRS.down, len: 3, cells: [[0, 1], [1, 1], [2, 1]] },
  { id: 5, r: 0, c: 2, dir: DIRS.down, len: 3, cells: [[0, 2], [1, 2], [2, 2]] },
];
const dict = new Map<number, string[]>([
  [3, ["CAT", "ARE", "TEN", "CAR", "ANT", "TEE", "CAN", "ART", "TEN"]],
]);

function slotWord(grid: string[], slot: Slot): string {
  return slot.cells.map(([r, c]) => grid[r]?.[c] ?? "").join("");
}

function assertValidSolution(grid: string[] | null, allSlots: Slot[], dictionary: Map<number, string[]>) {
  assert.ok(grid, "expected a non-null solution");
  for (const slot of allSlots) {
    const word = slotWord(grid as string[], slot);
    assert.equal(word.length, slot.len, `slot ${slot.id}: invalid word length`);
    assert.ok(!word.includes("."), `slot ${slot.id}: unfilled cell in solution`);
    const bucket = dictionary.get(slot.len) ?? [];
    assert.ok(bucket.includes(word), `slot ${slot.id}: word ${word} is not in dictionary`);
  }
}

function main(): void {
  if (!isNativeDlxAvailable() || !isNativeCspAvailable()) {
    console.log("solver csp parity smoke checks skipped (native dlx/csp solver not available)");
    return;
  }

  const baseOptions = {
    shuffle: false,
    lcv: true,
    uniqueWords: false,
    splitComponents: false,
    restarts: 1,
    parallelRestarts: 1,
  };

  const solvedDlx = solve(rows, slots, dict, {
    ...baseOptions,
    engine: "dlx",
  });
  const solvedCsp = solve(rows, slots, dict, {
    ...baseOptions,
    engine: "csp",
  });

  assertValidSolution(solvedDlx, slots, dict);
  assertValidSolution(solvedCsp, slots, dict);

  console.log("solver csp parity smoke checks passed");
}

main();
