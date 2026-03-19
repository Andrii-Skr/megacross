#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  buildEditionUsagePrioritySnapshot,
  resolveEditionUsagePriorityMode,
} from "../src/utils/editionUsageSnapshot";

function sortedEntries(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0], "ru"));
}

function main(): void {
  const dict = new Map<number, string[]>([
    [3, ["AAA", "AAB", "AAC", "AAD", "AAE", "AAF"]],
  ]);
  const usageByWord = new Map<string, number>([
    ["AAA", 40],
    ["AAB", 30],
    ["AAC", 15],
    ["AAD", 5],
    ["AAE", 1],
    ["AAF", 0],
  ]);

  assert.equal(resolveEditionUsagePriorityMode(false, "aggressive"), "safe");
  assert.equal(resolveEditionUsagePriorityMode(true, "safe"), "safe");
  assert.equal(resolveEditionUsagePriorityMode(true, "aggressive"), "aggressive");
  assert.equal(resolveEditionUsagePriorityMode(true, "cost"), "aggressive");

  const sharedMode = resolveEditionUsagePriorityMode(true, "cost");
  const servicePriority = buildEditionUsagePrioritySnapshot(dict, usageByWord, sharedMode);
  const batchPriority = buildEditionUsagePrioritySnapshot(dict, usageByWord, sharedMode);
  assert.deepEqual(
    sortedEntries(servicePriority),
    sortedEntries(batchPriority),
    "service and batch should get identical priorities from shared edition loader helper"
  );

  const hotWord = "AAA";
  const underusedWord = "AAE";
  const zeroUsedWord = "AAF";
  assert.ok(
    (servicePriority.get(underusedWord) ?? 0) < (servicePriority.get(hotWord) ?? 0),
    "shared aggressive priority should prefer underused words over hot words"
  );
  assert.ok(
    (servicePriority.get(zeroUsedWord) ?? 0) < (servicePriority.get(underusedWord) ?? 0),
    "shared aggressive priority should give extra preference to never-used words"
  );

  console.log("edition usage snapshot smoke checks passed");
}

main();
