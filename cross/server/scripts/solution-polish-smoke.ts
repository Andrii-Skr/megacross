#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { DIRS, type Slot } from "../src/types";
import { polishSolvedRowsByCost } from "../src/utils/solutionPolish";

function main(): void {
  const slots: Slot[] = [
    { id: 0, r: 0, c: 0, dir: DIRS.right, len: 2, cells: [[0, 0], [0, 1]] },
    { id: 1, r: 0, c: 0, dir: DIRS.down, len: 2, cells: [[0, 0], [1, 0]] },
  ];
  const dict = new Map<number, string[]>([
    [2, ["AB", "AC", "AD", "AA"]],
  ]);
  const solvedRows = ["AB", "C#"];
  const priorityByWord = new Map<string, number>([
    ["AB", 100],
    ["AC", 90],
    ["AD", 5],
    ["AA", 0],
  ]);

  const result = polishSolvedRowsByCost({
    solvedRows,
    slots,
    dict,
    uniqueWords: true,
    maxPasses: 3,
    priorityByWord,
  });

  assert.equal(result.improved, true);
  assert.ok(result.replacements >= 1);
  assert.equal(result.solvedRows[0], "AA");
  assert.equal(result.solvedRows[1], "D#");
  assert.ok(result.totalDeltaCost > 0);
  console.log("solution polish smoke checks passed");
}

main();
