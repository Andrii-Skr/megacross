import type { Slot } from "../types";

type Dict = Map<number, string[]>;

const DEFAULT_MAX_PASSES = 2;
const DEFAULT_REPEAT_PENALTY = 1_000_000_000;

export type PolishSolutionOptions = {
  solvedRows: string[];
  slots: Slot[];
  dict: Dict;
  uniqueWords: boolean;
  maxPasses?: number;
  priorityByWord?: Map<string, number>;
  usedWordCountByWord?: Map<string, number>;
  forbiddenWords?: Set<string>;
  repeatPenalty?: number;
};

export type PolishSolutionResult = {
  solvedRows: string[];
  improved: boolean;
  replacements: number;
  totalDeltaCost: number;
  passCount: number;
  examinedCandidates: number;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function buildCellUsageCount(slots: Slot[]): Map<string, number> {
  const cellUsageCount = new Map<string, number>();
  for (const slot of slots) {
    for (const [r, c] of slot.cells) {
      const key = `${r},${c}`;
      cellUsageCount.set(key, (cellUsageCount.get(key) ?? 0) + 1);
    }
  }
  return cellUsageCount;
}

function matchesPattern(word: string, pattern: string): boolean {
  if (word.length !== pattern.length) return false;
  for (let i = 0; i < word.length; i += 1) {
    const required = pattern[i];
    if (required !== "." && required !== word[i]) return false;
  }
  return true;
}

function computeWordCost(
  wordKey: string,
  priorityByWord: Map<string, number> | undefined,
  usedWordCountByWord: Map<string, number> | undefined,
  repeatPenalty: number
): number {
  const priority = priorityByWord?.get(wordKey) ?? 0;
  const usedCount = usedWordCountByWord?.get(wordKey) ?? 0;
  return priority + usedCount * repeatPenalty;
}

export function polishSolvedRowsByCost(options: PolishSolutionOptions): PolishSolutionResult {
  const {
    solvedRows,
    slots,
    dict,
    uniqueWords,
    priorityByWord,
    usedWordCountByWord,
    forbiddenWords,
  } = options;
  if (!solvedRows.length || !slots.length) {
    return {
      solvedRows,
      improved: false,
      replacements: 0,
      totalDeltaCost: 0,
      passCount: 0,
      examinedCandidates: 0,
    };
  }

  const repeatPenalty =
    typeof options.repeatPenalty === "number" && Number.isFinite(options.repeatPenalty)
      ? options.repeatPenalty
      : DEFAULT_REPEAT_PENALTY;
  const maxPasses =
    typeof options.maxPasses === "number" && Number.isFinite(options.maxPasses) && options.maxPasses > 0
      ? Math.floor(options.maxPasses)
      : DEFAULT_MAX_PASSES;
  const normalizedForbidden = new Set<string>();
  if (forbiddenWords?.size) {
    for (const word of forbiddenWords) {
      const key = normalizeWordKey(word);
      if (key) normalizedForbidden.add(key);
    }
  }

  const grid = solvedRows.map((row) => [...row]);
  const cellUsageCount = buildCellUsageCount(slots);
  const currentWordBySlot = new Map<number, string>();
  const templateWordCount = new Map<string, number>();
  for (const slot of slots) {
    const word = slot.cells.map(([r, c]) => grid[r]?.[c] ?? "").join("");
    const key = normalizeWordKey(word);
    currentWordBySlot.set(slot.id, key);
    templateWordCount.set(key, (templateWordCount.get(key) ?? 0) + 1);
  }

  let replacements = 0;
  let totalDeltaCost = 0;
  let examinedCandidates = 0;
  let passCount = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improvedInPass = false;
    passCount += 1;

    const orderedSlots = [...slots].sort((a, b) => {
      const wordA = currentWordBySlot.get(a.id) ?? "";
      const wordB = currentWordBySlot.get(b.id) ?? "";
      const costA = computeWordCost(wordA, priorityByWord, usedWordCountByWord, repeatPenalty);
      const costB = computeWordCost(wordB, priorityByWord, usedWordCountByWord, repeatPenalty);
      if (costA !== costB) return costB - costA;
      return a.id - b.id;
    });

    for (const slot of orderedSlots) {
      const currentWord = currentWordBySlot.get(slot.id) ?? "";
      if (!currentWord) continue;

      let pattern = "";
      for (const [r, c] of slot.cells) {
        const key = `${r},${c}`;
        pattern += (cellUsageCount.get(key) ?? 0) > 1 ? grid[r]?.[c] ?? "." : ".";
      }

      const bucket = dict.get(slot.len) ?? [];
      if (!bucket.length) continue;

      const currentCost = computeWordCost(
        currentWord,
        priorityByWord,
        usedWordCountByWord,
        repeatPenalty
      );
      let bestWord = currentWord;
      let bestCost = currentCost;

      for (const candidateRaw of bucket) {
        const candidate = normalizeWordKey(candidateRaw);
        if (!candidate || candidate === currentWord) continue;
        if (!matchesPattern(candidate, pattern)) continue;
        examinedCandidates += 1;

        if (normalizedForbidden.has(candidate)) continue;
        if (uniqueWords) {
          const usedInTemplate = templateWordCount.get(candidate) ?? 0;
          if (usedInTemplate > 0) continue;
        }

        const candidateCost = computeWordCost(
          candidate,
          priorityByWord,
          usedWordCountByWord,
          repeatPenalty
        );
        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestWord = candidate;
        }
      }

      if (bestWord === currentWord || bestCost >= currentCost) continue;

      for (let i = 0; i < slot.cells.length; i += 1) {
        const [r, c] = slot.cells[i];
        grid[r][c] = bestWord[i] as string;
      }
      currentWordBySlot.set(slot.id, bestWord);
      const currentCount = (templateWordCount.get(currentWord) ?? 1) - 1;
      if (currentCount <= 0) templateWordCount.delete(currentWord);
      else templateWordCount.set(currentWord, currentCount);
      templateWordCount.set(bestWord, (templateWordCount.get(bestWord) ?? 0) + 1);

      improvedInPass = true;
      replacements += 1;
      totalDeltaCost += currentCost - bestCost;
    }

    if (!improvedInPass) break;
  }

  return {
    solvedRows: grid.map((row) => row.join("")),
    improved: replacements > 0,
    replacements,
    totalDeltaCost,
    passCount,
    examinedCandidates,
  };
}
