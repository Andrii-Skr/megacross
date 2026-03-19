#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { buildRebalanceBlockedVariantCascade } from "../src/utils/usageRebalance";

function kindList(input: ReturnType<typeof buildRebalanceBlockedVariantCascade>): string {
  return input.map((item) => item.kind).join(",");
}

function main(): void {
  const base = new Set(["A", "B"]);
  const soft = new Set(["A", "B", "C"]);
  const hard = new Set(["A", "B", "C", "D"]);

  const fullCascade = buildRebalanceBlockedVariantCascade(base, soft, hard);
  assert.equal(kindList(fullCascade), "hardAggressive,softOnly,base");

  const noSoftDelta = buildRebalanceBlockedVariantCascade(base, base, hard);
  assert.equal(kindList(noSoftDelta), "hardAggressive,softOnly");

  const noDelta = buildRebalanceBlockedVariantCascade(base, base, base);
  assert.equal(kindList(noDelta), "hardAggressive");

  console.log("rebalance cascade smoke checks passed");
}

main();
