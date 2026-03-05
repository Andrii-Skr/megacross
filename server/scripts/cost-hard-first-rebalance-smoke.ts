#!/usr/bin/env ts-node
import assert from "node:assert/strict";
import {
  buildCostHardFirstRebalanceBlockedVariants,
  buildUsageRebalanceMetrics,
  type UsageRebalanceContext,
} from "../src/utils/usageRebalance";

function buildMockContext(): UsageRebalanceContext {
  return {
    mode: "cost",
    softHotWords: new Set(["HOT", "HARD"]),
    hardCandidatesByLen: new Map([
      [4, [{ word: "HARD", len: 4, useCount: 10 }]],
    ]),
    wordLenInfoByWord: new Map([
      ["HOT", { len: 4, count: 1 }],
      ["HARD", { len: 4, count: 1 }],
    ]),
    dictWordCountByLen: new Map([[4, 20]]),
    thresholdByLen: new Map([[4, { softThreshold: 3, hardThreshold: 4 }]]),
    balanceByLen: new Map(),
  };
}

function main(): void {
  const context = buildMockContext();
  const metrics = buildUsageRebalanceMetrics();
  const lenCounts = new Map<number, number>([[4, 5]]);
  const usedWordCount = new Map<string, number>([["HOT", 1]]);

  const noHardVariants = buildCostHardFirstRebalanceBlockedVariants(
    new Set<string>(),
    usedWordCount,
    lenCounts,
    context,
    undefined,
    { allowHardFirst: false }
  );
  assert.deepEqual(noHardVariants.map((variant) => variant.kind), ["softOnly", "base"]);

  const hardFirstVariants = buildCostHardFirstRebalanceBlockedVariants(
    new Set<string>(),
    usedWordCount,
    lenCounts,
    context,
    metrics,
    { allowHardFirst: true }
  );
  assert.equal(hardFirstVariants[0]?.kind, "hardAggressive");
  assert.equal(hardFirstVariants[1]?.kind, "softOnly");
  assert.equal(hardFirstVariants[2]?.kind, "base");
  assert.ok(metrics.softBlocked > 0, "soft block metric should grow");
  assert.ok(metrics.hardApplied > 0, "hard-lite first pass should apply hard blocks");

  console.log("cost hard-first rebalance smoke checks passed");
}

main();
