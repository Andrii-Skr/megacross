type Dict = Map<number, string[]>;
type LenCounts = Map<number, number>;

const HARD_BAN_MAX_APPLIED_ABS = 180;
const HARD_BAN_MAX_APPLIED_SHARE = 0.2;
const HARD_BAN_PER_LEN_ABS = 18;
const HARD_BAN_PER_LEN_NEED_SHARE = 0.35;
const HARD_BAN_SLACK_BUDGET_SHARE = 0.6;
const HARD_BAN_MIN_HEADROOM_ABS = 1;
const HARD_BAN_MIN_HEADROOM_NEED_SHARE = 0.15;

export type UsageRebalanceThresholds = {
  softThreshold: number;
  hardThreshold: number;
  p50: number;
  p95: number;
  p99: number;
};

export type UsageRebalanceMetrics = {
  softBlocked: number;
  hardCandidates: number;
  hardApplied: number;
  hardRelaxed: number;
  hardDisabledBySafety: number;
  hardRetrySoftOnly: number;
};

export type HardHotBanResult = {
  blockedWords: Set<string>;
  hardCandidates: number;
  hardApplied: number;
  hardRelaxed: number;
  disabledBySafety: boolean;
};

type HardCandidate = {
  word: string;
  len: number;
  useCount: number;
};

type WordLenInfo = {
  len: number;
  count: number;
};

export type UsageRebalanceContext = {
  softHotWords: Set<string>;
  hardCandidatesByLen: Map<number, HardCandidate[]>;
  wordLenInfoByWord: Map<string, WordLenInfo>;
  dictWordCountByLen: Map<number, number>;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function safeUsageCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

function percentileCont(sorted: number[], percentile: number): number {
  if (!sorted.length) return 0;
  const p = Number.isFinite(percentile) ? Math.min(1, Math.max(0, percentile)) : 0;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function collectUniqueDictionaryWords(dict: Dict): string[] {
  const words = new Set<string>();
  for (const bucket of dict.values()) {
    for (const word of bucket) {
      const key = normalizeWordKey(word);
      if (key) words.add(key);
    }
  }
  return [...words];
}

export function resolveUsageRebalanceThresholds(
  dict: Dict,
  baseUsageByWord: Map<string, number>
): UsageRebalanceThresholds {
  const words = collectUniqueDictionaryWords(dict);
  const usage = words
    .map((word) => safeUsageCount(baseUsageByWord.get(word)))
    .sort((a, b) => a - b);
  const p50 = percentileCont(usage, 0.5);
  const p95 = percentileCont(usage, 0.95);
  const p99 = percentileCont(usage, 0.99);
  const softThreshold = Math.max(4, Math.ceil(p95), Math.ceil(p50 + 2));
  const hardThreshold = Math.max(5, softThreshold + 1, Math.ceil(p99));
  return {
    softThreshold,
    hardThreshold,
    p50,
    p95,
    p99,
  };
}

export function buildSoftHotDuplicateBlock(
  usedWordCountInRun: Map<string, number>,
  context: UsageRebalanceContext
): Set<string> {
  const blocked = new Set<string>();
  for (const word of context.softHotWords) {
    if ((usedWordCountInRun.get(word) ?? 0) > 0) blocked.add(word);
  }
  return blocked;
}

export function buildUsageRebalanceContext(
  dict: Dict,
  baseUsageByWord: Map<string, number>,
  thresholds: UsageRebalanceThresholds
): UsageRebalanceContext {
  const softHotWords = new Set<string>();
  const hardCandidatesByLen = new Map<number, HardCandidate[]>();
  const hardSeen = new Set<string>();
  const wordLenInfoByWord = new Map<string, WordLenInfo>();
  const dictWordCountByLen = new Map<number, number>();
  for (const [len, bucket] of dict) {
    for (const wordRaw of bucket) {
      const word = normalizeWordKey(wordRaw);
      if (!word) continue;
      dictWordCountByLen.set(len, (dictWordCountByLen.get(len) ?? 0) + 1);
      const info = wordLenInfoByWord.get(word);
      if (!info) {
        wordLenInfoByWord.set(word, { len, count: 1 });
      } else if (info.len === len) {
        info.count += 1;
      }
      const useCount = safeUsageCount(baseUsageByWord.get(word));
      if (useCount >= thresholds.softThreshold) softHotWords.add(word);
      if (useCount >= thresholds.hardThreshold && !hardSeen.has(word)) {
        hardSeen.add(word);
        const list = hardCandidatesByLen.get(len);
        const candidate = { word, len, useCount };
        if (list) {
          list.push(candidate);
        } else {
          hardCandidatesByLen.set(len, [candidate]);
        }
      }
    }
  }
  for (const candidates of hardCandidatesByLen.values()) {
    candidates.sort((a, b) => {
      if (a.useCount !== b.useCount) return b.useCount - a.useCount;
      return a.word.localeCompare(b.word, "ru");
    });
  }
  return {
    softHotWords,
    hardCandidatesByLen,
    wordLenInfoByWord,
    dictWordCountByLen,
  };
}

export function applyHardHotBanLengthSafe(
  lenCounts: LenCounts,
  baseBlockedWords: Set<string>,
  context: UsageRebalanceContext
): HardHotBanResult {
  const normalizedBaseBlocked = new Set<string>();
  for (const word of baseBlockedWords) {
    const key = normalizeWordKey(word);
    if (key) normalizedBaseBlocked.add(key);
  }

  const baseBlockedByLen = new Map<number, number>();
  for (const word of normalizedBaseBlocked) {
    const info = context.wordLenInfoByWord.get(word);
    if (!info) continue;
    baseBlockedByLen.set(info.len, (baseBlockedByLen.get(info.len) ?? 0) + info.count);
  }

  const neededLens: number[] = [];
  for (const [len, need] of lenCounts) {
    if (need > 0) neededLens.push(len);
  }
  if (!neededLens.length) {
    return {
      blockedWords: normalizedBaseBlocked,
      hardCandidates: 0,
      hardApplied: 0,
      hardRelaxed: 0,
      disabledBySafety: false,
    };
  }

  const hardBlocked = new Set<string>();
  const hardBlockedByLen = new Map<number, number>();
  let hardCandidates = 0;
  let hardAppliedEntries = 0;
  for (const len of neededLens) {
    const need = lenCounts.get(len) ?? 0;
    if (need <= 0) continue;
    const candidates = context.hardCandidatesByLen.get(len) ?? [];
    if (!candidates.length) continue;
    const total = context.dictWordCountByLen.get(len) ?? 0;
    const baseBlocked = baseBlockedByLen.get(len) ?? 0;
    const availableAfterBase = Math.max(0, total - baseBlocked);
    if (availableAfterBase <= need) continue;
    const slack = availableAfterBase - need;
    if (slack <= 0) continue;
    const minHeadroom = Math.max(
      HARD_BAN_MIN_HEADROOM_ABS,
      Math.ceil(need * HARD_BAN_MIN_HEADROOM_NEED_SHARE)
    );
    const maxByHeadroom = Math.max(0, availableAfterBase - (need + minHeadroom));
    if (maxByHeadroom <= 0) continue;
    const maxBySlack = Math.max(1, Math.floor(slack * HARD_BAN_SLACK_BUDGET_SHARE));
    const maxByNeed = Math.max(2, Math.ceil(need * HARD_BAN_PER_LEN_NEED_SHARE));
    const lenBudget = Math.min(maxByHeadroom, maxBySlack, maxByNeed, HARD_BAN_PER_LEN_ABS);
    if (lenBudget <= 0) continue;
    let bannedInLen = 0;
    for (const candidate of candidates) {
      if (normalizedBaseBlocked.has(candidate.word)) continue;
      hardCandidates += 1;
      if (hardBlocked.has(candidate.word)) continue;
      const info = context.wordLenInfoByWord.get(candidate.word);
      if (!info || info.len !== len || info.count <= 0) continue;
      if (bannedInLen + info.count > lenBudget) continue;
      hardBlocked.add(candidate.word);
      bannedInLen += info.count;
      hardAppliedEntries += info.count;
      hardBlockedByLen.set(len, (hardBlockedByLen.get(len) ?? 0) + info.count);
      if (bannedInLen >= lenBudget) break;
    }
  }

  if (!hardBlocked.size) {
    return {
      blockedWords: normalizedBaseBlocked,
      hardCandidates,
      hardApplied: 0,
      hardRelaxed: 0,
      disabledBySafety: false,
    };
  }

  let appliedOnNeeded = 0;
  let totalAfterBaseOnNeeded = 0;
  for (const len of neededLens) {
    const need = lenCounts.get(len) ?? 0;
    if (need <= 0) continue;
    const total = context.dictWordCountByLen.get(len) ?? 0;
    const afterBase = Math.max(0, total - (baseBlockedByLen.get(len) ?? 0));
    const hardAppliedLen = hardBlockedByLen.get(len) ?? 0;
    totalAfterBaseOnNeeded += afterBase;
    appliedOnNeeded += hardAppliedLen;
  }
  if (
    hardAppliedEntries > HARD_BAN_MAX_APPLIED_ABS ||
    (totalAfterBaseOnNeeded > 0 && appliedOnNeeded / totalAfterBaseOnNeeded > HARD_BAN_MAX_APPLIED_SHARE)
  ) {
    return {
      blockedWords: normalizedBaseBlocked,
      hardCandidates,
      hardApplied: 0,
      hardRelaxed: 0,
      disabledBySafety: true,
    };
  }

  const blockedWords = new Set<string>(normalizedBaseBlocked);
  for (const word of hardBlocked) blockedWords.add(word);
  return {
    blockedWords,
    hardCandidates,
    hardApplied: hardBlocked.size,
    hardRelaxed: 0,
    disabledBySafety: false,
  };
}

export function buildUsageRebalanceMetrics(): UsageRebalanceMetrics {
  return {
    softBlocked: 0,
    hardCandidates: 0,
    hardApplied: 0,
    hardRelaxed: 0,
    hardDisabledBySafety: 0,
    hardRetrySoftOnly: 0,
  };
}

export function formatUsageRebalanceMetrics(metrics: UsageRebalanceMetrics): string {
  return `rebalance: softBlocked=${metrics.softBlocked} hardCandidates=${metrics.hardCandidates} hardApplied=${metrics.hardApplied} hardRelaxed=${metrics.hardRelaxed} hardDisabledBySafety=${metrics.hardDisabledBySafety} hardRetrySoftOnly=${metrics.hardRetrySoftOnly}`;
}
