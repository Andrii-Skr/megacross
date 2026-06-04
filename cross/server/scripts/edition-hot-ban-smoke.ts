#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  relaxHotBanForLenDeficits,
  resolveEditionHotBanThresholds,
  resolveWordHotBanState,
} from "../src/utils/editionHotBan";

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

  const thresholds = resolveEditionHotBanThresholds(dict, usageByWord);
  const len3Thresholds = thresholds.thresholdsByLen.get(3);
  const len9Thresholds = thresholds.thresholdsByLen.get(9);
  assert.ok(len3Thresholds, "len=3 thresholds are expected");
  assert.ok(len9Thresholds, "len=9 thresholds are expected");

  assert.equal(len3Thresholds.fallbackToGlobal, false);
  assert.equal(len9Thresholds.fallbackToGlobal, true);
  assert.equal(len9Thresholds.entryThreshold, thresholds.entryThreshold);
  assert.equal(len9Thresholds.exitThreshold, thresholds.exitThreshold);
  assert.ok(len3Thresholds.entryThreshold >= 3);
  assert.ok(len3Thresholds.exitThreshold < len3Thresholds.entryThreshold);

  const hysteresis = { entryThreshold: 10, exitThreshold: 7 };
  assert.equal(resolveWordHotBanState(10, false, hysteresis), true);
  assert.equal(resolveWordHotBanState(9, false, hysteresis), false);
  assert.equal(resolveWordHotBanState(7, true, hysteresis), true);
  assert.equal(resolveWordHotBanState(6, true, hysteresis), false);

  const deficitDict = new Map<number, string[]>([[3, ["AAA", "BBB", "CCC", "DDD"]]]);
  const lenCounts = new Map<number, number>([[3, 2]]);
  const baseBlockedWords = new Set<string>(["DDD"]);
  const hotBannedWords = new Set<string>(["AAA", "BBB"]);
  const hotUsageByWord = new Map<string, number>([
    ["AAA", 100],
    ["BBB", 3],
  ]);
  const relaxed = relaxHotBanForLenDeficits(
    lenCounts,
    deficitDict,
    baseBlockedWords,
    hotBannedWords,
    hotUsageByWord
  );
  assert.ok(relaxed.blockedWords.has("AAA"), "most hot word should stay blocked");
  assert.ok(!relaxed.blockedWords.has("BBB"), "least hot word should be unblocked first");
  assert.ok(relaxed.blockedWords.has("DDD"), "base block should stay intact");
  assert.ok(relaxed.relaxedWords.has("BBB"));
  assert.equal(relaxed.relaxedByLen.get(3), 1);
  assert.equal(relaxed.unresolvedDeficitsByLen.size, 0);
  assert.equal(relaxed.appliedHotWords, 1);

  console.log("edition hot-ban smoke checks passed");
}

main();
