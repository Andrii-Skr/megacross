#!/usr/bin/env ts-node
import assert from "node:assert/strict";
import { DIRS, type Slot } from "../src/types";
import { solve } from "../src/utils/solver";
import { isNativeDlxAvailable } from "../src/utils/nativeDlx";

const rows = ["..", ".."];

const slots: Slot[] = [
  { id: 0, r: 0, c: 0, dir: DIRS.right, len: 2, cells: [[0, 0], [0, 1]] },
  { id: 1, r: 1, c: 0, dir: DIRS.right, len: 2, cells: [[1, 0], [1, 1]] },
  { id: 2, r: 0, c: 0, dir: DIRS.down, len: 2, cells: [[0, 0], [1, 0]] },
  { id: 3, r: 0, c: 1, dir: DIRS.down, len: 2, cells: [[0, 1], [1, 1]] },
];

const dict = new Map<number, string[]>([
  [2, ["AB", "CD", "AC", "BD", "AD", "CB"]],
]);

const wordPriority = new Map<string, number>([
  ["AB", 30],
  ["CD", 40],
  ["AC", 0],
  ["BD", 10],
  ["AD", 20],
  ["CB", 5],
]);

const baseOptions = {
  engine: "dlx" as const,
  lcv: true,
  shuffle: false,
  uniqueWords: true,
  splitComponents: false,
  restarts: 1,
  parallelRestarts: 1,
  wordPriority,
};

function main(): void {
  if (!isNativeDlxAvailable()) {
    console.log("solver priority slack smoke checks skipped (native solver not available)");
    return;
  }

  const nativeSlack0 = solve(rows, slots, dict, {
    ...baseOptions,
    nativeDlx: true,
    lcvPrioritySlack: 0,
  });
  const nativeSlack4 = solve(rows, slots, dict, {
    ...baseOptions,
    nativeDlx: true,
    lcvPrioritySlack: 4,
  });

  assert.ok(nativeSlack0, "native solve with slack=0 should succeed");
  assert.ok(nativeSlack4, "native solve with slack=4 should succeed");

  assert.deepEqual(nativeSlack0, nativeSlack4, "native slack smoke: solutions differ");
  console.log("solver priority slack smoke checks passed");
}

main();
