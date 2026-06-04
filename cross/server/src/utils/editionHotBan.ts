import { Prisma, createPrismaClient } from "../db/prisma";
import type { PrismaClient } from "../db/prisma";

type Dict = Map<number, string[]>;
type LenCounts = Map<number, number>;
type PrismaLike = PrismaClient | Prisma.TransactionClient;

const LEN_THRESHOLD_MIN_SAMPLE = 50;
const ENTRY_MIN_ABS = 3;
const EXIT_MIN_ABS = 2;
const ENTRY_P50_MULTIPLIER = 2.0;
const EXIT_P50_MULTIPLIER = 1.5;

type UsageStats = {
  sample: number;
  p50: number;
  p85: number;
  p95: number;
};

export type EditionHotBanLenThreshold = UsageStats & {
  len: number;
  entryThreshold: number;
  exitThreshold: number;
  fallbackToGlobal: boolean;
};

export type EditionHotBanThresholds = UsageStats & {
  entryThreshold: number;
  exitThreshold: number;
  thresholdsByLen: Map<number, EditionHotBanLenThreshold>;
};

export type RelaxHotBanResult = {
  blockedWords: Set<string>;
  relaxedWords: Set<string>;
  relaxedByLen: Map<number, number>;
  unresolvedDeficitsByLen: Map<number, number>;
  appliedHotWords: number;
};

export type RecomputeEditionHotBanStateResult = {
  trackedWords: number;
  bannedWords: number;
  becameBanned: number;
  becameUnbanned: number;
  unchanged: number;
};

type EditionWordUsageRow = {
  word: string | null;
  useCount: number | bigint | null;
};

type EditionWordHotStateRow = {
  wordId: bigint;
  word: string | null;
  len: number | bigint | null;
  useCount: number | bigint | null;
  isBanned: boolean | null;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function safeUsageCount(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

function safeInt(value: number | bigint | null | undefined): number {
  if (typeof value === "bigint") {
    const cast = Number(value);
    return Number.isFinite(cast) ? Math.trunc(cast) : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  return 0;
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

function buildUsageStats(words: string[], usageByWord: Map<string, number>): UsageStats {
  const usage = words
    .map((word) => safeUsageCount(usageByWord.get(word)))
    .sort((a, b) => a - b);
  return {
    sample: usage.length,
    p50: percentileCont(usage, 0.5),
    p85: percentileCont(usage, 0.85),
    p95: percentileCont(usage, 0.95),
  };
}

function resolveThresholdPair(stats: UsageStats): { entryThreshold: number; exitThreshold: number } {
  const entryThreshold = Math.max(
    ENTRY_MIN_ABS,
    Math.ceil(stats.p95),
    Math.ceil(stats.p50 * ENTRY_P50_MULTIPLIER)
  );
  let exitThreshold = Math.max(
    EXIT_MIN_ABS,
    Math.ceil(stats.p85),
    Math.ceil(stats.p50 * EXIT_P50_MULTIPLIER)
  );
  if (exitThreshold >= entryThreshold) exitThreshold = Math.max(0, entryThreshold - 1);
  return { entryThreshold, exitThreshold };
}

export function resolveWordHotBanState(
  useCountRaw: number | undefined,
  wasBanned: boolean,
  thresholds: { entryThreshold: number; exitThreshold: number }
): boolean {
  const useCount = safeUsageCount(useCountRaw);
  if (!wasBanned) return useCount >= thresholds.entryThreshold;
  return useCount >= thresholds.exitThreshold;
}

export function resolveEditionHotBanThresholds(
  dict: Dict,
  usageByWord: Map<string, number>
): EditionHotBanThresholds {
  const globalWords = collectUniqueDictionaryWords(dict);
  const globalStats = buildUsageStats(globalWords, usageByWord);
  const globalThresholdPair = resolveThresholdPair(globalStats);

  const thresholdsByLen = new Map<number, EditionHotBanLenThreshold>();
  const byLen = collectUniqueDictionaryWordsByLen(dict);
  for (const [len, wordsOfLen] of byLen) {
    const lenStats = buildUsageStats(wordsOfLen, usageByWord);
    const fallbackToGlobal = lenStats.sample < LEN_THRESHOLD_MIN_SAMPLE;
    const thresholdPair = fallbackToGlobal ? globalThresholdPair : resolveThresholdPair(lenStats);
    thresholdsByLen.set(len, {
      len,
      sample: lenStats.sample,
      p50: lenStats.p50,
      p85: lenStats.p85,
      p95: lenStats.p95,
      entryThreshold: thresholdPair.entryThreshold,
      exitThreshold: thresholdPair.exitThreshold,
      fallbackToGlobal,
    });
  }

  return {
    sample: globalStats.sample,
    p50: globalStats.p50,
    p85: globalStats.p85,
    p95: globalStats.p95,
    entryThreshold: globalThresholdPair.entryThreshold,
    exitThreshold: globalThresholdPair.exitThreshold,
    thresholdsByLen,
  };
}

export function incrementLenCounter(target: Map<number, number>, len: number, delta: number): void {
  if (!Number.isFinite(len) || !Number.isFinite(delta) || delta <= 0) return;
  const safeLen = Math.trunc(len);
  const safeDelta = Math.trunc(delta);
  if (safeLen <= 0 || safeDelta <= 0) return;
  target.set(safeLen, (target.get(safeLen) ?? 0) + safeDelta);
}

export function mergeLenCounter(target: Map<number, number>, source: Map<number, number>): void {
  for (const [len, value] of source) {
    incrementLenCounter(target, len, value);
  }
}

export function formatLenCounter(values: Map<number, number>): string {
  if (!values.size) return "none";
  return [...values.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([len, value]) => `${len}:${value}`)
    .join(",");
}

function normalizeWordSet(input: Set<string>): Set<string> {
  const normalized = new Set<string>();
  for (const word of input) {
    const key = normalizeWordKey(word);
    if (key) normalized.add(key);
  }
  return normalized;
}

export function relaxHotBanForLenDeficits(
  lenCounts: LenCounts,
  dict: Dict,
  baseBlockedWords: Set<string>,
  hotBannedWords: Set<string>,
  usageByWord: Map<string, number>
): RelaxHotBanResult {
  const normalizedBaseBlocked = normalizeWordSet(baseBlockedWords);
  const normalizedHotBanned = normalizeWordSet(hotBannedWords);
  const activeHotBlocked = new Set<string>();
  for (const word of normalizedHotBanned) {
    if (!normalizedBaseBlocked.has(word)) activeHotBlocked.add(word);
  }

  const blockedWords = new Set<string>(normalizedBaseBlocked);
  for (const word of activeHotBlocked) blockedWords.add(word);

  const relaxedWords = new Set<string>();
  const relaxedByLen = new Map<number, number>();
  const unresolvedDeficitsByLen = new Map<number, number>();

  for (const [len, needRaw] of lenCounts) {
    const need = safeInt(needRaw);
    if (need <= 0) continue;
    const bucket = dict.get(len) ?? [];
    if (!bucket.length) {
      unresolvedDeficitsByLen.set(len, need);
      continue;
    }

    const occurrencesByWord = new Map<string, number>();
    let available = 0;
    for (const wordRaw of bucket) {
      const word = normalizeWordKey(wordRaw);
      if (!word) continue;
      occurrencesByWord.set(word, (occurrencesByWord.get(word) ?? 0) + 1);
      if (!blockedWords.has(word)) available += 1;
    }
    if (available >= need) continue;

    const candidates = [...occurrencesByWord.entries()]
      .filter(([word]) => activeHotBlocked.has(word))
      .map(([word, releasedEntries]) => ({
        word,
        releasedEntries,
        useCount: safeUsageCount(usageByWord.get(word)),
      }))
      .sort((a, b) => {
        if (a.useCount !== b.useCount) return a.useCount - b.useCount;
        return a.word.localeCompare(b.word, "ru");
      });

    for (const candidate of candidates) {
      if (available >= need) break;
      if (!blockedWords.has(candidate.word)) continue;
      blockedWords.delete(candidate.word);
      activeHotBlocked.delete(candidate.word);
      relaxedWords.add(candidate.word);
      incrementLenCounter(relaxedByLen, len, candidate.releasedEntries);
      available += candidate.releasedEntries;
    }

    if (available < need) {
      unresolvedDeficitsByLen.set(len, need - available);
    }
  }

  return {
    blockedWords,
    relaxedWords,
    relaxedByLen,
    unresolvedDeficitsByLen,
    appliedHotWords: activeHotBlocked.size,
  };
}

export async function loadEditionWordUsageByWord(
  editionId: number,
  db?: PrismaLike
): Promise<Map<string, number>> {
  const prisma: PrismaLike = db ?? createPrismaClient();
  const ownedClient = db ? null : (prisma as PrismaClient);
  try {
    const rows = await prisma.$queryRaw<EditionWordUsageRow[]>`
      SELECT
        UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
        SUM(ews."useCount")::int AS "useCount"
      FROM edition_word_stat ews
      JOIN word_v w ON w.id = ews."wordId"
      WHERE ews."editionId" = ${editionId}
      GROUP BY 1
    `;
    const usageByWord = new Map<string, number>();
    for (const row of rows) {
      if (!row.word) continue;
      const word = normalizeWordKey(row.word);
      if (!word) continue;
      usageByWord.set(word, safeInt(row.useCount));
    }
    return usageByWord;
  } finally {
    if (ownedClient) await ownedClient.$disconnect();
  }
}

export async function loadEditionHotBannedWords(
  editionId: number,
  db?: PrismaLike
): Promise<Set<string>> {
  const prisma: PrismaLike = db ?? createPrismaClient();
  const ownedClient = db ? null : (prisma as PrismaClient);
  try {
    const rows = await prisma.$queryRaw<Array<{ word: string | null }>>`
      SELECT
        UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word
      FROM edition_word_hot_state ewhs
      JOIN word_v w ON w.id = ewhs."wordId"
      WHERE ewhs."editionId" = ${editionId}
        AND ewhs."isBanned" = true
      GROUP BY 1
    `;
    const bannedWords = new Set<string>();
    for (const row of rows) {
      if (!row.word) continue;
      const word = normalizeWordKey(row.word);
      if (word) bannedWords.add(word);
    }
    return bannedWords;
  } finally {
    if (ownedClient) await ownedClient.$disconnect();
  }
}

export async function recomputeEditionHotBanState(
  editionId: number,
  db?: PrismaLike
): Promise<RecomputeEditionHotBanStateResult> {
  const prisma: PrismaLike = db ?? createPrismaClient();
  const ownedClient = db ? null : (prisma as PrismaClient);
  try {
    const rows = await prisma.$queryRaw<EditionWordHotStateRow[]>`
      SELECT
        ews."wordId" AS "wordId",
        UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
        w.length::int AS len,
        ews."useCount"::int AS "useCount",
        COALESCE(ewhs."isBanned", false) AS "isBanned"
      FROM edition_word_stat ews
      JOIN word_v w ON w.id = ews."wordId"
      LEFT JOIN edition_word_hot_state ewhs
        ON ewhs."editionId" = ews."editionId"
       AND ewhs."wordId" = ews."wordId"
      WHERE ews."editionId" = ${editionId}
    `;

    if (!rows.length) {
      await prisma.$executeRaw`
        DELETE FROM edition_word_hot_state
        WHERE "editionId" = ${editionId}
      `;
      return {
        trackedWords: 0,
        bannedWords: 0,
        becameBanned: 0,
        becameUnbanned: 0,
        unchanged: 0,
      };
    }

    const usageByWord = new Map<string, number>();
    const lenByWord = new Map<string, number>();
    const prevBannedByWord = new Map<string, boolean>();
    const wordIdsByWord = new Map<string, bigint[]>();
    for (const row of rows) {
      if (!row.word) continue;
      const word = normalizeWordKey(row.word);
      if (!word) continue;
      const len = safeInt(row.len);
      const wordLen = len > 0 ? len : word.length;
      if (!lenByWord.has(word)) lenByWord.set(word, wordLen);
      usageByWord.set(word, (usageByWord.get(word) ?? 0) + safeInt(row.useCount));
      if ((row.isBanned ?? false) === true) prevBannedByWord.set(word, true);
      if (!prevBannedByWord.has(word)) prevBannedByWord.set(word, false);
      const list = wordIdsByWord.get(word) ?? [];
      list.push(row.wordId);
      wordIdsByWord.set(word, list);
    }

    const dictByLen = new Map<number, string[]>();
    for (const [word, len] of lenByWord) {
      const list = dictByLen.get(len) ?? [];
      list.push(word);
      dictByLen.set(len, list);
    }
    const thresholds = resolveEditionHotBanThresholds(dictByLen, usageByWord);

    const nextBannedByWord = new Map<string, boolean>();
    let bannedWords = 0;
    let becameBanned = 0;
    let becameUnbanned = 0;
    for (const [word, usage] of usageByWord) {
      const len = lenByWord.get(word) ?? word.length;
      const lenThreshold = thresholds.thresholdsByLen.get(len);
      const effectiveThreshold = lenThreshold
        ? { entryThreshold: lenThreshold.entryThreshold, exitThreshold: lenThreshold.exitThreshold }
        : { entryThreshold: thresholds.entryThreshold, exitThreshold: thresholds.exitThreshold };
      const wasBanned = prevBannedByWord.get(word) ?? false;
      const nextBanned = resolveWordHotBanState(usage, wasBanned, effectiveThreshold);
      nextBannedByWord.set(word, nextBanned);
      if (nextBanned) bannedWords += 1;
      if (!wasBanned && nextBanned) becameBanned += 1;
      if (wasBanned && !nextBanned) becameUnbanned += 1;
    }

    await prisma.$executeRaw`
      DELETE FROM edition_word_hot_state
      WHERE "editionId" = ${editionId}
        AND "wordId" NOT IN (
          SELECT "wordId"
          FROM edition_word_stat
          WHERE "editionId" = ${editionId}
        )
    `;

    const now = new Date();
    const seenWordIds = new Set<bigint>();
    for (const [word, wordIds] of wordIdsByWord) {
      const isBanned = nextBannedByWord.get(word) ?? false;
      for (const wordId of wordIds) {
        if (seenWordIds.has(wordId)) continue;
        seenWordIds.add(wordId);
        await prisma.edition_word_hot_state.upsert({
          where: {
            editionId_wordId: {
              editionId,
              wordId,
            },
          },
          update: {
            isBanned,
            updatedAt: now,
          },
          create: {
            editionId,
            wordId,
            isBanned,
            updatedAt: now,
          },
        });
      }
    }

    const trackedWords = nextBannedByWord.size;
    return {
      trackedWords,
      bannedWords,
      becameBanned,
      becameUnbanned,
      unchanged: Math.max(0, trackedWords - becameBanned - becameUnbanned),
    };
  } finally {
    if (ownedClient) await ownedClient.$disconnect();
  }
}
