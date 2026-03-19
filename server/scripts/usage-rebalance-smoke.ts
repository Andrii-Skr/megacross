#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  applyHardHotBanLengthSafe,
  buildLenMeanUsagePriority,
  buildUsageRebalanceContext,
  resolveUsageRebalanceThresholds,
} from "../src/utils/usageRebalance";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function makeWord(len: number, index: number): string {
  let n = index;
  const chars = Array.from({ length: len }, () => {
    const ch = ALPHABET[n % ALPHABET.length] ?? "A";
    n = Math.floor(n / ALPHABET.length);
    return ch;
  });
  return chars.reverse().join("");
}

function main(): void {
  const len3Words = Array.from({ length: 80 }, (_, i) => makeWord(3, i));
  const len9Words = Array.from({ length: 20 }, (_, i) => makeWord(9, i));

  const dict = new Map<number, string[]>([
    [3, len3Words],
    [9, len9Words],
  ]);

  const usageByWord = new Map<string, number>();
  for (const [index, word] of len3Words.entries()) {
    if (index < 12) {
      usageByWord.set(word, 80);
    } else if (index < 32) {
      usageByWord.set(word, 10);
    } else {
      usageByWord.set(word, 1);
    }
  }
  for (const word of len9Words) {
    usageByWord.set(word, 2);
  }

  const thresholds = resolveUsageRebalanceThresholds(dict, usageByWord, "aggressive");
  assert.equal(thresholds.mode, "aggressive");

  const len3Thresholds = thresholds.thresholdsByLen.get(3);
  const len9Thresholds = thresholds.thresholdsByLen.get(9);
  assert.ok(len3Thresholds, "len=3 thresholds are expected");
  assert.ok(len9Thresholds, "len=9 thresholds are expected");

  assert.equal(len3Thresholds.fallbackToGlobal, false);
  assert.equal(len9Thresholds.fallbackToGlobal, true);
  assert.ok(
    len9Thresholds.softThreshold <= thresholds.softThreshold,
    "small-sample len should not be stricter than global threshold"
  );
  assert.ok(
    len9Thresholds.hardThreshold <= thresholds.hardThreshold,
    "small-sample len hard threshold should be blended toward local stats"
  );
  assert.ok(len9Thresholds.softThreshold >= 2);
  assert.ok(len9Thresholds.hardThreshold >= len9Thresholds.softThreshold + 1);
  assert.ok(len3Thresholds.softThreshold >= 3);
  assert.ok(len3Thresholds.hardThreshold >= len3Thresholds.softThreshold + 1);
  assert.ok(len3Thresholds.meanUsage > 0);

  const context = buildUsageRebalanceContext(dict, usageByWord, thresholds);
  const len3Balance = context.balanceByLen.get(3);
  assert.ok(len3Balance, "len=3 balance row is expected");
  assert.ok((len3Balance?.maxToP50Ratio ?? 0) >= 4, "len=3 should be pressure-heavy");
  assert.ok((len3Balance?.p90ToP50Ratio ?? 0) >= 1, "len=3 should include p90/p50 skew metric");
  assert.ok((len3Balance?.meanToP50Ratio ?? 0) >= 1, "len=3 should expose mean/p50 ratio");

  const meanPriority = buildLenMeanUsagePriority(dict, usageByWord, "aggressive");
  const lowWord = len3Words[70] as string;
  const highWord = len3Words[0] as string;
  assert.ok(
    (meanPriority.get(lowWord) ?? 0) < (meanPriority.get(highWord) ?? 0),
    "under-mean words must be prioritized before over-mean words for same length"
  );

  const lenCounts = new Map<number, number>([[3, 40]]);
  const hardResult = applyHardHotBanLengthSafe(lenCounts, new Set(), context);
  assert.ok(hardResult.hardCandidates > 0, "hard candidates should exist for len=3");
  assert.ok(hardResult.hardApplied > 0, "hard ban should be applied under aggressive profile");
  assert.ok((hardResult.hardAppliedByLen.get(3) ?? 0) > 0, "len=3 hard ban counter should grow");

  console.log("usage rebalance smoke checks passed");
}

main();
