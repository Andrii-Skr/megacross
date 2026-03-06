#!/usr/bin/env ts-node
import assert from "node:assert/strict";
import { DIRS, type Slot } from "../src/types";
import { solve } from "../src/utils/solver";
import { isNativeCspAvailable } from "../src/utils/nativeDlx";

const satRows = ["..", ".."];
const satSlots: Slot[] = [
  { id: 0, r: 0, c: 0, dir: DIRS.right, len: 2, cells: [[0, 0], [0, 1]] },
  { id: 1, r: 1, c: 0, dir: DIRS.right, len: 2, cells: [[1, 0], [1, 1]] },
  { id: 2, r: 0, c: 0, dir: DIRS.down, len: 2, cells: [[0, 0], [1, 0]] },
  { id: 3, r: 0, c: 1, dir: DIRS.down, len: 2, cells: [[0, 1], [1, 1]] },
];
const satDict = new Map<number, string[]>([[2, ["AB", "CD", "AC", "BD", "AD", "CB"]]]);

const unsatRows = ["..", ".."];
const unsatSlots: Slot[] = [
  { id: 0, r: 0, c: 0, dir: DIRS.right, len: 2, cells: [[0, 0], [0, 1]] },
  { id: 1, r: 0, c: 1, dir: DIRS.down, len: 2, cells: [[0, 1], [1, 1]] },
];
const unsatDict = new Map<number, string[]>([[2, ["AA", "CC"]]]);

function main(): void {
  if (!isNativeCspAvailable()) {
    console.log("solver csp smoke checks skipped (native csp solver not available)");
    return;
  }

  let progressSeen: { engine?: string } | null = null;
  const solved = solve(satRows, satSlots, satDict, {
    engine: "csp",
    shuffle: false,
    lcv: true,
    uniqueWords: true,
    splitComponents: false,
    restarts: 1,
    parallelRestarts: 1,
    logEveryNodes: 1,
    onProgress: (info) => {
      progressSeen = progressSeen ?? info;
    },
  });

  assert.ok(solved, "csp SAT solve should succeed");
  assert.equal(
    (progressSeen as { engine?: string } | null)?.engine,
    "csp",
    "csp progress engine mismatch"
  );

  let failInfo: { engine?: string; reason?: string } | null = null;
  const unsatSolved = solve(unsatRows, unsatSlots, unsatDict, {
    engine: "csp",
    shuffle: false,
    lcv: true,
    uniqueWords: true,
    splitComponents: false,
    restarts: 1,
    parallelRestarts: 1,
    onFail: (info) => {
      failInfo = info;
    },
  });

  assert.equal(unsatSolved, null, "csp UNSAT solve should return null");
  assert.equal((failInfo as { engine?: string } | null)?.engine, "csp", "csp fail engine mismatch");
  assert.equal(
    (failInfo as { reason?: string } | null)?.reason,
    "forward-check",
    `expected forward-check fail reason, got ${(failInfo as { reason?: string } | null)?.reason ?? "none"}`
  );

  console.log("solver csp smoke checks passed");
}

main();
