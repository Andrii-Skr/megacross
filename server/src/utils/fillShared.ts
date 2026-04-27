import type { SolveFailInfo } from "./solver";

export function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

export function getWordPriority(priorityByWord: Map<string, number>, word: string): number {
  return priorityByWord.get(normalizeWordKey(word)) ?? 0;
}

export function sortDictionaryByUsagePriority(
  dict: Map<number, string[]>,
  priorityByWord: Map<string, number>
): void {
  if (!priorityByWord.size) return;
  for (const words of dict.values()) {
    words.sort((left, right) => {
      const scoreDiff = getWordPriority(priorityByWord, left) - getWordPriority(priorityByWord, right);
      if (scoreDiff !== 0) return scoreDiff;
      return left.localeCompare(right, "ru");
    });
  }
}

export function collectWordCounts(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    const key = normalizeWordKey(word);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function extractFailedSlotLength(info: SolveFailInfo | null): number | null {
  const len = info?.detail?.slot?.len;
  if (typeof len !== "number" || !Number.isFinite(len) || len <= 0) return null;
  return Math.trunc(len);
}
