type Dict = Map<number, string[]>;
type LenCounts = Map<number, number>;

const HARD_BAN_MIN_HEADROOM_ABS = 1;
const HARD_BAN_MIN_HEADROOM_NEED_SHARE = 0.15;
const LEN_THRESHOLD_MIN_SAMPLE = 50;

const SAFE_HARD_BAN_MAX_APPLIED_ABS = 180;
const SAFE_HARD_BAN_MAX_APPLIED_SHARE = 0.2;
const SAFE_HARD_BAN_PER_LEN_ABS = 18;
const SAFE_HARD_BAN_PER_LEN_NEED_SHARE = 0.35;
const SAFE_HARD_BAN_SLACK_BUDGET_SHARE = 0.6;

const AGGRESSIVE_HARD_BAN_MAX_APPLIED_ABS = 180;
const AGGRESSIVE_HARD_BAN_MAX_APPLIED_SHARE = 0.45;
const AGGRESSIVE_HARD_BAN_PER_LEN_ABS = 48;
const AGGRESSIVE_HARD_BAN_PER_LEN_NEED_SHARE = 0.85;
const AGGRESSIVE_HARD_BAN_SLACK_BUDGET_SHARE = 0.95;

const AGGRESSIVE_LEN_PRESSURE_MID_RATIO = 4;
const AGGRESSIVE_LEN_PRESSURE_HIGH_RATIO = 6;
const AGGRESSIVE_LEN_PRESSURE_MID_MULTIPLIER = 1.6;
const AGGRESSIVE_LEN_PRESSURE_HIGH_MULTIPLIER = 2.1;
const AGGRESSIVE_MEAN_SOFT_COEFFICIENT = 0.35;
const AGGRESSIVE_MEAN_HARD_COEFFICIENT = 0.6;
const SAFE_BELOW_MEAN_PRIORITY_COEFFICIENT = 0.65;
const SAFE_ABOVE_MEAN_PRIORITY_COEFFICIENT = 0.3;
const AGGRESSIVE_BELOW_MEAN_PRIORITY_COEFFICIENT = 2.6;
const AGGRESSIVE_ABOVE_MEAN_PRIORITY_COEFFICIENT = 1.35;
const SAFE_PRIORITY_GAP_POWER = 1.15;
const AGGRESSIVE_PRIORITY_GAP_POWER = 1.85;
const SAFE_MIN_BELOW_MEAN_BONUS = 1;
const SAFE_MIN_ABOVE_MEAN_PENALTY = 0;
const AGGRESSIVE_MIN_BELOW_MEAN_BONUS = 4;
const AGGRESSIVE_MIN_ABOVE_MEAN_PENALTY = 2;
const AGGRESSIVE_STRONG_UNDER_MEAN_RATIO = 0.65;
const AGGRESSIVE_STRONG_UNDER_MEAN_MULTIPLIER = 1.8;
const AGGRESSIVE_STRONG_OVER_MEAN_RATIO = 1.5;
const AGGRESSIVE_STRONG_OVER_MEAN_MULTIPLIER = 1.5;
const AGGRESSIVE_MEAN_PRESSURE_MID_RATIO = 1.6;
const AGGRESSIVE_MEAN_PRESSURE_HIGH_RATIO = 2.2;
const AGGRESSIVE_MEAN_PRESSURE_MID_MULTIPLIER = 1.25;
const AGGRESSIVE_MEAN_PRESSURE_HIGH_MULTIPLIER = 1.45;

export type UsageRebalanceMode = "safe" | "aggressive";

type HardBanProfile = {
  maxAppliedAbs: number;
  maxAppliedShare: number;
  perLenAbs: number;
  perLenNeedShare: number;
  slackBudgetShare: number;
};

const SAFE_HARD_BAN_PROFILE: HardBanProfile = {
  maxAppliedAbs: SAFE_HARD_BAN_MAX_APPLIED_ABS,
  maxAppliedShare: SAFE_HARD_BAN_MAX_APPLIED_SHARE,
  perLenAbs: SAFE_HARD_BAN_PER_LEN_ABS,
  perLenNeedShare: SAFE_HARD_BAN_PER_LEN_NEED_SHARE,
  slackBudgetShare: SAFE_HARD_BAN_SLACK_BUDGET_SHARE,
};

const AGGRESSIVE_HARD_BAN_PROFILE: HardBanProfile = {
  maxAppliedAbs: AGGRESSIVE_HARD_BAN_MAX_APPLIED_ABS,
  maxAppliedShare: AGGRESSIVE_HARD_BAN_MAX_APPLIED_SHARE,
  perLenAbs: AGGRESSIVE_HARD_BAN_PER_LEN_ABS,
  perLenNeedShare: AGGRESSIVE_HARD_BAN_PER_LEN_NEED_SHARE,
  slackBudgetShare: AGGRESSIVE_HARD_BAN_SLACK_BUDGET_SHARE,
};

type UsageStats = {
  sample: number;
  meanUsage: number;
  p50: number;
  p85: number;
  p95: number;
  p99: number;
  maxUsage: number;
  maxToP50Ratio: number;
  meanToP50Ratio: number;
};

export type UsageRebalanceLenThreshold = UsageStats & {
  len: number;
  softThreshold: number;
  hardThreshold: number;
  fallbackToGlobal: boolean;
};

export type UsageRebalanceThresholds = UsageStats & {
  mode: UsageRebalanceMode;
  softThreshold: number;
  hardThreshold: number;
  thresholdsByLen: Map<number, UsageRebalanceLenThreshold>;
};

export type UsageBalanceByLen = {
  len: number;
  uniq: number;
  meanUsage: number;
  p50: number;
  p95: number;
  max: number;
  maxToP50Ratio: number;
  meanToP50Ratio: number;
  softThreshold: number;
  hardThreshold: number;
  fallbackToGlobal: boolean;
};

export type UsageRebalanceMetrics = {
  softBlocked: number;
  hardCandidates: number;
  hardApplied: number;
  hardRelaxed: number;
  hardDisabledBySafety: number;
  hardRetrySoftOnly: number;
  softBlockedByLen: Map<number, number>;
  hardAppliedByLen: Map<number, number>;
};

export type HardHotBanResult = {
  blockedWords: Set<string>;
  hardCandidates: number;
  hardApplied: number;
  hardRelaxed: number;
  disabledBySafety: boolean;
  hardAppliedByLen: Map<number, number>;
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
  mode: UsageRebalanceMode;
  softHotWords: Set<string>;
  hardCandidatesByLen: Map<number, HardCandidate[]>;
  wordLenInfoByWord: Map<string, WordLenInfo>;
  dictWordCountByLen: Map<number, number>;
  thresholdByLen: Map<number, { softThreshold: number; hardThreshold: number }>;
  balanceByLen: Map<number, UsageBalanceByLen>;
};

export type RebalanceBlockedVariantKind = "hardAggressive" | "softOnly" | "base";

export type RebalanceBlockedVariant = {
  kind: RebalanceBlockedVariantKind;
  blockedWords: Set<string>;
};

type MeanPriorityCoefficients = {
  belowMean: number;
  aboveMean: number;
  gapPower: number;
  minBelowBonus: number;
  minAbovePenalty: number;
  strongBelowRatio: number;
  strongBelowMultiplier: number;
  strongAboveRatio: number;
  strongAboveMultiplier: number;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
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

function collectUniqueDictionaryWordsByLen(dict: Dict): Map<number, string[]> {
  const byLen = new Map<number, string[]>();
  for (const [len, bucket] of dict) {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const word of bucket) {
      const key = normalizeWordKey(word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(key);
    }
    byLen.set(len, list);
  }
  return byLen;
}

function buildUsageStats(words: string[], baseUsageByWord: Map<string, number>): UsageStats {
  const usage = words
    .map((word) => safeUsageCount(baseUsageByWord.get(word)))
    .sort((a, b) => a - b);
  const totalUsage = usage.reduce((sum, value) => sum + value, 0);
  const meanUsage = usage.length ? totalUsage / usage.length : 0;
  const p50 = percentileCont(usage, 0.5);
  const p85 = percentileCont(usage, 0.85);
  const p95 = percentileCont(usage, 0.95);
  const p99 = percentileCont(usage, 0.99);
  const maxUsage = usage.length ? usage[usage.length - 1] : 0;
  const denom = Math.max(1, p50);
  const maxToP50Ratio = maxUsage / denom;
  const meanToP50Ratio = meanUsage / denom;
  return {
    sample: usage.length,
    meanUsage,
    p50,
    p85,
    p95,
    p99,
    maxUsage,
    maxToP50Ratio,
    meanToP50Ratio,
  };
}

function resolveThresholdPair(stats: UsageStats, mode: UsageRebalanceMode): {
  softThreshold: number;
  hardThreshold: number;
} {
  if (mode === "aggressive") {
    const meanLift = Math.max(0, stats.meanUsage - stats.p50);
    const softByMean = Math.ceil(stats.p50 + meanLift * AGGRESSIVE_MEAN_SOFT_COEFFICIENT);
    const hardByMean = Math.ceil(stats.p85 + meanLift * AGGRESSIVE_MEAN_HARD_COEFFICIENT);
    let softThreshold = Math.max(3, Math.ceil(stats.p85), Math.ceil(stats.p50 + 1), softByMean);
    let hardThreshold = Math.max(softThreshold + 1, Math.ceil(stats.p95), hardByMean);

    if (stats.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_HIGH_RATIO) {
      const skewSoft = Math.max(2, Math.ceil(stats.p50 + 1), Math.ceil(stats.meanUsage));
      const skewHard = Math.max(
        skewSoft + 1,
        Math.ceil(stats.p85),
        Math.ceil(stats.meanUsage + 1)
      );
      softThreshold = Math.min(softThreshold, skewSoft);
      hardThreshold = Math.min(hardThreshold, skewHard);
    } else if (stats.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_MID_RATIO) {
      const skewSoft = Math.max(2, Math.ceil(stats.p50 + 1), Math.ceil(stats.meanUsage));
      const skewHard = Math.max(
        skewSoft + 1,
        Math.ceil(stats.p95 - 1),
        Math.ceil(stats.meanUsage + 1)
      );
      softThreshold = Math.min(softThreshold, skewSoft);
      hardThreshold = Math.min(hardThreshold, skewHard);
    }

    hardThreshold = Math.max(hardThreshold, softThreshold + 1);
    return { softThreshold, hardThreshold };
  }

  const softThreshold = Math.max(4, Math.ceil(stats.p95), Math.ceil(stats.p50 + 2));
  const hardThreshold = Math.max(5, softThreshold + 1, Math.ceil(stats.p99));
  return { softThreshold, hardThreshold };
}

function getHardBanProfile(mode: UsageRebalanceMode): HardBanProfile {
  return mode === "aggressive" ? AGGRESSIVE_HARD_BAN_PROFILE : SAFE_HARD_BAN_PROFILE;
}

function getLenPressureMultiplier(len: number, context: UsageRebalanceContext): number {
  if (context.mode !== "aggressive") return 1;
  const balance = context.balanceByLen.get(len);
  if (!balance) return 1;
  let multiplier = 1;
  if (balance.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_HIGH_RATIO) {
    multiplier *= AGGRESSIVE_LEN_PRESSURE_HIGH_MULTIPLIER;
  } else if (balance.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_MID_RATIO) {
    multiplier *= AGGRESSIVE_LEN_PRESSURE_MID_MULTIPLIER;
  }
  if (balance.meanToP50Ratio >= AGGRESSIVE_MEAN_PRESSURE_HIGH_RATIO) {
    multiplier *= AGGRESSIVE_MEAN_PRESSURE_HIGH_MULTIPLIER;
  } else if (balance.meanToP50Ratio >= AGGRESSIVE_MEAN_PRESSURE_MID_RATIO) {
    multiplier *= AGGRESSIVE_MEAN_PRESSURE_MID_MULTIPLIER;
  }
  return multiplier;
}

function resolveMeanPriorityCoefficients(
  stats: UsageStats,
  mode: UsageRebalanceMode
): MeanPriorityCoefficients {
  const base =
    mode === "aggressive"
      ? {
          belowMean: AGGRESSIVE_BELOW_MEAN_PRIORITY_COEFFICIENT,
          aboveMean: AGGRESSIVE_ABOVE_MEAN_PRIORITY_COEFFICIENT,
          gapPower: AGGRESSIVE_PRIORITY_GAP_POWER,
          minBelowBonus: AGGRESSIVE_MIN_BELOW_MEAN_BONUS,
          minAbovePenalty: AGGRESSIVE_MIN_ABOVE_MEAN_PENALTY,
          strongBelowRatio: AGGRESSIVE_STRONG_UNDER_MEAN_RATIO,
          strongBelowMultiplier: AGGRESSIVE_STRONG_UNDER_MEAN_MULTIPLIER,
          strongAboveRatio: AGGRESSIVE_STRONG_OVER_MEAN_RATIO,
          strongAboveMultiplier: AGGRESSIVE_STRONG_OVER_MEAN_MULTIPLIER,
        }
      : {
          belowMean: SAFE_BELOW_MEAN_PRIORITY_COEFFICIENT,
          aboveMean: SAFE_ABOVE_MEAN_PRIORITY_COEFFICIENT,
          gapPower: SAFE_PRIORITY_GAP_POWER,
          minBelowBonus: SAFE_MIN_BELOW_MEAN_BONUS,
          minAbovePenalty: SAFE_MIN_ABOVE_MEAN_PENALTY,
          strongBelowRatio: 0,
          strongBelowMultiplier: 1,
          strongAboveRatio: Number.POSITIVE_INFINITY,
          strongAboveMultiplier: 1,
        };

  if (mode !== "aggressive") return base;

  let multiplier = 1;
  if (stats.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_HIGH_RATIO) {
    multiplier *= AGGRESSIVE_LEN_PRESSURE_HIGH_MULTIPLIER;
  } else if (stats.maxToP50Ratio >= AGGRESSIVE_LEN_PRESSURE_MID_RATIO) {
    multiplier *= AGGRESSIVE_LEN_PRESSURE_MID_MULTIPLIER;
  }
  if (stats.meanToP50Ratio >= AGGRESSIVE_MEAN_PRESSURE_HIGH_RATIO) {
    multiplier *= AGGRESSIVE_MEAN_PRESSURE_HIGH_MULTIPLIER;
  } else if (stats.meanToP50Ratio >= AGGRESSIVE_MEAN_PRESSURE_MID_RATIO) {
    multiplier *= AGGRESSIVE_MEAN_PRESSURE_MID_MULTIPLIER;
  }

  const scaledMinBelow = Math.max(
    base.minBelowBonus,
    Math.ceil(base.minBelowBonus * Math.min(2.5, multiplier))
  );
  const scaledMinAbove = Math.max(
    base.minAbovePenalty,
    Math.ceil(base.minAbovePenalty * Math.min(2.2, multiplier))
  );

  return {
    belowMean: base.belowMean * multiplier,
    aboveMean: base.aboveMean * Math.min(2.5, multiplier * 1.35),
    gapPower: base.gapPower + Math.min(0.7, (multiplier - 1) * 0.55),
    minBelowBonus: scaledMinBelow,
    minAbovePenalty: scaledMinAbove,
    strongBelowRatio: base.strongBelowRatio,
    strongBelowMultiplier:
      base.strongBelowMultiplier * Math.min(1.8, 1 + (multiplier - 1) * 0.6),
    strongAboveRatio: base.strongAboveRatio,
    strongAboveMultiplier:
      base.strongAboveMultiplier * Math.min(1.8, 1 + (multiplier - 1) * 0.45),
  };
}

function applyMeanPriorityAdjustment(
  usage: number,
  meanUsage: number,
  coeffs: MeanPriorityCoefficients
): number {
  if (!Number.isFinite(meanUsage) || meanUsage <= 0) return usage;
  const safeMean = Math.max(1, meanUsage);
  const usageCoeff = usage / safeMean;
  const delta = meanUsage - usage;
  if (delta > 0) {
    const normalizedGap = delta / safeMean;
    let bonus = delta * coeffs.belowMean * (1 + normalizedGap) ** coeffs.gapPower;
    if (usageCoeff <= coeffs.strongBelowRatio) {
      bonus *= coeffs.strongBelowMultiplier;
    }
    return usage - Math.max(coeffs.minBelowBonus, Math.ceil(bonus));
  }
  if (delta < 0) {
    const deltaAbs = Math.abs(delta);
    const normalizedGap = deltaAbs / safeMean;
    let penalty = deltaAbs * coeffs.aboveMean * (1 + normalizedGap) ** coeffs.gapPower;
    if (usageCoeff >= coeffs.strongAboveRatio) {
      penalty *= coeffs.strongAboveMultiplier;
    }
    return usage + Math.max(coeffs.minAbovePenalty, Math.ceil(penalty));
  }
  return usage;
}

export function buildLenMeanUsagePriority(
  dict: Dict,
  baseUsageByWord: Map<string, number>,
  mode: UsageRebalanceMode = "safe"
): Map<string, number> {
  if (!baseUsageByWord.size) return new Map();

  const words = collectUniqueDictionaryWords(dict);
  const globalStats = buildUsageStats(words, baseUsageByWord);
  const globalCoeffs = resolveMeanPriorityCoefficients(globalStats, mode);
  const byLen = collectUniqueDictionaryWordsByLen(dict);
  const priorityByWord = new Map<string, number>();

  for (const [len, bucket] of dict) {
    const lenWords = byLen.get(len) ?? [];
    const lenStats = buildUsageStats(lenWords, baseUsageByWord);
    const effectiveStats = lenStats.sample < LEN_THRESHOLD_MIN_SAMPLE ? globalStats : lenStats;
    const coeffs =
      lenStats.sample < LEN_THRESHOLD_MIN_SAMPLE
        ? globalCoeffs
        : resolveMeanPriorityCoefficients(effectiveStats, mode);
    for (const wordRaw of bucket) {
      const word = normalizeWordKey(wordRaw);
      if (!word) continue;
      const usage = safeUsageCount(baseUsageByWord.get(word));
      const adjusted = applyMeanPriorityAdjustment(usage, effectiveStats.meanUsage, coeffs);
      priorityByWord.set(word, adjusted);
    }
  }
  return priorityByWord;
}

function formatNumber(value: number, precision = 2): string {
  return Number.isFinite(value) ? value.toFixed(precision) : "0.00";
}

export function buildRebalanceBlockedVariantCascade(
  baseBlockedWords: Set<string>,
  softOnlyBlockedWords: Set<string>,
  hardAggressiveBlockedWords: Set<string>
): RebalanceBlockedVariant[] {
  const variants: RebalanceBlockedVariant[] = [
    { kind: "hardAggressive", blockedWords: hardAggressiveBlockedWords },
  ];
  if (!areSetsEqual(softOnlyBlockedWords, hardAggressiveBlockedWords)) {
    variants.push({ kind: "softOnly", blockedWords: softOnlyBlockedWords });
  }
  if (!variants.some((variant) => areSetsEqual(variant.blockedWords, baseBlockedWords))) {
    variants.push({ kind: "base", blockedWords: baseBlockedWords });
  }
  return variants;
}

export function resolveUsageRebalanceThresholds(
  dict: Dict,
  baseUsageByWord: Map<string, number>,
  mode: UsageRebalanceMode = "safe"
): UsageRebalanceThresholds {
  const words = collectUniqueDictionaryWords(dict);
  const globalStats = buildUsageStats(words, baseUsageByWord);
  const globalThresholdPair = resolveThresholdPair(globalStats, mode);

  const thresholdsByLen = new Map<number, UsageRebalanceLenThreshold>();
  const byLen = collectUniqueDictionaryWordsByLen(dict);
  for (const [len, wordsOfLen] of byLen) {
    const lenStats = buildUsageStats(wordsOfLen, baseUsageByWord);
    const fallbackToGlobal = lenStats.sample < LEN_THRESHOLD_MIN_SAMPLE;
    const thresholdPair = fallbackToGlobal
      ? globalThresholdPair
      : resolveThresholdPair(lenStats, mode);
    thresholdsByLen.set(len, {
      len,
      sample: lenStats.sample,
      meanUsage: lenStats.meanUsage,
      p50: lenStats.p50,
      p85: lenStats.p85,
      p95: lenStats.p95,
      p99: lenStats.p99,
      maxUsage: lenStats.maxUsage,
      maxToP50Ratio: lenStats.maxToP50Ratio,
      meanToP50Ratio: lenStats.meanToP50Ratio,
      softThreshold: thresholdPair.softThreshold,
      hardThreshold: thresholdPair.hardThreshold,
      fallbackToGlobal,
    });
  }

  return {
    mode,
    sample: globalStats.sample,
    meanUsage: globalStats.meanUsage,
    p50: globalStats.p50,
    p85: globalStats.p85,
    p95: globalStats.p95,
    p99: globalStats.p99,
    maxUsage: globalStats.maxUsage,
    maxToP50Ratio: globalStats.maxToP50Ratio,
    meanToP50Ratio: globalStats.meanToP50Ratio,
    softThreshold: globalThresholdPair.softThreshold,
    hardThreshold: globalThresholdPair.hardThreshold,
    thresholdsByLen,
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
  const thresholdByLen = new Map<number, { softThreshold: number; hardThreshold: number }>();
  const balanceByLen = new Map<number, UsageBalanceByLen>();

  for (const [len, bucket] of dict) {
    const lenThreshold = thresholds.thresholdsByLen.get(len);
    const softThreshold = lenThreshold?.softThreshold ?? thresholds.softThreshold;
    const hardThreshold = lenThreshold?.hardThreshold ?? thresholds.hardThreshold;
    thresholdByLen.set(len, { softThreshold, hardThreshold });

    balanceByLen.set(len, {
      len,
      uniq: lenThreshold?.sample ?? 0,
      meanUsage: lenThreshold?.meanUsage ?? 0,
      p50: lenThreshold?.p50 ?? 0,
      p95: lenThreshold?.p95 ?? 0,
      max: lenThreshold?.maxUsage ?? 0,
      maxToP50Ratio: lenThreshold?.maxToP50Ratio ?? 0,
      meanToP50Ratio: lenThreshold?.meanToP50Ratio ?? 0,
      softThreshold,
      hardThreshold,
      fallbackToGlobal: lenThreshold?.fallbackToGlobal ?? true,
    });

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
      if (useCount >= softThreshold) softHotWords.add(word);
      if (useCount >= hardThreshold && !hardSeen.has(word)) {
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
    mode: thresholds.mode,
    softHotWords,
    hardCandidatesByLen,
    wordLenInfoByWord,
    dictWordCountByLen,
    thresholdByLen,
    balanceByLen,
  };
}

export function incrementUsageRebalanceMetricByLen(
  target: Map<number, number>,
  len: number,
  delta: number
) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const safeLen = Number.isFinite(len) ? Math.trunc(len) : 0;
  if (safeLen <= 0) return;
  target.set(safeLen, (target.get(safeLen) ?? 0) + Math.trunc(delta));
}

export function mergeUsageRebalanceMetricByLen(
  target: Map<number, number>,
  source: Map<number, number>
) {
  for (const [len, value] of source) {
    incrementUsageRebalanceMetricByLen(target, len, value);
  }
}

export function applyHardHotBanLengthSafe(
  lenCounts: LenCounts,
  baseBlockedWords: Set<string>,
  context: UsageRebalanceContext
): HardHotBanResult {
  const profile = getHardBanProfile(context.mode);
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
      hardAppliedByLen: new Map(),
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

    const maxBySlack = Math.max(1, Math.floor(slack * profile.slackBudgetShare));
    const maxByNeed = Math.max(2, Math.ceil(need * profile.perLenNeedShare));
    const baseLenBudget = Math.min(maxByHeadroom, maxBySlack, maxByNeed, profile.perLenAbs);
    if (baseLenBudget <= 0) continue;

    const lenBudget = Math.min(
      maxByHeadroom,
      Math.max(0, Math.floor(baseLenBudget * getLenPressureMultiplier(len, context)))
    );
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
      hardAppliedByLen: new Map(),
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
    hardAppliedEntries > profile.maxAppliedAbs ||
    (totalAfterBaseOnNeeded > 0 && appliedOnNeeded / totalAfterBaseOnNeeded > profile.maxAppliedShare)
  ) {
    return {
      blockedWords: normalizedBaseBlocked,
      hardCandidates,
      hardApplied: 0,
      hardRelaxed: 0,
      disabledBySafety: true,
      hardAppliedByLen: new Map(),
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
    hardAppliedByLen: hardBlockedByLen,
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
    softBlockedByLen: new Map(),
    hardAppliedByLen: new Map(),
  };
}

function formatLenCounter(map: Map<number, number>): string {
  if (!map.size) return "none";
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([len, value]) => `${len}:${value}`)
    .join(",");
}

export function formatUsageRebalanceLenMetrics(metrics: UsageRebalanceMetrics): string {
  return `rebalance-by-len: softBlocked=${formatLenCounter(metrics.softBlockedByLen)} hardApplied=${formatLenCounter(metrics.hardAppliedByLen)}`;
}

export function formatUsageBalanceByLen(context: UsageRebalanceContext): string[] {
  const rows = [...context.balanceByLen.values()].sort((a, b) => a.len - b.len);
  if (!rows.length) {
    return ["📐 usage-balance-by-len: no-data"];
  }

  const lines = ["📐 usage-balance-by-len"];
  for (const row of rows) {
    lines.push(
      `  len=${row.len} uniq=${row.uniq} mean=${formatNumber(row.meanUsage)} p50=${formatNumber(row.p50)} p95=${formatNumber(row.p95)} max=${row.max} mean/p50=${formatNumber(row.meanToP50Ratio)} max/p50=${formatNumber(row.maxToP50Ratio)} soft=${row.softThreshold} hard=${row.hardThreshold} src=${row.fallbackToGlobal ? "global" : "len"}`
    );
  }

  const worst = rows.reduce((best, current) => {
    if (!best) return current;
    if (current.maxToP50Ratio !== best.maxToP50Ratio) {
      return current.maxToP50Ratio > best.maxToP50Ratio ? current : best;
    }
    if (current.max !== best.max) return current.max > best.max ? current : best;
    return current.len < best.len ? current : best;
  }, rows[0]);

  lines.push(
    `📐 usage-balance-by-len worst=len=${worst.len} max/p50=${formatNumber(worst.maxToP50Ratio)} max=${worst.max} p50=${formatNumber(worst.p50)} uniq=${worst.uniq}`
  );
  return lines;
}

export function formatUsageRebalanceMetrics(metrics: UsageRebalanceMetrics): string {
  return `rebalance: softBlocked=${metrics.softBlocked} hardCandidates=${metrics.hardCandidates} hardApplied=${metrics.hardApplied} hardRelaxed=${metrics.hardRelaxed} hardDisabledBySafety=${metrics.hardDisabledBySafety} hardRetrySoftOnly=${metrics.hardRetrySoftOnly}`;
}
