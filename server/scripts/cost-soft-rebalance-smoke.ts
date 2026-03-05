#!/usr/bin/env ts-node
import assert from "node:assert/strict";
import {
  buildSoftOnlyRebalanceBlockedVariants,
  buildUsageRebalanceContext,
  buildUsageRebalanceMetrics,
  resolveUsageRebalanceThresholds,
} from "../src/utils/usageRebalance";

function main(): void {
  const dict = new Map<number, string[]>([
    [3, ["AAA", "AAB", "AAC", "AAD"]],
  ]);
  const usageByWord = new Map<string, number>([
    ["AAA", 20],
    ["AAB", 18],
    ["AAC", 1],
    ["AAD", 0],
  ]);

  const thresholds = resolveUsageRebalanceThresholds(dict, usageByWord, "cost");
  const context = buildUsageRebalanceContext(dict, usageByWord, thresholds);
  const metrics = buildUsageRebalanceMetrics();

  const variants = buildSoftOnlyRebalanceBlockedVariants(
    new Set<string>(),
    new Map<string, number>([
      ["AAA", 1],
      ["AAB", 1],
    ]),
    context,
    metrics
  );

  assert.equal(variants[0]?.kind, "softOnly");
  assert.equal(variants[1]?.kind, "base");
  assert.ok(!variants.some((variant) => variant.kind === "hardAggressive"));
  assert.ok(metrics.softBlocked > 0, "cost mode should produce soft blocks when hot words were reused");

  const noSoftVariants = buildSoftOnlyRebalanceBlockedVariants(
    new Set<string>(),
    new Map<string, number>(),
    context
  );
  assert.deepEqual(
    noSoftVariants.map((variant) => variant.kind),
    ["base"],
    "cost mode should fall back to base when no soft blocks were produced"
  );

  console.log("cost soft-only rebalance smoke checks passed");
}

main();
