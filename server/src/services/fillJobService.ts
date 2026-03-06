import archiver from "archiver";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildClueEntries } from "../utils/clues";
import { parseFsh } from "../utils/parseFsh";
import { scanSlotsDetailed, type SlotStart, validate } from "../utils/grid";
import type { SolveFailInfo, SolveProgress } from "../utils/solver";
import {
  resolveStrictLimitedBudget,
  runDlxProbe,
  sortDictionaryByPriority,
} from "../utils/fillFallback";
import {
  applyHardHotBanLengthSafe,
  buildCostHardFirstRebalanceBlockedVariants,
  buildRebalanceBlockedVariantCascade,
  buildUsageRebalanceContext,
  buildSoftHotDuplicateBlock,
  buildUsageRebalanceMetrics,
  formatUsageBalanceByLen,
  formatUsageRebalanceLenMetrics,
  formatUsageRebalanceMetrics,
  incrementUsageRebalanceMetricByLen,
  mergeUsageRebalanceMetricByLen,
  resolveUsageRebalanceThresholds,
  type RebalanceBlockedVariant,
  type UsageRebalanceContext,
  type UsageRebalanceMode,
  type UsageRebalanceThresholds,
} from "../utils/usageRebalance";
import {
  formatLenCounter,
  loadEditionHotBannedWords,
  mergeLenCounter,
  recomputeEditionHotBanState,
  relaxHotBanForLenDeficits,
} from "../utils/editionHotBan";
import { loadEditionUsageSnapshot, type EditionUsageSnapshot } from "../utils/editionUsageSnapshot";
import { polishSolvedRowsByCost } from "../utils/solutionPolish";
import { consumeLastNativeFail, isNativeDlxAvailable, solveDlxNativeAsync } from "../utils/nativeDlx";
import { buildCrw } from "../utils/writeCrw";
import { DIRS, type Cell, type Grid, type Slot } from "../types";
import { loadDefinitions, loadDictionaryByTemplate, type DictionaryFilterTemplate } from "./dictionary";
import { arrowSvg } from "../../scripts/arrow-utils";
import { buildClueTextMap, renderClueText } from "../../scripts/clue-svg";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  WORD_TEXT_FILL,
} from "../../scripts/svg-theme";

const prisma = new PrismaClient();

type FillJobStatus = "queued" | "running" | "review" | "done" | "error";

type FillTemplateStatus = {
  key?: string | null;
  name: string;
  status: "pending" | "running" | "done" | "error";
  error?: string | null;
  order?: number | null;
  sourceName?: string | null;
};

export type FillJobUpdate = {
  id: string;
  issueId: string;
  status: FillJobStatus;
  progress: number;
  currentTemplate?: string | null;
  completedTemplates?: number | null;
  totalTemplates?: number | null;
  error?: string | null;
  templates?: FillTemplateStatus[] | null;
  archiveReady?: boolean;
};

type FillJobOptions = {
  shuffle: boolean;
  unique: boolean;
  lcv: boolean;
  restarts: number;
  parallelRestarts: number;
  maxNodes?: number;
  maxMs?: number;
  style: "default" | "corel";
  explainFail: boolean;
  noDefs: boolean;
  writeCrw: boolean;
  usageStats: boolean;
  usageRebalance: boolean;
  usageRebalanceMode: UsageRebalanceMode;
  editionHotBan: boolean;
  filterTemplateId?: number | null;
};

type ReviewDefinitionOption = {
  opredId: string | null;
  text: string;
};

type ReviewSlotIntersection = {
  slotId: number;
  index: number;
  otherIndex: number;
  row: number;
  col: number;
  letter: string;
};

type ReviewStartPosition = SlotStart;

type ReviewSlot = {
  slotId: number;
  r: number;
  c: number;
  dir: "down" | "right";
  len: number;
  cells: [number, number][];
  word: string;
  wordId: string | null;
  opredId: string | null;
  definition: string;
  definitionOptions: ReviewDefinitionOption[];
  intersections: ReviewSlotIntersection[];
  clueCell: { key: string; row: number; col: number } | null;
  startNumber: number | null;
};

type ReviewClueGroup = {
  key: string;
  row: number;
  col: number;
  slotIds: number[];
};

type ReviewTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  path: string;
  language: string;
  langId: number | null;
  grid: Grid;
  slots: ReviewSlot[];
  clueGroups: ReviewClueGroup[];
  startPositions: ReviewStartPosition[];
};

export type FillReviewPayload = {
  version: 1;
  issue: {
    issueId: string;
    editionId: number;
    editionCode: string;
    issueLabel: string;
  };
  options: {
    style: "default" | "corel";
    writeCrw: boolean;
    usageStats: boolean;
  };
  templates: ReviewTemplate[];
};

type FinalizeSlotInput = {
  slotId: number;
  word?: string | null;
  definition?: string | null;
  wordId?: string | null;
  opredId?: string | null;
};

type FinalizeTemplateInput = {
  key: string;
  slots?: FinalizeSlotInput[] | null;
};

type FinalizePayload = {
  templates?: FinalizeTemplateInput[] | null;
};

export type FillMaskCandidate = {
  wordId: string;
  word: string;
  definitions: ReviewDefinitionOption[];
};

type FinalSlotState = {
  slotId: number;
  len: number;
  word: string;
  definition: string;
  wordId: bigint | null;
  opredId: bigint | null;
};

type IssueContext = {
  issueId: bigint;
  editionId: number;
  editionCode: string;
  issueLabel: string;
  filterTemplateId: number | null;
  snapshotTemplateId: number | null;
};

type SnapshotFile = {
  name: string;
  key?: string;
  size?: number;
};

type ResolvedTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  path?: string;
};

type TemplateEntry = {
  key: string;
  path: string;
  name: string;
  sourceName: string;
  order: number;
  grid: Grid;
  slots: Slot[];
  startNumberBySlotId: Map<number, number>;
  startPositions: ReviewStartPosition[];
  lenCounts: Map<number, number>;
  stats: TemplateStats;
};

type TemplateError = {
  key: string;
  name: string;
  error: string;
};

type JobRuntime = {
  emitter: EventEmitter;
  lastUpdate: FillJobUpdate | null;
};

const jobRuntimes = new Map<string, JobRuntime>();
let fillTableReady = false;

const DEFAULT_OPTIONS: FillJobOptions = {
  shuffle: true,
  unique: true,
  lcv: true,
  restarts: 4,
  parallelRestarts: 2,
  maxNodes: 2_000_000,
  maxMs: undefined,
  style: "corel",
  explainFail: true,
  noDefs: true,
  writeCrw: false,
  usageStats: true,
  usageRebalance: false,
  usageRebalanceMode: "aggressive",
  editionHotBan: false,
  filterTemplateId: null,
};

const ARCHIVE_TTL_MS = 1000 * 60 * 60 * 24 * 30 * 6;

type TemplateStats = {
  slots: number;
  letters: number;
  uniqueCells: number;
  intersections: number;
  density: number;
  maxDegree: number;
  avgDegree: number;
  degreeSqSum: number;
  pressure?: number;
};

type WordDefinitionCandidate = {
  id: bigint;
  word_text: string;
  word_text_norm: string | null;
  opred_v: Array<{
    id: bigint;
    text_opr: string;
  }>;
};

type WordSelection = {
  wordId: bigint;
  opredId: bigint | null;
  definition: string;
  definitions: Array<{
    opredId: bigint | null;
    text: string;
  }>;
};

type UsageCountMap = Map<bigint, number>;

const SHORT_DEFINITION_LIMIT = 30;
const IN_JOB_REPEAT_PRIORITY_MULTIPLIER = 1_000_000_000;
const MAX_WORD_USES = 2;
const AGGRESSIVE_REBALANCE_LCV_PRIORITY_SLACK = 24;
const COST_REBALANCE_PRIORITY_FIRST_LCV_SLACK = 1_000_000;
const COST_REBALANCE_POLISH_PASSES = 2;

function detectCpuParallelism(): number {
  if (typeof os.availableParallelism === "function") {
    const n = os.availableParallelism();
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const n = os.cpus()?.length ?? 1;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function resolveParallelRestarts(restarts: number, configured: number): number {
  const safeRestarts = Number.isFinite(restarts) && restarts > 0 ? Math.floor(restarts) : 1;
  const safeConfigured = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1;
  const cpuParallel = detectCpuParallelism();
  const auto = Math.max(1, Math.min(safeRestarts, cpuParallel));
  const requested = Math.max(1, Math.min(safeRestarts, safeConfigured));
  return Math.max(requested, auto);
}

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function toNumber(value: number | bigint | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

function addCount(target: UsageCountMap, id: bigint, value: number) {
  if (!Number.isFinite(value) || value <= 0) return;
  target.set(id, (target.get(id) ?? 0) + value);
}

function getWordPriority(priorityByWord: Map<string, number>, word: string): number {
  return priorityByWord.get(normalizeWordKey(word)) ?? 0;
}

function sortDictionaryByUsagePriority(dict: Map<number, string[]>, priorityByWord: Map<string, number>) {
  if (!priorityByWord.size) return;
  for (const words of dict.values()) {
    words.sort((a, b) => {
      const scoreDiff = getWordPriority(priorityByWord, a) - getWordPriority(priorityByWord, b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.localeCompare(b, "ru");
    });
  }
}

async function resolveLanguageId(langCode: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ id: number | null }>>`
    SELECT id
    FROM language
    WHERE LOWER(code) = LOWER(${langCode})
    LIMIT 1
  `;
  const id = rows[0]?.id;
  return typeof id === "number" ? id : null;
}

function pickBestOpred(
  opreds: Array<{ id: bigint; text_opr: string }>,
  opredUseCount: Map<bigint, number>,
  usedDefinitions?: Set<string>
): { id: bigint; text: string } | null {
  let best: { id: bigint; text: string; usage: number; bucket: number } | null = null;
  for (const opred of opreds) {
    const text = normalizeDefinitionText(opred.text_opr);
    if (!text) continue;
    const usage = opredUseCount.get(opred.id) ?? 0;
    const bucket = definitionSelectionBucket(text, usedDefinitions);
    if (!Number.isFinite(bucket)) continue;
    const next = {
      id: opred.id,
      text,
      usage,
      bucket,
    };
    if (
      !best ||
      next.bucket < best.bucket ||
      (next.bucket === best.bucket &&
        (usage < best.usage || (usage === best.usage && opred.id < best.id)))
    ) {
      best = next;
    }
  }
  return best ? { id: best.id, text: best.text } : null;
}

function pickBestWordCandidate(
  candidates: WordDefinitionCandidate[],
  wordUseCount: Map<bigint, number>
): WordDefinitionCandidate | null {
  let best: WordDefinitionCandidate | null = null;
  let bestUsage = 0;
  for (const candidate of candidates) {
    const usage = wordUseCount.get(candidate.id) ?? 0;
    if (
      !best ||
      usage < bestUsage ||
      (usage === bestUsage && candidate.id < best.id)
    ) {
      best = candidate;
      bestUsage = usage;
    }
  }
  return best;
}

function buildDefinitionWhereFromTemplate(template: DictionaryFilterTemplate): Prisma.opred_vWhereInput {
  const langCode = (template.language || "ru").toLowerCase();
  const query = template.query?.trim() || "";
  const scopeRaw = (template.scope || "word").toLowerCase();
  const scope = scopeRaw === "def" || scopeRaw === "both" ? scopeRaw : "word";
  const modeRaw = (template.searchMode || "contains").toLowerCase();
  const searchMode: "contains" | "startsWith" | "exact" =
    modeRaw === "startsWith" ? "startsWith" : modeRaw === "exact" ? "exact" : "contains";
  let lenFilterField =
    template.lenFilterField === "def" || template.lenFilterField === "word"
      ? template.lenFilterField
      : null;
  const lenMin = Number.isFinite(template.lenMin as number) ? Math.trunc(template.lenMin as number) : undefined;
  const lenMax = Number.isFinite(template.lenMax as number) ? Math.trunc(template.lenMax as number) : undefined;
  if (!lenFilterField && (lenMin !== undefined || lenMax !== undefined)) {
    lenFilterField = "word";
  }
  const difficultyMin = Number.isFinite(template.difficultyMin as number)
    ? Math.trunc(template.difficultyMin as number)
    : undefined;
  const difficultyMax = Number.isFinite(template.difficultyMax as number)
    ? Math.trunc(template.difficultyMax as number)
    : undefined;
  const tagNames = (template.tagNames ?? []).map((tag) => tag.trim()).filter(Boolean);
  const excludeTagNames = (template.excludeTagNames ?? []).map((tag) => tag.trim()).filter(Boolean);

  const textFilter =
    query.length > 0
      ? searchMode === "contains"
        ? { contains: query, mode: "insensitive" as const }
        : searchMode === "startsWith"
          ? { startsWith: query, mode: "insensitive" as const }
          : { equals: query, mode: "insensitive" as const }
      : null;

  const where: Prisma.opred_vWhereInput = {
    is_deleted: false,
    language: { is: { code: langCode } },
    text_opr: { not: "" },
    OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
  };

  if (tagNames.length) {
    where.opred_tags = {
      some: {
        tags: {
          OR: tagNames.map((name) => ({
            name: { contains: name, mode: "insensitive" as const },
          })),
        },
      },
    };
  }
  if (excludeTagNames.length) {
    where.NOT = {
      opred_tags: {
        some: {
          tags: {
            OR: excludeTagNames.map((name) => ({
              name: { contains: name, mode: "insensitive" as const },
            })),
          },
        },
      },
    };
  }
  if (difficultyMin !== undefined || difficultyMax !== undefined) {
    where.difficulty = {
      ...(difficultyMin !== undefined ? { gte: difficultyMin } : {}),
      ...(difficultyMax !== undefined ? { lte: difficultyMax } : {}),
    };
  }
  if (lenFilterField === "def" && (lenMin !== undefined || lenMax !== undefined)) {
    where.length = {
      ...(lenMin !== undefined ? { gte: lenMin } : {}),
      ...(lenMax !== undefined ? { lte: lenMax } : {}),
    };
  }
  if (textFilter && scope === "def") {
    where.text_opr = textFilter;
  }
  return where;
}

async function selectWordsAndDefinitionsForEdition(
  words: string[],
  params: {
    langId: number;
    editionId: number;
    preferUsageStats: boolean;
    definitionWhere: Prisma.opred_vWhereInput;
    usedDefinitions?: Set<string>;
  }
): Promise<Map<string, WordSelection>> {
  const uniqueWords = [...new Set(words.map(normalizeWordKey).filter(Boolean))];
  if (!uniqueWords.length) return new Map();

  const rows = await prisma.word_v.findMany({
    where: {
      is_deleted: false,
      langId: params.langId,
      OR: [
        { word_text_norm: { in: uniqueWords, mode: "insensitive" as const } },
        { word_text: { in: uniqueWords, mode: "insensitive" as const } },
      ],
    },
    select: {
      id: true,
      word_text: true,
      word_text_norm: true,
      opred_v: {
        where: {
          AND: [{ langId: params.langId }, params.definitionWhere],
        },
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          text_opr: true,
        },
      },
    },
  });
  if (!rows.length) return new Map();

  const wordIds = rows.map((row) => row.id);
  const opredIds = rows.flatMap((row) => row.opred_v.map((opred) => opred.id));

  const [editionWordStats, editionOpredStats] = params.preferUsageStats
    ? await Promise.all([
        wordIds.length
          ? prisma.edition_word_stat.findMany({
              where: {
                editionId: params.editionId,
                wordId: { in: wordIds },
              },
              select: {
                wordId: true,
                useCount: true,
              },
            })
          : Promise.resolve([]),
        opredIds.length
          ? prisma.edition_opred_stat.findMany({
              where: {
                editionId: params.editionId,
                opredId: { in: opredIds },
              },
              select: {
                opredId: true,
                useCount: true,
              },
            })
          : Promise.resolve([]),
      ])
    : [[], []];

  const wordUseCount = new Map<bigint, number>();
  for (const row of editionWordStats) {
    wordUseCount.set(row.wordId, row.useCount);
  }

  const opredUseCount = new Map<bigint, number>();
  for (const row of editionOpredStats) {
    opredUseCount.set(row.opredId, row.useCount);
  }

  const byWord = new Map<string, WordDefinitionCandidate[]>();
  for (const row of rows) {
    const normalized = row.word_text_norm?.trim();
    const word = normalizeWordKey(
      normalized && normalized.length > 0 ? normalized : row.word_text
    );
    if (!word) continue;
    const list = byWord.get(word) ?? [];
    list.push(row);
    byWord.set(word, list);
  }

  const selected = new Map<string, WordSelection>();
  for (const [word, candidates] of byWord) {
    const bestWord = pickBestWordCandidate(candidates, wordUseCount);
    if (!bestWord) continue;
    const bestOpred = pickBestOpred(bestWord.opred_v, opredUseCount, params.usedDefinitions);
    const definitions = bestWord.opred_v
      .map((item) => ({
        opredId: item.id,
        text: item.text_opr.trim(),
      }))
      .filter((item) => item.text.length > 0)
      .map((item) => ({
        opredId: item.opredId,
        text: item.text,
      }));
    selected.set(word, {
      wordId: bestWord.id,
      opredId: bestOpred?.id ?? null,
      definition: bestOpred?.text ?? "",
      definitions,
    });
    if (bestOpred?.text) {
      params.usedDefinitions?.add(normalizeDefinitionKey(bestOpred.text));
    }
  }
  return selected;
}

async function persistUsageStatsForIssue(
  issueId: bigint,
  editionId: number,
  wordUsage: UsageCountMap,
  opredUsage: UsageCountMap
) {
  const normalizeUsageMap = (source: UsageCountMap): Map<bigint, number> => {
    const normalized = new Map<bigint, number>();
    for (const [id, rawCount] of source) {
      const useCount = Number.isFinite(rawCount) ? Math.trunc(rawCount) : 0;
      if (useCount <= 0) continue;
      normalized.set(id, useCount);
    }
    return normalized;
  };

  const buildUsageDeltaMap = (
    previous: Map<bigint, number>,
    next: Map<bigint, number>
  ): Map<bigint, number> => {
    const delta = new Map<bigint, number>();
    const ids = new Set<bigint>([...previous.keys(), ...next.keys()]);
    for (const id of ids) {
      const prevCount = previous.get(id) ?? 0;
      const nextCount = next.get(id) ?? 0;
      const diff = nextCount - prevCount;
      if (diff !== 0) delta.set(id, diff);
    }
    return delta;
  };

  const loadIssueWordUsageMap = async (
    tx: Prisma.TransactionClient,
    targetIssueId: bigint
  ): Promise<Map<bigint, number>> => {
    const rows = await tx.$queryRaw<Array<{ wordId: bigint; useCount: number | bigint | null }>>`
      SELECT "wordId", "useCount"
      FROM issue_word_usage
      WHERE "issueId" = ${targetIssueId}
    `;
    const usage = new Map<bigint, number>();
    for (const row of rows) {
      const useCount = Math.trunc(toNumber(row.useCount));
      if (useCount <= 0) continue;
      usage.set(row.wordId, useCount);
    }
    return usage;
  };

  const loadIssueOpredUsageMap = async (
    tx: Prisma.TransactionClient,
    targetIssueId: bigint
  ): Promise<Map<bigint, number>> => {
    const rows = await tx.$queryRaw<Array<{ opredId: bigint; useCount: number | bigint | null }>>`
      SELECT "opredId", "useCount"
      FROM issue_opred_usage
      WHERE "issueId" = ${targetIssueId}
    `;
    const usage = new Map<bigint, number>();
    for (const row of rows) {
      const useCount = Math.trunc(toNumber(row.useCount));
      if (useCount <= 0) continue;
      usage.set(row.opredId, useCount);
    }
    return usage;
  };

  const applyEditionWordStatDelta = async (
    tx: Prisma.TransactionClient,
    deltaByWordId: Map<bigint, number>
  ): Promise<void> => {
    if (!deltaByWordId.size) return;
    const now = new Date();
    for (const [wordId, delta] of deltaByWordId) {
      if (!Number.isFinite(delta) || delta === 0) continue;
      if (delta > 0) {
        await tx.edition_word_stat.upsert({
          where: { editionId_wordId: { editionId, wordId } },
          update: {
            useCount: { increment: delta },
            lastIssueId: issueId,
            lastUsedAt: now,
          },
          create: {
            editionId,
            wordId,
            useCount: delta,
            lastIssueId: issueId,
            lastUsedAt: now,
          },
        });
        continue;
      }

      const existing = await tx.edition_word_stat.findUnique({
        where: { editionId_wordId: { editionId, wordId } },
        select: { useCount: true },
      });
      if (!existing) continue;
      const nextCount = existing.useCount + delta;
      if (nextCount > 0) {
        await tx.edition_word_stat.update({
          where: { editionId_wordId: { editionId, wordId } },
          data: { useCount: nextCount },
        });
      } else {
        await tx.edition_word_stat.delete({
          where: { editionId_wordId: { editionId, wordId } },
        });
      }
    }
  };

  const applyEditionOpredStatDelta = async (
    tx: Prisma.TransactionClient,
    deltaByOpredId: Map<bigint, number>
  ): Promise<void> => {
    if (!deltaByOpredId.size) return;
    const now = new Date();
    for (const [opredId, delta] of deltaByOpredId) {
      if (!Number.isFinite(delta) || delta === 0) continue;
      if (delta > 0) {
        await tx.edition_opred_stat.upsert({
          where: { editionId_opredId: { editionId, opredId } },
          update: {
            useCount: { increment: delta },
            lastIssueId: issueId,
            lastUsedAt: now,
          },
          create: {
            editionId,
            opredId,
            useCount: delta,
            lastIssueId: issueId,
            lastUsedAt: now,
          },
        });
        continue;
      }

      const existing = await tx.edition_opred_stat.findUnique({
        where: { editionId_opredId: { editionId, opredId } },
        select: { useCount: true },
      });
      if (!existing) continue;
      const nextCount = existing.useCount + delta;
      if (nextCount > 0) {
        await tx.edition_opred_stat.update({
          where: { editionId_opredId: { editionId, opredId } },
          data: { useCount: nextCount },
        });
      } else {
        await tx.edition_opred_stat.delete({
          where: { editionId_opredId: { editionId, opredId } },
        });
      }
    }
  };

  await prisma.$transaction(async (tx) => {
    const [previousWordUsage, previousOpredUsage] = await Promise.all([
      loadIssueWordUsageMap(tx, issueId),
      loadIssueOpredUsageMap(tx, issueId),
    ]);
    const nextWordUsage = normalizeUsageMap(wordUsage);
    const nextOpredUsage = normalizeUsageMap(opredUsage);
    const wordDelta = buildUsageDeltaMap(previousWordUsage, nextWordUsage);
    const opredDelta = buildUsageDeltaMap(previousOpredUsage, nextOpredUsage);

    await tx.$executeRaw`
      DELETE FROM issue_word_usage
      WHERE "issueId" = ${issueId}
    `;
    await tx.$executeRaw`
      DELETE FROM issue_opred_usage
      WHERE "issueId" = ${issueId}
    `;

    for (const [wordId, useCount] of nextWordUsage) {
      if (useCount <= 0) continue;
      await tx.$executeRaw`
        INSERT INTO issue_word_usage ("issueId", "wordId", "useCount", "createdAt")
        VALUES (${issueId}, ${wordId}, ${useCount}, now())
      `;
    }

    for (const [opredId, useCount] of nextOpredUsage) {
      if (useCount <= 0) continue;
      await tx.$executeRaw`
        INSERT INTO issue_opred_usage ("issueId", "opredId", "useCount", "createdAt")
        VALUES (${issueId}, ${opredId}, ${useCount}, now())
      `;
    }
    await applyEditionWordStatDelta(tx, wordDelta);
    await applyEditionOpredStatDelta(tx, opredDelta);
  });
}

function buildLenCounts(slots: Slot[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const slot of slots) {
    counts.set(slot.len, (counts.get(slot.len) ?? 0) + 1);
  }
  return counts;
}

function analyzeTemplate(slots: Slot[]): TemplateStats {
  const cellUse = new Map<string, number>();
  const cellSlots = new Map<string, number[]>();
  const adjacency = new Map<number, Set<number>>();
  for (const slot of slots) {
    adjacency.set(slot.id, new Set());
  }
  let letters = 0;
  for (const slot of slots) {
    letters += slot.len;
    for (const [r, c] of slot.cells) {
      const key = `${r},${c}`;
      cellUse.set(key, (cellUse.get(key) ?? 0) + 1);
      const list = cellSlots.get(key);
      if (list) {
        list.push(slot.id);
      } else {
        cellSlots.set(key, [slot.id]);
      }
    }
  }
  let intersections = 0;
  for (const list of cellSlots.values()) {
    if (list.length > 1) {
      intersections += 1;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          adjacency.get(list[i])?.add(list[j]);
          adjacency.get(list[j])?.add(list[i]);
        }
      }
    }
  }
  const uniqueCells = cellUse.size;
  const density = uniqueCells ? intersections / uniqueCells : 0;
  const degrees = slots.map((slot) => adjacency.get(slot.id)?.size ?? 0);
  const maxDegree = degrees.length ? Math.max(...degrees) : 0;
  const avgDegree = degrees.length
    ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length
    : 0;
  const degreeSqSum = degrees.reduce((sum, d) => sum + d * d, 0);
  return {
    slots: slots.length,
    letters,
    uniqueCells,
    intersections,
    density,
    maxDegree,
    avgDegree,
    degreeSqSum,
  };
}

function computePressure(lenCounts: Map<number, number>, dictCounts: Map<number, number>): number {
  let pressure = 0;
  for (const [len, need] of lenCounts) {
    const have = dictCounts.get(len) ?? 0;
    if (have <= 0) return Number.POSITIVE_INFINITY;
    pressure += need / have;
  }
  return pressure;
}

function compareByComplexity(a: TemplateStats, b: TemplateStats): number {
  if (a.avgDegree !== b.avgDegree) return b.avgDegree - a.avgDegree;
  if (a.degreeSqSum !== b.degreeSqSum) return b.degreeSqSum - a.degreeSqSum;
  const ap = a.pressure ?? 0;
  const bp = b.pressure ?? 0;
  if (ap !== bp) {
    if (!Number.isFinite(ap)) return -1;
    if (!Number.isFinite(bp)) return 1;
    return bp - ap;
  }
  if (b.slots !== a.slots) return b.slots - a.slots;
  if (b.intersections !== a.intersections) return b.intersections - a.intersections;
  if (b.letters !== a.letters) return b.letters - a.letters;
  return 0;
}

function extractTemplateNumber(value: string): number | null {
  const match = value.trim().match(/^(\d{1,6})(?=\D|$)/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function resolveTemplatePageNumber(template: ResolvedTemplate): number {
  const fromName = extractTemplateNumber(template.name);
  if (fromName !== null) return fromName;
  const fromSource = extractTemplateNumber(template.sourceName);
  if (fromSource !== null) return fromSource;
  return template.order + 1;
}

function resolveSpreadIndex(page: number): number {
  return Math.floor((page - 1) / 2);
}

function buildTemplateNeighbors(templates: ResolvedTemplate[]): Map<string, Set<string>> {
  const spreadByKey = new Map<string, number>();
  const keysBySpread = new Map<number, string[]>();

  for (const template of templates) {
    const spread = resolveSpreadIndex(resolveTemplatePageNumber(template));
    spreadByKey.set(template.key, spread);
    const list = keysBySpread.get(spread) ?? [];
    list.push(template.key);
    keysBySpread.set(spread, list);
  }

  const neighbors = new Map<string, Set<string>>();
  for (const template of templates) {
    const spread = spreadByKey.get(template.key);
    if (spread === undefined) continue;
    const set = new Set<string>();
    for (const candidateSpread of [spread - 1, spread, spread + 1]) {
      const keys = keysBySpread.get(candidateSpread);
      if (!keys) continue;
      for (const key of keys) {
        if (key !== template.key) set.add(key);
      }
    }
    neighbors.set(template.key, set);
  }
  return neighbors;
}

function filterDictionaryByBlockedWords(
  dict: Map<number, string[]>,
  blockedWords: Set<string>
): Map<number, string[]> {
  if (!blockedWords.size) return dict;
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  if (!blocked.size) return dict;

  const filtered = new Map<number, string[]>();
  for (const [len, words] of dict) {
    filtered.set(
      len,
      words.filter((word) => !blocked.has(normalizeWordKey(word)))
    );
  }
  return filtered;
}

function buildWordLengthLookup(dict: Map<number, string[]>): Map<string, number> {
  const byWord = new Map<string, number>();
  for (const [len, words] of dict) {
    for (const word of words) {
      const key = normalizeWordKey(word);
      if (!key || byWord.has(key)) continue;
      byWord.set(key, len);
    }
  }
  return byWord;
}

function collectLengthDeficitsForBlockedWords(
  lenCounts: Map<number, number>,
  dict: Map<number, string[]>,
  blockedWords: Set<string>
): Set<number> {
  if (!lenCounts.size) return new Set<number>();
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  const deficits = new Set<number>();
  for (const [len, need] of lenCounts) {
    if (need <= 0) continue;
    const words = dict.get(len) ?? [];
    let available = 0;
    for (const word of words) {
      if (!blocked.has(normalizeWordKey(word))) available += 1;
    }
    if (available < need) deficits.add(len);
  }
  return deficits;
}

function collectMostConstrainedLengthsForBlockedWords(
  lenCounts: Map<number, number>,
  dict: Map<number, string[]>,
  blockedWords: Set<string>,
  limit = 1
): Set<number> {
  if (!lenCounts.size || limit <= 0) return new Set<number>();
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  const ranked: Array<{ len: number; slack: number; available: number; need: number }> = [];
  for (const [len, need] of lenCounts) {
    if (need <= 0) continue;
    const words = dict.get(len) ?? [];
    let available = 0;
    for (const word of words) {
      if (!blocked.has(normalizeWordKey(word))) available += 1;
    }
    if (available <= 0) continue;
    ranked.push({
      len,
      slack: available - need,
      available,
      need,
    });
  }
  ranked.sort((a, b) => {
    if (a.slack !== b.slack) return a.slack - b.slack;
    if (a.available !== b.available) return a.available - b.available;
    if (a.need !== b.need) return b.need - a.need;
    return a.len - b.len;
  });
  return new Set<number>(ranked.slice(0, limit).map((item) => item.len));
}

function buildAdaptiveBlockedWords(
  usedWords: Set<string>,
  usedWordCount: Map<string, number>,
  neighborBlockedWords: Set<string>,
  deficitLengths: Set<number>,
  wordLengthByWord: Map<string, number>,
  maxWordUses: number
): Set<string> {
  const blocked = new Set<string>(neighborBlockedWords);
  for (const [word, count] of usedWordCount) {
    if (count >= maxWordUses) blocked.add(word);
  }
  if (!deficitLengths.size) {
    for (const word of usedWords) blocked.add(word);
    return blocked;
  }
  for (const word of usedWords) {
    const count = usedWordCount.get(word) ?? 0;
    if (count >= maxWordUses) {
      blocked.add(word);
      continue;
    }
    const len = wordLengthByWord.get(word);
    if (typeof len === "number" && deficitLengths.has(len)) continue;
    blocked.add(word);
  }
  return blocked;
}

function buildCappedBlockedWords(
  baseBlockedWords: Set<string>,
  usedWordCount: Map<string, number>,
  maxWordUses: number
): Set<string> {
  const blocked = new Set<string>(baseBlockedWords);
  for (const [word, count] of usedWordCount) {
    if (count >= maxWordUses) blocked.add(word);
  }
  return blocked;
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function buildInJobUsagePriority(
  usedWordCount: Map<string, number>,
  basePriority?: Map<string, number>
): Map<string, number> | undefined {
  if (!usedWordCount.size) return basePriority;
  const merged = basePriority ? new Map(basePriority) : new Map<string, number>();
  for (const [word, count] of usedWordCount) {
    if (count <= 0) continue;
    const current = merged.get(word) ?? 0;
    merged.set(word, current + count * IN_JOB_REPEAT_PRIORITY_MULTIPLIER);
  }
  return merged;
}

function getSamplesDir(): string {
  return (
    process.env.CROSS_SAMPLES_DIR ||
    path.resolve(process.cwd(), "var/crosswords/sample")
  );
}

function getSamplesDirForIssue(issue: IssueContext): string {
  const base = getSamplesDir();
  const editionDir = sanitizeName(issue.editionCode);
  const issueDir = sanitizeName(issue.issueLabel);
  return path.join(base, editionDir, issueDir);
}

function getOutputDir(): string {
  return (
    process.env.CROSS_OUTPUT_DIR ||
    path.resolve(process.cwd(), "var/crosswords/out")
  );
}

function sanitizeName(name: string) {
  const base = path
    .basename(name)
    .replace(/[\r\n\t]/g, " ")
    .trim();
  const normalized = base.normalize("NFC");
  const safe = normalized.replace(/[^\p{L}\p{N}\p{M}\-_. ]+/gu, "_");
  return safe.replace(/_{2,}/g, "_").replace(/ {2,}/g, " ");
}

function normalizeTemplateDisplayName(name: string): string {
  const sanitized = sanitizeName(name);
  const ext = path.extname(sanitized);
  const base = ext ? sanitized.slice(0, -ext.length) : sanitized;
  return base || sanitized;
}

function slotDirName(slot: Slot): "down" | "right" {
  return slot.dir === DIRS.right ? "right" : "down";
}

function resolveDirFromName(name: "down" | "right") {
  return name === "right" ? DIRS.right : DIRS.down;
}

function parseReviewPayload(value: unknown): FillReviewPayload | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseReviewPayload(parsed);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const payload = value as Partial<FillReviewPayload>;
  if (!payload || payload.version !== 1) return null;
  if (!payload.issue || !payload.options || !Array.isArray(payload.templates)) return null;
  return payload as FillReviewPayload;
}

function normalizeDefinitionText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeDefinitionKey(value: string | null | undefined): string {
  const normalized = normalizeDefinitionText(value);
  return normalized.toLocaleLowerCase("ru");
}

function definitionSelectionBucket(text: string, usedDefinitions?: Set<string>): number {
  const key = normalizeDefinitionKey(text);
  const isUnique = !usedDefinitions?.has(key);
  if (!isUnique) return Number.POSITIVE_INFINITY;
  const isShort = normalizeDefinitionText(text).length < SHORT_DEFINITION_LIMIT;
  if (isUnique && isShort) return 0;
  if (isUnique) return 1;
  return Number.POSITIVE_INFINITY;
}

function isLettersOnlyWord(word: string): boolean {
  return /^\p{L}+$/u.test(word);
}

function parseOptionalBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function buildSlotIntersections(
  slots: Slot[],
  wordsBySlot: Map<number, string>
): Map<number, ReviewSlotIntersection[]> {
  const cellUsage = new Map<string, Array<{ slotId: number; index: number; row: number; col: number }>>();
  for (const slot of slots) {
    slot.cells.forEach(([row, col], index) => {
      const key = `${row},${col}`;
      const list = cellUsage.get(key) ?? [];
      list.push({ slotId: slot.id, index, row, col });
      cellUsage.set(key, list);
    });
  }

  const bySlot = new Map<number, ReviewSlotIntersection[]>();
  for (const list of cellUsage.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const left = list[i];
        const right = list[j];
        const leftWord = wordsBySlot.get(left.slotId) ?? "";
        const rightWord = wordsBySlot.get(right.slotId) ?? "";
        const leftLetter = leftWord[left.index] ?? "";
        const rightLetter = rightWord[right.index] ?? "";

        const leftList = bySlot.get(left.slotId) ?? [];
        leftList.push({
          slotId: right.slotId,
          index: left.index,
          otherIndex: right.index,
          row: left.row,
          col: left.col,
          letter: rightLetter || leftLetter,
        });
        bySlot.set(left.slotId, leftList);

        const rightList = bySlot.get(right.slotId) ?? [];
        rightList.push({
          slotId: left.slotId,
          index: right.index,
          otherIndex: left.index,
          row: right.row,
          col: right.col,
          letter: leftLetter || rightLetter,
        });
        bySlot.set(right.slotId, rightList);
      }
    }
  }

  for (const intersections of bySlot.values()) {
    intersections.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.slotId - b.slotId;
    });
  }
  return bySlot;
}

function buildClueMaps(grid: Grid, slots: Slot[], solved: string[]) {
  const slotByArrow = new Map<string, number>();
  for (const slot of slots) {
    slotByArrow.set(`${slot.r},${slot.c}:${slotDirName(slot)}`, slot.id);
  }

  const clues = buildClueEntries(grid, slots, solved, new Map());
  const bySlot = new Map<number, { key: string; row: number; col: number }>();
  const groupByKey = new Map<string, ReviewClueGroup>();

  for (const clue of [...clues.down, ...clues.right]) {
    const slotId = slotByArrow.get(`${clue.arrowR},${clue.arrowC}:${clue.dir}`);
    if (slotId === undefined) continue;
    const key = `${clue.clueR},${clue.clueC}`;
    bySlot.set(slotId, { key, row: clue.clueR, col: clue.clueC });
    const group = groupByKey.get(key) ?? {
      key,
      row: clue.clueR,
      col: clue.clueC,
      slotIds: [],
    };
    if (!group.slotIds.includes(slotId)) group.slotIds.push(slotId);
    groupByKey.set(key, group);
  }

  const clueGroups = [...groupByKey.values()].map((group) => ({
    ...group,
    slotIds: [...group.slotIds].sort((a, b) => a - b),
  }));
  clueGroups.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  return { clueBySlot: bySlot, clueGroups };
}

function pickPreferredDefinitionOption(
  options: ReviewDefinitionOption[],
  usedDefinitionKeys?: Set<string>
): ReviewDefinitionOption | null {
  let best: { option: ReviewDefinitionOption; bucket: number; len: number } | null = null;
  for (const option of options) {
    const text = normalizeDefinitionText(option.text);
    if (!text) continue;
    const bucket = definitionSelectionBucket(text, usedDefinitionKeys);
    if (!Number.isFinite(bucket)) continue;
    const len = text.length;
    if (
      !best ||
      bucket < best.bucket ||
      (bucket === best.bucket &&
        (len < best.len || (len === best.len && text.localeCompare(best.option.text, "ru") < 0)))
    ) {
      best = {
        option: {
          opredId: option.opredId,
          text,
        },
        bucket,
        len,
      };
    }
  }
  return best?.option ?? null;
}

function mergeDefinitionOptionByText(
  current: ReviewDefinitionOption | undefined,
  candidate: ReviewDefinitionOption
): ReviewDefinitionOption {
  if (!current) return candidate;
  const currentHasOpredId = Boolean(current.opredId);
  const candidateHasOpredId = Boolean(candidate.opredId);
  if (candidateHasOpredId && !currentHasOpredId) return candidate;
  if (!candidateHasOpredId && currentHasOpredId) return current;
  if (
    candidate.opredId &&
    current.opredId &&
    candidate.opredId.localeCompare(current.opredId, "ru") < 0
  ) {
    return candidate;
  }
  return current;
}

function convertReviewSlotToSlot(input: ReviewSlot): Slot {
  return {
    id: input.slotId,
    r: input.r,
    c: input.c,
    dir: resolveDirFromName(input.dir),
    len: input.len,
    cells: input.cells,
  };
}

function buildSolvedGridFromSlots(template: ReviewTemplate, states: Map<number, FinalSlotState>): string[] {
  const rows: string[][] = Array.from({ length: template.grid.rows }, (_, row) =>
    Array.from({ length: template.grid.cols }, (_, col) => (template.grid.data[row]?.[col] === "#" ? "#" : "."))
  );

  const slotMap = new Map(template.slots.map((slot) => [slot.slotId, slot]));
  for (const [slotId, state] of states) {
    const slot = slotMap.get(slotId);
    if (!slot) {
      throw new Error(`Unknown slot ${slotId} for template ${template.name}`);
    }
    slot.cells.forEach(([row, col], index) => {
      const letter = state.word[index] ?? "";
      if (!letter) {
        throw new Error(`Word length mismatch for slot ${slotId} (${template.name})`);
      }
      const current = rows[row]?.[col];
      if (!current || current === "#") {
        throw new Error(`Slot ${slotId} points to blocked cell (${row},${col}) in ${template.name}`);
      }
      if (current !== "." && current !== letter) {
        throw new Error(
          `Intersection mismatch in ${template.name} at (${row},${col}): '${current}' vs '${letter}'`
        );
      }
      rows[row][col] = letter;
    });
  }

  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      if (rows[row][col] === ".") {
        throw new Error(`Unfilled cell in ${template.name} at (${row},${col})`);
      }
    }
  }

  return rows.map((row) => row.join(""));
}

function emitJobUpdate(jobId: string, update: FillJobUpdate) {
  const runtime = jobRuntimes.get(jobId);
  if (!runtime) return;
  runtime.lastUpdate = update;
  runtime.emitter.emit("update", update);
  if (update.status === "done" || update.status === "error") {
    if (runtime.emitter.listenerCount("update") === 0) {
      jobRuntimes.delete(jobId);
    }
  }
}

function ensureRuntime(jobId: string) {
  if (jobRuntimes.has(jobId)) return;
  jobRuntimes.set(jobId, { emitter: new EventEmitter(), lastUpdate: null });
}

async function ensureFillJobsTable() {
  if (fillTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS scanword_fill_jobs (
      id BIGSERIAL PRIMARY KEY,
      "issueId" BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      progress INT NOT NULL DEFAULT 0,
      "currentTemplate" TEXT,
      "completedTemplates" INT,
      "totalTemplates" INT,
      error TEXT,
      "outputPath" TEXT,
      "outputSize" BIGINT,
      templates JSONB,
      "reviewData" JSONB,
      options JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_scanword_fill_jobs_issue
      ON scanword_fill_jobs("issueId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scanword_fill_jobs_issue_active
      ON scanword_fill_jobs("issueId")
      WHERE status IN ('queued', 'running');
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE scanword_fill_jobs
      ADD COLUMN IF NOT EXISTS templates JSONB,
      ADD COLUMN IF NOT EXISTS "reviewData" JSONB;
  `);
  fillTableReady = true;
}

async function cleanupOldArchives() {
  const cutoff = new Date(Date.now() - ARCHIVE_TTL_MS);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, "outputPath" FROM scanword_fill_jobs
    WHERE "outputPath" IS NOT NULL AND "updatedAt" < ${cutoff}
  `;
  for (const row of rows) {
    const outPath = row.outputPath as string | null;
    if (outPath && existsSync(outPath)) {
      try {
        unlinkSync(outPath);
      } catch {
        // ignore file delete errors
      }
    }
    await prisma.$executeRaw`
      UPDATE scanword_fill_jobs
      SET "outputPath" = NULL, "outputSize" = NULL, "updatedAt" = now()
      WHERE id = ${row.id}
    `;
  }
}

function parseTemplatesPayload(value: unknown): FillTemplateStatus[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as FillTemplateStatus[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as FillTemplateStatus[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mapJobRow(row: any): FillJobUpdate {
  const templates = parseTemplatesPayload(row.templates);
  return {
    id: String(row.id),
    issueId: String(row.issueId),
    status: row.status as FillJobStatus,
    progress: Number(row.progress ?? 0),
    currentTemplate: row.currentTemplate ?? null,
    completedTemplates: row.completedTemplates ?? null,
    totalTemplates: row.totalTemplates ?? null,
    error: row.error ?? null,
    templates,
    archiveReady: Boolean(row.outputPath),
  };
}

async function loadIssueContext(issueId: bigint): Promise<IssueContext | null> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      i.id,
      i."editionId" as "editionId",
      i."filterTemplateId" as "filterTemplateId",
      e.code as "editionCode",
      n.label as "issueLabel",
      s."templateId" as "snapshotTemplateId"
    FROM issues i
    JOIN editions e ON e.id = i."editionId"
    JOIN issue_numbers n ON n.id = i."issueNumberId"
    LEFT JOIN scanword_upload_snapshots s ON s."issueId" = i.id
    WHERE i.id = ${issueId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    issueId,
    editionId: Number(row.editionId),
    editionCode: row.editionCode,
    issueLabel: row.issueLabel,
    filterTemplateId: row.filterTemplateId ?? null,
    snapshotTemplateId: row.snapshotTemplateId ?? null,
  };
}

async function loadFilterTemplate(templateId: number): Promise<DictionaryFilterTemplate | null> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      id,
      name,
      language,
      query,
      scope,
      "searchMode",
      "lenFilterField",
      "lenMin",
      "lenMax",
      "difficultyMin",
      "difficultyMax",
      "tagNames",
      "excludeTagNames"
    FROM dictionary_filter_templates
    WHERE id = ${templateId} AND is_deleted = false
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    language: row.language,
    query: row.query,
    scope: row.scope,
    searchMode: row.searchMode,
    lenFilterField: row.lenFilterField,
    lenMin: row.lenMin,
    lenMax: row.lenMax,
    difficultyMin: row.difficultyMin,
    difficultyMax: row.difficultyMax,
    tagNames: row.tagNames ?? [],
    excludeTagNames: row.excludeTagNames ?? [],
  };
}

async function loadSnapshotFiles(issueId: bigint): Promise<SnapshotFile[]> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT files FROM scanword_upload_snapshots WHERE "issueId" = ${issueId} LIMIT 1
  `;
  if (!rows.length) return [];
  const files = rows[0]?.files;
  if (!Array.isArray(files)) return [];
  return files
    .map((item) => ({
      name: typeof item?.name === "string" ? item.name : "",
      key: typeof item?.key === "string" ? item.key : undefined,
      size: typeof item?.size === "number" ? item.size : undefined,
    }))
    .filter((item) => item.name.length > 0);
}

function buildSnapshotKey(file: SnapshotFile, order: number, seen: Map<string, number>): string {
  const base =
    (typeof file.key === "string" && file.key.trim().length > 0
      ? file.key.trim()
      : `${file.name}:${file.size ?? ""}`) || `${file.name}:${order}`;
  const next = (seen.get(base) ?? 0) + 1;
  seen.set(base, next);
  return next === 1 ? base : `${base}#${next}`;
}

function resolveTemplatePaths(files: SnapshotFile[], samplesDir: string): ResolvedTemplate[] {
  const baseDir = path.resolve(samplesDir);
  const seen = new Map<string, number>();
  return files.map((file, idx) => {
    const key = buildSnapshotKey(file, idx, seen);
    const sourceName = file.name;
    const name = normalizeTemplateDisplayName(file.name);
    const sanitized = sanitizeName(file.name);
    const basenamed = path.basename(file.name);
    const candidates = [...new Set([sanitized, basenamed])].filter((candidate) => candidate.length > 0);
    const found = candidates
      .map((candidate) => path.resolve(baseDir, candidate))
      .filter((resolvedPath) => {
        const relative = path.relative(baseDir, resolvedPath);
        return !relative.startsWith("..") && !path.isAbsolute(relative);
      })
      .find((p) => existsSync(p));
    return {
      key,
      name,
      sourceName,
      order: idx,
      path: found,
    };
  });
}

function buildEntries(templates: ResolvedTemplate[]): {
  entries: TemplateEntry[];
  lengths: number[];
  invalid: TemplateError[];
} {
  const entries: TemplateEntry[] = [];
  const invalid: TemplateError[] = [];
  const lengthsSet = new Set<number>();
  for (const template of templates) {
    if (!template.path) continue;
    const name = template.name;
    try {
      const grid = parseFsh(template.path);
      validate(grid);
      const slotScan = scanSlotsDetailed(grid);
      const slots = slotScan.slots;
      const lenCounts = buildLenCounts(slots);
      const stats = analyzeTemplate(slots);
      entries.push({
        key: template.key,
        path: template.path,
        name,
        sourceName: template.sourceName,
        order: template.order,
        grid,
        slots,
        startNumberBySlotId: slotScan.startNumberBySlotId,
        startPositions: slotScan.starts,
        lenCounts,
        stats,
      });
      for (const slot of slots) lengthsSet.add(slot.len);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid template";
      invalid.push({ key: template.key, name, error: msg });
    }
  }
  return { entries, lengths: [...lengthsSet], invalid };
}

function buildSvg(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>,
  options: { style: "default" | "corel" }
): { svg: string; svgRaw: string; usedWords: string } {
  const useCorelStyle = options.style === "corel";
  const DEFAULT_CELL = 30;
  const CELL = useCorelStyle ? 118 : DEFAULT_CELL;
  const EMPTY_CELL_FILL = useCorelStyle ? "#FEFEFE" : "#fff";
  const STROKE_WIDTH = useCorelStyle
    ? Math.round(CELL * 0.07 * 1000) / 1000
    : CELL_STROKE_WIDTH;
  const SVG_PAD = STROKE_WIDTH / 2;
  const GRID_PAD = useCorelStyle ? 0 : SVG_PAD;
  const GRID_OFFSET_X = (useCorelStyle ? -CELL / 2 : 0) + GRID_PAD;
  const GRID_OFFSET_Y = (useCorelStyle ? -Math.round(CELL * 0.034) : 0) + GRID_PAD;
  const WORD_FONT_SIZE = useCorelStyle
    ? Math.round(CELL * 0.565 * 1000) / 1000
    : CELL * 0.6;
  const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
  const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
  const WORD_TEXT_Y = useCorelStyle ? CELL * 0.7 : CELL / 2;
  const SVG_WIDTH = useCorelStyle ? 2480 : 0;
  const SVG_HEIGHT = useCorelStyle ? 3508 : 0;
  const SVG_XML_SPACE = useCorelStyle ? ' xml:space="preserve"' : "";
  const SVG_STYLE_ATTR = useCorelStyle
    ? ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"'
    : "";
  const SVG_PREAMBLE = useCorelStyle
    ? '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
    : "";
  const FONT_FAMILY = useCorelStyle ? "Arial" : "monospace";

  const usedWordsList = slots.map((s) => s.cells.map(([r, c]) => solved[r][c]).join(""));
  const usedWords = usedWordsList.join("\n");
  const clues = buildClueEntries(grid, slots, solved, definitions);
  const clueTextMap = buildClueTextMap([...clues.down, ...clues.right]);

  const { rows: ROWS, cols: COLS } = grid;
  const gridWidth = COLS * CELL;
  const gridHeight = ROWS * CELL;
  const svgWidth = useCorelStyle ? SVG_WIDTH : gridWidth + SVG_PAD * 2;
  const svgHeight = useCorelStyle ? SVG_HEIGHT : gridHeight + SVG_PAD * 2;
  const svgViewBox = useCorelStyle
    ? ` viewBox="${GRID_OFFSET_X - SVG_PAD} ${GRID_OFFSET_Y - SVG_PAD} ${Math.max(
        SVG_WIDTH,
        gridWidth + SVG_PAD * 2
      )} ${Math.max(SVG_HEIGHT, gridHeight + SVG_PAD * 2)}"`
    : "";

  const svgParts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidth}" height="${svgHeight}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
  ];
  const svgRawParts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidth}" height="${svgHeight}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
  ];

  const clueDefs: string[] = [];
  const clueFont = Math.max(5, Math.floor(CELL * 0.22));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_OFFSET_X + c * CELL;
      const y = GRID_OFFSET_Y + r * CELL;
      const ch = solved[r][c] as Cell;
      const orig = grid.data[r][c] as Cell;
      const code = grid.codes[r][c];
      const clueKey = `${r},${c}`;
      const clueText = clueTextMap.get(clueKey);

      if (ch === "#") {
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${BLOCK_CELL_FILL}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        if (clueText) {
          const clipId = `clue-${r}-${c}`;
          const clueSvg = renderClueText(x, y, CELL, clueFont, clueText, clipId, CLUE_TEXT_FILL, {
            mode: useCorelStyle ? "corel" : "default",
          });
          if (clueSvg.defs) clueDefs.push(clueSvg.defs);
          svgParts.push(clueSvg.text);
          svgRawParts.push(clueSvg.text);
        }
        const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        svgParts.push(border);
        svgRawParts.push(border);
      } else {
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${EMPTY_CELL_FILL}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        const arrow = arrowSvg("batch", code, orig, x, y, CELL, CELL * 0.6);
        if (arrow) {
          svgParts.push(arrow);
          svgRawParts.push(arrow);
        }
        svgParts.push(
          `<text x="${x + CELL / 2}" y="${y + WORD_TEXT_Y}" font-size="${WORD_FONT_SIZE}" fill="${WORD_TEXT_FILL}"${WORD_FONT_WEIGHT_ATTR}${WORD_BASELINE_ATTR}>${ch}</text>`
        );
        const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        svgParts.push(border);
        svgRawParts.push(border);
      }
    }
  }

  if (clueDefs.length) {
    svgParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
    svgRawParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
  }
  svgParts.push("</svg>");
  svgRawParts.push("</svg>");

  return { svg: svgParts.join(""), svgRaw: svgRawParts.join(""), usedWords };
}

async function zipDirectory(srcDir: string, outPath: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    mkdirSync(path.dirname(outPath), { recursive: true });
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
  const stats = statSync(outPath);
  return stats.size;
}

async function updateJob(jobId: bigint, data: Partial<Omit<FillJobUpdate, "id" | "issueId">> & {
  status?: FillJobStatus;
  progress?: number;
  currentTemplate?: string | null;
  completedTemplates?: number | null;
  totalTemplates?: number | null;
  error?: string | null;
  templates?: FillTemplateStatus[] | null;
  reviewData?: FillReviewPayload | null;
  outputPath?: string | null;
  outputSize?: number | null;
}) {
  const hasStatus = data.status !== undefined;
  const hasProgress = data.progress !== undefined;
  const hasCurrentTemplate = data.currentTemplate !== undefined;
  const hasCompletedTemplates = data.completedTemplates !== undefined;
  const hasTotalTemplates = data.totalTemplates !== undefined;
  const hasError = data.error !== undefined;
  const hasTemplates = data.templates !== undefined;
  const hasReviewData = data.reviewData !== undefined;
  const hasOutputPath = data.outputPath !== undefined;
  const hasOutputSize = data.outputSize !== undefined;
  const statusValue = hasStatus ? (data.status ?? null) : null;
  const progressValue = hasProgress ? (data.progress ?? null) : null;
  const currentTemplateValue = hasCurrentTemplate ? (data.currentTemplate ?? null) : null;
  const completedTemplatesValue = hasCompletedTemplates ? (data.completedTemplates ?? null) : null;
  const totalTemplatesValue = hasTotalTemplates ? (data.totalTemplates ?? null) : null;
  const errorValue = hasError ? (data.error ?? null) : null;
  const outputPathValue = hasOutputPath ? (data.outputPath ?? null) : null;
  const outputSizeValue = hasOutputSize ? (data.outputSize ?? null) : null;
  const templatesJson = hasTemplates && data.templates !== null ? JSON.stringify(data.templates) : null;
  const reviewJson = hasReviewData && data.reviewData !== null ? JSON.stringify(data.reviewData) : null;
  await prisma.$executeRaw`
    UPDATE scanword_fill_jobs
    SET
      status = CASE WHEN ${hasStatus} THEN ${statusValue} ELSE status END,
      progress = CASE WHEN ${hasProgress} THEN ${progressValue} ELSE progress END,
      "currentTemplate" = CASE WHEN ${hasCurrentTemplate} THEN ${currentTemplateValue} ELSE "currentTemplate" END,
      "completedTemplates" = CASE WHEN ${hasCompletedTemplates} THEN ${completedTemplatesValue} ELSE "completedTemplates" END,
      "totalTemplates" = CASE WHEN ${hasTotalTemplates} THEN ${totalTemplatesValue} ELSE "totalTemplates" END,
      error = CASE WHEN ${hasError} THEN ${errorValue} ELSE error END,
      templates = CASE WHEN ${hasTemplates} THEN ${templatesJson}::jsonb ELSE templates END,
      "reviewData" = CASE WHEN ${hasReviewData} THEN ${reviewJson}::jsonb ELSE "reviewData" END,
      "outputPath" = CASE WHEN ${hasOutputPath} THEN ${outputPathValue} ELSE "outputPath" END,
      "outputSize" = CASE WHEN ${hasOutputSize} THEN ${outputSizeValue} ELSE "outputSize" END,
      "updatedAt" = now()
    WHERE id = ${jobId}
  `;
}

function formatFail(info: SolveFailInfo): string {
  if (info.reason === "aborted") return `aborted (${info.detail?.limit ?? "limit"})`;
  if (info.reason === "forward-check") return "forward-check";
  if (info.reason === "zero-pick") return "zero-pick";
  return "no-solution";
}

function extractFailedSlotLength(info: SolveFailInfo | null): number | null {
  const len = info?.detail?.slot?.len;
  if (typeof len !== "number" || !Number.isFinite(len) || len <= 0) return null;
  return Math.trunc(len);
}

function buildReviewTemplate(
  entry: TemplateEntry,
  solved: string[],
  language: string,
  langId: number | null,
  selections: Map<string, WordSelection>,
  fallbackDefinitions: Map<string, string>,
  usedDefinitionKeys?: Set<string>
): ReviewTemplate {
  const wordsBySlot = new Map<number, string>();
  entry.slots.forEach((slot) => {
    const word = slot.cells.map(([row, col]) => solved[row]?.[col] ?? "").join("");
    wordsBySlot.set(slot.id, normalizeWordKey(word));
  });

  const intersectionsBySlot = buildSlotIntersections(entry.slots, wordsBySlot);
  const { clueBySlot, clueGroups } = buildClueMaps(entry.grid, entry.slots, solved);

  const slots: ReviewSlot[] = entry.slots.map((slot) => {
    const word = wordsBySlot.get(slot.id) ?? "";
    const selection = selections.get(word);
    const fallbackDefinition = normalizeDefinitionText(fallbackDefinitions.get(word));
    const selectedDefinition = normalizeDefinitionText(selection?.definition) || fallbackDefinition;
    let selectedOpredId: string | null = null;
    const optionMap = new Map<string, ReviewDefinitionOption>();
    const pushOption = (option: ReviewDefinitionOption) => {
      const text = normalizeDefinitionText(option.text);
      if (!text) return;
      const key = normalizeDefinitionKey(text);
      const merged = mergeDefinitionOptionByText(optionMap.get(key), {
        opredId: option.opredId,
        text,
      });
      optionMap.set(key, merged);
    };
    for (const def of selection?.definitions ?? []) {
      const text = normalizeDefinitionText(def.text);
      if (!text) continue;
      pushOption({
        opredId: def.opredId ? String(def.opredId) : null,
        text,
      });
    }
    if (selectedDefinition.length > 0) {
      pushOption({
        opredId: selection?.opredId ? String(selection.opredId) : null,
        text: selectedDefinition,
      });
    }
    const options = [...optionMap.values()];
    options.sort((a, b) => a.text.localeCompare(b.text, "ru"));

    let definition = "";
    const preferred = pickPreferredDefinitionOption(options, usedDefinitionKeys);
    if (preferred) {
      definition = preferred.text;
      selectedOpredId = preferred.opredId;
    }
    if (definition.length > 0) {
      usedDefinitionKeys?.add(normalizeDefinitionKey(definition));
    }

    return {
      slotId: slot.id,
      r: slot.r,
      c: slot.c,
      dir: slotDirName(slot),
      len: slot.len,
      cells: slot.cells,
      word,
      wordId: selection ? String(selection.wordId) : null,
      opredId: selectedOpredId,
      definition,
      definitionOptions: options,
      intersections: intersectionsBySlot.get(slot.id) ?? [],
      clueCell: clueBySlot.get(slot.id) ?? null,
      startNumber: entry.startNumberBySlotId.get(slot.id) ?? null,
    };
  });

  return {
    key: entry.key,
    name: entry.name,
    sourceName: entry.sourceName,
    order: entry.order,
    path: entry.path,
    language,
    langId,
    grid: entry.grid,
    slots,
    clueGroups,
    startPositions: entry.startPositions.map((item) => ({ ...item })),
  };
}

function normalizeMask(input: string): string {
  return input.trim().toUpperCase();
}

function escapeLikeChar(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

async function findWordsByMask(
  mask: string,
  langId: number,
  limit: number
): Promise<Array<{ wordId: string; word: string; definitions: ReviewDefinitionOption[] }>> {
  const normalized = normalizeMask(mask);
  if (!normalized) return [];
  if (!/^[\p{L}.]+$/u.test(normalized)) {
    throw new Error("Mask must contain letters and dots only");
  }

  const likeMask = escapeLikeChar(normalized).replaceAll(".", "_");
  const parsedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 80;
  const safeLimit = Math.max(1, Math.min(200, parsedLimit));
  const rows = await prisma.$queryRaw<Array<{ id: bigint; word: string | null }>>(Prisma.sql`
    SELECT
      w.id,
      UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word
    FROM word_v w
    WHERE w.is_deleted = false
      AND w."langId" = ${langId}
      AND w.length = ${normalized.length}
      AND UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) LIKE ${likeMask} ESCAPE '\'
    ORDER BY w.id ASC
    LIMIT ${safeLimit}
  `);
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const opreds = await prisma.opred_v.findMany({
    where: {
      word_id: { in: ids },
      langId,
      is_deleted: false,
      text_opr: { not: "" },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      word_id: true,
      text_opr: true,
    },
  });

  const defsByWord = new Map<bigint, ReviewDefinitionOption[]>();
  for (const row of opreds) {
    const text = normalizeDefinitionText(row.text_opr);
    if (!text) continue;
    const list = defsByWord.get(row.word_id) ?? [];
    list.push({ opredId: String(row.id), text });
    defsByWord.set(row.word_id, list);
  }

  return rows
    .map((row) => ({
      wordId: String(row.id),
      word: normalizeWordKey(row.word ?? ""),
      definitions: defsByWord.get(row.id) ?? [],
    }))
    .filter((row) => row.word.length > 0);
}

function buildFinalSlotState(
  slot: ReviewSlot,
  input: FinalizeSlotInput | null | undefined
): { state: FinalSlotState; errors: string[] } {
  const rawWord = normalizeWordKey(input?.word ?? slot.word);
  const definition = normalizeDefinitionText(input?.definition ?? slot.definition);
  const wordId = parseOptionalBigInt(input?.wordId ?? slot.wordId);
  const opredId = parseOptionalBigInt(input?.opredId ?? slot.opredId);
  const errors: string[] = [];

  if (!rawWord) {
    errors.push(`Template ${slot.slotId}: word is empty`);
  } else {
    if (rawWord.length !== slot.len) {
      errors.push(`Slot ${slot.slotId}: word length ${rawWord.length} does not match ${slot.len}`);
    }
    if (!isLettersOnlyWord(rawWord)) {
      errors.push(`Slot ${slot.slotId}: word must contain letters only`);
    }
  }

  if (!definition) {
    errors.push(`Slot ${slot.slotId}: definition is required`);
  }

  return {
    state: {
      slotId: slot.slotId,
      len: slot.len,
      word: rawWord,
      definition,
      wordId,
      opredId,
    },
    errors,
  };
}

function buildDefinitionClueGroups(template: ReviewTemplate): ReviewClueGroup[] {
  const byKey = new Map<string, ReviewClueGroup>();
  for (const slot of template.slots) {
    const clue = slot.clueCell;
    if (!clue) continue;
    const group = byKey.get(clue.key) ?? {
      key: clue.key,
      row: clue.row,
      col: clue.col,
      slotIds: [],
    };
    if (!group.slotIds.includes(slot.slotId)) {
      group.slotIds.push(slot.slotId);
    }
    byKey.set(clue.key, group);
  }
  const groups = [...byKey.values()].map((group) => ({
    ...group,
    slotIds: [...group.slotIds].sort((a, b) => a - b),
  }));
  groups.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return groups;
}

function validateTemplateDefinitions(template: ReviewTemplate, states: Map<number, FinalSlotState>): string[] {
  const errors: string[] = [];
  const clueGroups = buildDefinitionClueGroups(template);
  for (const group of clueGroups) {
    const definitions = group.slotIds
      .map((slotId) => states.get(slotId))
      .filter((item): item is FinalSlotState => Boolean(item))
      .map((item) => ({
        slotId: item.slotId,
        length: item.definition.length,
      }));
    if (!definitions.length) continue;

    if (group.slotIds.length === 2) {
      for (const item of definitions) {
        if (item.length > 15) {
          errors.push(
            `Template ${template.name}: definition for slot ${item.slotId} exceeds 15 symbols for shared clue cell ${group.key}`
          );
        }
      }
      const total = definitions.reduce((sum, item) => sum + item.length, 0);
      if (total > 30) {
        errors.push(`Template ${template.name}: definitions total exceeds 30 symbols for clue cell ${group.key}`);
      }
    } else {
      for (const item of definitions) {
        if (item.length > 30) {
          errors.push(`Template ${template.name}: definition for slot ${item.slotId} exceeds 30 symbols`);
        }
      }
    }
  }
  return errors;
}

function validateDefinitionConsistency(template: ReviewTemplate, states: Map<number, FinalSlotState>): string[] {
  const errors: string[] = [];
  const defByWord = new Map<string, string>();
  for (const state of states.values()) {
    const existing = defByWord.get(state.word);
    if (existing === undefined) {
      defByWord.set(state.word, state.definition);
      continue;
    }
    if (existing !== state.definition) {
      errors.push(`Template ${template.name}: word ${state.word} has conflicting definitions`);
    }
  }
  return errors;
}

function collectTemplateWords(states: Map<number, FinalSlotState>): Map<string, number> {
  const words = new Map<string, number>();
  for (const state of states.values()) {
    const key = normalizeWordKey(state.word);
    if (!key) continue;
    if (!words.has(key)) words.set(key, state.slotId);
  }
  return words;
}

function validateWordUniqueness(template: ReviewTemplate, states: Map<number, FinalSlotState>): string[] {
  const errors: string[] = [];
  const slotByWord = new Map<string, number>();
  for (const state of states.values()) {
    const key = normalizeWordKey(state.word);
    if (!key) continue;
    const existingSlot = slotByWord.get(key);
    if (existingSlot !== undefined && existingSlot !== state.slotId) {
      errors.push(`Template ${template.name}: word ${key} duplicates slot ${existingSlot}`);
      continue;
    }
    slotByWord.set(key, state.slotId);
  }
  return errors;
}

function validateDefinitionUniqueness(template: ReviewTemplate, states: Map<number, FinalSlotState>): string[] {
  const errors: string[] = [];
  const slotByDefinition = new Map<string, number>();
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key) continue;
    const existingSlot = slotByDefinition.get(key);
    if (existingSlot !== undefined && existingSlot !== state.slotId) {
      errors.push(
        `Template ${template.name}: definition for slot ${state.slotId} duplicates slot ${existingSlot}`
      );
      continue;
    }
    slotByDefinition.set(key, state.slotId);
  }
  return errors;
}

function validateDefinitionReuseAcrossTemplates(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>,
  usedDefinitions: Map<string, { templateName: string; slotId: number }>
): string[] {
  const errors: string[] = [];
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key) continue;
    const existing = usedDefinitions.get(key);
    if (!existing) continue;
    errors.push(
      `Template ${template.name}: definition for slot ${state.slotId} duplicates template ${existing.templateName} slot ${existing.slotId}`
    );
  }
  return errors;
}

function registerUsedDefinitions(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>,
  usedDefinitions: Map<string, { templateName: string; slotId: number }>
) {
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key || usedDefinitions.has(key)) continue;
    usedDefinitions.set(key, { templateName: template.name, slotId: state.slotId });
  }
}

function validateNeighborWordReuse(
  template: ReviewTemplate,
  wordsInTemplate: Map<string, number>,
  neighborsByTemplate: Map<string, Set<string>>,
  usedWordsByTemplate: Map<string, Map<string, number>>,
  templateNameByKey: Map<string, string>
): string[] {
  const errors: string[] = [];
  const neighbors = neighborsByTemplate.get(template.key);
  if (!neighbors || !wordsInTemplate.size) return errors;

  for (const neighborKey of neighbors) {
    const neighborWords = usedWordsByTemplate.get(neighborKey);
    if (!neighborWords || !neighborWords.size) continue;
    const neighborName = templateNameByKey.get(neighborKey) ?? neighborKey;
    for (const [word, slotId] of wordsInTemplate) {
      const neighborSlotId = neighborWords.get(word);
      if (neighborSlotId === undefined) continue;
      errors.push(
        `Template ${template.name}: word ${word} in slot ${slotId} duplicates neighboring template ${neighborName} slot ${neighborSlotId}`
      );
    }
  }
  return errors;
}

function collectWordCounts(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    const key = normalizeWordKey(word);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildDuplicateReport(
  templateWordCounts: Map<string, Map<string, number>>,
  templateNameByKey: Map<string, string>
): { duplicateWordCount: number; totalRepeatUses: number; templatesWithDuplicates: number } {
  const usageByWord = new Map<string, Array<{ templateName: string; count: number }>>();
  for (const [templateKey, words] of templateWordCounts) {
    const templateName = templateNameByKey.get(templateKey) ?? templateKey;
    for (const [word, count] of words) {
      if (count <= 0) continue;
      const list = usageByWord.get(word) ?? [];
      list.push({ templateName, count });
      usageByWord.set(word, list);
    }
  }

  const duplicates = [...usageByWord.values()].filter((usages) =>
    usages.reduce((sum, item) => sum + item.count, 0) > 1
  );
  const duplicateWordCount = duplicates.length;
  const totalRepeatUses = duplicates.reduce((sum, usages) => {
    const totalUses = usages.reduce((acc, item) => acc + item.count, 0);
    return sum + Math.max(0, totalUses - 1);
  }, 0);

  const templatesWithDuplicates = new Set<string>();
  for (const usages of duplicates) {
    for (const usage of usages) templatesWithDuplicates.add(usage.templateName);
  }

  return {
    duplicateWordCount,
    totalRepeatUses,
    templatesWithDuplicates: templatesWithDuplicates.size,
  };
}

async function loadJobRow(jobId: bigint): Promise<any | null> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function emitCurrentJob(jobId: bigint) {
  const row = await loadJobRow(jobId);
  if (!row) return;
  const update = mapJobRow(row);
  ensureRuntime(update.id);
  emitJobUpdate(update.id, update);
}

function parseFillJobOptions(value: unknown): FillJobOptions {
  const defaults = { ...DEFAULT_OPTIONS };
  if (!value) return defaults;
  if (typeof value === "string") {
    try {
      return parseFillJobOptions(JSON.parse(value));
    } catch {
      return defaults;
    }
  }
  if (typeof value !== "object") return defaults;
  const raw = value as Partial<FillJobOptions>;
  const modeRaw =
    typeof raw.usageRebalanceMode === "string" ? raw.usageRebalanceMode.toLowerCase() : undefined;
  const usageRebalanceMode: UsageRebalanceMode =
    modeRaw === "safe" || modeRaw === "aggressive" || modeRaw === "cost"
      ? modeRaw
      : defaults.usageRebalanceMode;
  const editionHotBan =
    typeof raw.editionHotBan === "boolean" ? raw.editionHotBan : defaults.editionHotBan;
  return {
    ...defaults,
    ...raw,
    usageRebalanceMode,
    editionHotBan,
  };
}

async function runFillJob(jobId: bigint, issueId: bigint, options: FillJobOptions) {
  const jobIdStr = String(jobId);
  ensureRuntime(jobIdStr);
  const runtime = jobRuntimes.get(jobIdStr);
  if (!runtime) return;

  const updateLocal = (update: Partial<FillJobUpdate>) => {
    const last = runtime.lastUpdate;
    const merged: FillJobUpdate = {
      id: jobIdStr,
      issueId: String(issueId),
      status: update.status ?? last?.status ?? "running",
      progress: update.progress ?? last?.progress ?? 0,
      currentTemplate: update.currentTemplate ?? last?.currentTemplate ?? null,
      completedTemplates: update.completedTemplates ?? last?.completedTemplates ?? null,
      totalTemplates: update.totalTemplates ?? last?.totalTemplates ?? null,
      error: update.error ?? last?.error ?? null,
      templates: update.templates ?? last?.templates ?? null,
      archiveReady: update.archiveReady ?? last?.archiveReady,
    };
    emitJobUpdate(jobIdStr, merged);
  };

  try {
    await updateJob(jobId, { status: "running", progress: 0 });
    updateLocal({ status: "running", progress: 0 });

    const issue = await loadIssueContext(issueId);
    if (!issue) throw new Error("Issue not found");
    const overrideTemplateId =
      typeof options.filterTemplateId === "number" &&
      Number.isFinite(options.filterTemplateId) &&
      options.filterTemplateId > 0
        ? Math.floor(options.filterTemplateId)
        : null;
    const templateId = overrideTemplateId ?? issue.filterTemplateId ?? issue.snapshotTemplateId;
    if (!templateId) throw new Error("Filter template is not set for this issue");

    const template = await loadFilterTemplate(templateId);
    if (!template) throw new Error("Filter template not found");

    const snapshotFiles = await loadSnapshotFiles(issueId);
    if (!snapshotFiles.length) throw new Error("No uploaded templates for this issue");

    const issueSamplesDir = getSamplesDirForIssue(issue);
    const baseSamplesDir = getSamplesDir();
    const samplesDir = existsSync(issueSamplesDir) ? issueSamplesDir : baseSamplesDir;
    const resolved = resolveTemplatePaths(snapshotFiles, samplesDir);
    if (!resolved.length) {
      throw new Error("Uploaded template files not found on disk");
    }

    const { entries, lengths, invalid } = buildEntries(resolved);
    const dict = await loadDictionaryByTemplate(template, { lengths });
    if (!dict.size) throw new Error("Dictionary is empty for selected template");
    const wordLengthByWord = buildWordLengthLookup(dict);
    const usageCountByWord = new Map<string, number>();
    const editionUsageCountByWord = new Map<string, number>();
    const usagePriorityByWord = new Map<string, number>();
    const editionHotBannedWords = new Set<string>();
    let usageRebalanceThresholds: UsageRebalanceThresholds | null = null;
    let usageRebalanceContext: UsageRebalanceContext | null = null;
    let usageRebalanceReason = "off";
    const usageRebalanceCostMode = options.usageRebalance && options.usageRebalanceMode === "cost";
    let editionHotBanReason = "off";
    let editionUsageSnapshot: EditionUsageSnapshot | null = null;
    const ensureEditionUsageSnapshot = async (): Promise<EditionUsageSnapshot> => {
      if (!editionUsageSnapshot) {
        editionUsageSnapshot = await loadEditionUsageSnapshot(dict, issue.editionId, {
          usageRebalanceEnabled: options.usageRebalance,
          usageRebalanceMode: options.usageRebalanceMode,
          db: prisma,
        });
      }
      return editionUsageSnapshot;
    };
    if (options.usageStats) {
      const mainLangId = await resolveLanguageId(template.language);
      if (mainLangId !== null) {
        const loadedEditionUsage = await ensureEditionUsageSnapshot();
        for (const [word, usage] of loadedEditionUsage.usageByWord) {
          usageCountByWord.set(word, usage);
        }
        for (const [word, priority] of loadedEditionUsage.priorityByWord) {
          usagePriorityByWord.set(word, priority);
        }
        if (usagePriorityByWord.size) {
          sortDictionaryByUsagePriority(dict, usagePriorityByWord);
        }
      }
    }
    if (options.editionHotBan) {
      const loadedEditionUsage = await ensureEditionUsageSnapshot();
      for (const [word, usage] of loadedEditionUsage.usageByWord) {
        editionUsageCountByWord.set(word, usage);
      }
      const loadedHotBannedWords = await loadEditionHotBannedWords(issue.editionId, prisma);
      for (const word of loadedHotBannedWords) {
        editionHotBannedWords.add(word);
      }
      editionHotBanReason = `on (edition=${issue.editionId} banned=${editionHotBannedWords.size})`;
      if (!editionUsageCountByWord.size) {
        editionHotBanReason = `${editionHotBanReason} noUsage=1`;
      }
    }
    if (!options.usageRebalance) {
      usageRebalanceReason = "off";
    } else if (!options.unique) {
      usageRebalanceReason = "skipped (unique=off)";
    } else if (!options.usageStats || !usageCountByWord.size) {
      usageRebalanceReason = "skipped (no usage stats)";
    } else {
      usageRebalanceThresholds = resolveUsageRebalanceThresholds(
        dict,
        usageCountByWord,
        options.usageRebalanceMode
      );
      usageRebalanceContext = buildUsageRebalanceContext(dict, usageCountByWord, usageRebalanceThresholds);
      usageRebalanceReason = usageRebalanceCostMode
        ? `on (mode=cost strategy=hard-lite+soft+cost soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`
        : `on (mode=${options.usageRebalanceMode} soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`;
    }
    const definitionWhere = buildDefinitionWhereFromTemplate(template);

    const dictCounts = new Map<number, number>();
    for (const [len, words] of dict) dictCounts.set(len, words.length);
    for (const entry of entries) {
      entry.stats.pressure = computePressure(entry.lenCounts, dictCounts);
    }

    const sortedEntries = [...entries].sort((a, b) => compareByComplexity(a.stats, b.stats));

    const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
    const invalidByKey = new Map(invalid.map((entry) => [entry.key, entry]));

    const templatesState: FillTemplateStatus[] = resolved.map((item) => {
      const valid = entryByKey.get(item.key);
      if (valid) {
        return {
          key: item.key,
          name: valid.name,
          status: "pending" as const,
          error: null,
          order: item.order,
          sourceName: item.sourceName,
        };
      }
      const bad = invalidByKey.get(item.key);
      if (bad) {
        return {
          key: item.key,
          name: bad.name,
          status: "error" as const,
          error: bad.error,
          order: item.order,
          sourceName: item.sourceName,
        };
      }
      return {
        key: item.key,
        name: item.name,
        status: "error" as const,
        error: item.path ? "Invalid template" : "Template file not found",
        order: item.order,
        sourceName: item.sourceName,
      };
    });

    const indexByKey = new Map<string, number>();
    templatesState.forEach((item, idx) => {
      if (item.key) indexByKey.set(item.key, idx);
    });
    const templateNeighbors = buildTemplateNeighbors(resolved);

    const totalTemplates = templatesState.length;
    let completedTemplates = 0;
    let failedTemplates = templatesState.filter((t) => t.status === "error").length;
    const jobStartedAt = Date.now();
    let solveTotalMs = 0;
    const reviewTemplates: ReviewTemplate[] = [];
    const langIdCache = new Map<string, number | null>();
    const solvedWordsByTemplate = new Map<string, Set<string>>();
    const usedWordsInJob = new Set<string>();
    const usedWordCountInJob = new Map<string, number>();
    const uniqueFallbackStats = {
      probeAttempted: 0,
      probeSolved: 0,
      probeUnsat: 0,
      probeUnknown: 0,
      strictAttempted: 0,
      strictLimited: 0,
      strictSkippedByDeficit: 0,
      strictSolved: 0,
      adaptiveAttempted: 0,
      adaptiveSolved: 0,
      neighborAttempted: 0,
      neighborSolved: 0,
    };
    const usageRebalanceMetrics = buildUsageRebalanceMetrics();
    const usageCostMetrics = {
      templatesPolished: 0,
      replacements: 0,
      totalDeltaCost: 0,
      examinedCandidates: 0,
    };
    const editionHotBanMetrics = {
      loaded: editionHotBannedWords.size,
      applied: 0,
      relaxed: 0,
      relaxedByLen: new Map<number, number>(),
      unresolvedByLen: new Map<number, number>(),
    };
    const templateWordCounts = new Map<string, Map<string, number>>();
    const templateNameByKey = new Map(sortedEntries.map((entry) => [entry.key, entry.name]));
    const usedDefinitionKeys = new Set<string>();

    const pushTemplateUpdate = async (extra: Partial<FillJobUpdate> = {}) => {
      const finished = completedTemplates + failedTemplates;
      const progress = totalTemplates
        ? Math.min(100, Math.round((finished / totalTemplates) * 100))
        : 0;
      const payload: Partial<FillJobUpdate> = {
        completedTemplates,
        totalTemplates,
        templates: templatesState,
        progress,
        ...extra,
      };
      updateLocal(payload);
      await updateJob(jobId, payload);
    };

    await pushTemplateUpdate();

    if (!sortedEntries.length) {
      const msg = "No valid templates to fill";
      await updateJob(jobId, {
        status: "error",
        error: msg,
        templates: templatesState,
        completedTemplates,
        totalTemplates,
      });
      updateLocal({
        status: "error",
        error: msg,
        templates: templatesState,
        completedTemplates,
        totalTemplates,
      });
      return;
    }

    const nativeAvailable = isNativeDlxAvailable();
    if (!nativeAvailable) throw new Error("Native DLX solver is not available (JS solver is disabled)");
    const cpuParallel = detectCpuParallelism();
    const effectiveParallelRestarts = resolveParallelRestarts(options.restarts, options.parallelRestarts);
    const templateSource =
      overrideTemplateId !== null
        ? "override"
        : issue.filterTemplateId !== null
          ? "issue.filterTemplateId"
          : "issue.snapshotTemplateId";
    const nativeEngineLabel = "required(native)";
    const maxNodesLabel =
      typeof options.maxNodes === "number" && Number.isFinite(options.maxNodes)
        ? String(options.maxNodes)
        : "none";
    const maxMsLabel =
      typeof options.maxMs === "number" && Number.isFinite(options.maxMs) ? String(options.maxMs) : "none";
    console.log(
      `⚙ fill options: native=${nativeEngineLabel} shuffle=${options.shuffle ? "on" : "off"} unique=${options.unique ? "on" : "off"} lcv=${options.lcv ? "on" : "off"} restarts=${options.restarts} parallel=${effectiveParallelRestarts} (cfg=${options.parallelRestarts} cpu=${cpuParallel}) maxNodes=${maxNodesLabel} maxMs=${maxMsLabel} style=${options.style} explainFail=${options.explainFail ? "on" : "off"} noDefs=${options.noDefs ? "on" : "off"} usageStats=${options.usageStats ? "on" : "off"} usageRebalance=${usageRebalanceReason} editionHotBan=${editionHotBanReason}`
    );
    if (usageRebalanceThresholds) {
      console.log(
        `🧊 usage rebalance thresholds: mode=${options.usageRebalanceMode} soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold}`
      );
    }
    if (usageRebalanceContext) {
      for (const line of formatUsageBalanceByLen(usageRebalanceContext)) {
        console.log(line);
      }
    }
    console.log(
      `🎯 dictionary template: id=${templateId} source=${templateSource} issueId=${String(issue.issueId)} override=${overrideTemplateId ?? "none"} files=${sortedEntries.length}/${resolved.length}`
    );

    for (const entry of sortedEntries) {
      const idx = indexByKey.get(entry.key);
      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "running",
          error: null,
        };
      }
      await pushTemplateUpdate({ currentTemplate: entry.name });

      let lastFail: SolveFailInfo | null = null;
      const onFail = options.explainFail
        ? (info: SolveFailInfo) => {
            lastFail = info;
          }
        : undefined;
      const onProgress = (info: SolveProgress) => {
        const finished = completedTemplates + failedTemplates;
        const fraction = entry.slots.length
          ? Math.max(0, entry.slots.length - info.unfilled) / entry.slots.length
          : 0;
        const progress = totalTemplates
          ? Math.min(100, Math.round(((finished + fraction) / totalTemplates) * 100))
          : 0;
        updateLocal({ progress, currentTemplate: entry.name });
      };
      const rebalanceLcvPrioritySlack =
        !options.usageRebalance
          ? 0
          : options.usageRebalanceMode === "aggressive"
            ? AGGRESSIVE_REBALANCE_LCV_PRIORITY_SLACK
            : options.usageRebalanceMode === "cost"
              ? COST_REBALANCE_PRIORITY_FIRST_LCV_SLACK
              : 0;

      const solveWithDictionary = async (
        dictForSolve: Map<number, string[]>,
        overrides: {
          maxNodes?: number;
          maxMs?: number;
          wordPriority?: Map<string, number>;
          lcv?: boolean;
          shuffle?: boolean;
          lcvPrioritySlack?: number;
        } = {}
      ) => {
        const effectiveWordPriority =
          overrides.wordPriority ?? (options.usageStats ? usagePriorityByWord : undefined);
        const solvedNative = await solveDlxNativeAsync(entry.grid.data, entry.slots, dictForSolve, {
          shuffle: overrides.shuffle ?? options.shuffle,
          lcv: overrides.lcv ?? options.lcv,
          lcvPrioritySlack: overrides.lcvPrioritySlack ?? rebalanceLcvPrioritySlack,
          restarts: options.restarts,
          parallelRestarts: effectiveParallelRestarts,
          maxNodes: overrides.maxNodes ?? options.maxNodes,
          maxMs: overrides.maxMs ?? options.maxMs,
          nativeDlx: true,
          label: entry.name,
          wordPriority: effectiveWordPriority,
          onProgress,
          onFail,
        });
        if (solvedNative === undefined) {
          throw new Error("Native DLX solver is not available (JS solver is disabled)");
        }
        return solvedNative;
      };

      let solved: string[] | null | undefined;
      const solveStartedAt = Date.now();
      const applyEditionHotBan = (baseBlockedWords: Set<string>) => {
        if (!options.editionHotBan || !editionHotBannedWords.size) {
          return {
            blockedWords: baseBlockedWords,
            relaxedWords: new Set<string>(),
            relaxedByLen: new Map<number, number>(),
            unresolvedDeficitsByLen: new Map<number, number>(),
            appliedHotWords: 0,
          };
        }
        const relaxed = relaxHotBanForLenDeficits(
          entry.lenCounts,
          dict,
          baseBlockedWords,
          editionHotBannedWords,
          editionUsageCountByWord
        );
        editionHotBanMetrics.applied += relaxed.appliedHotWords;
        editionHotBanMetrics.relaxed += relaxed.relaxedWords.size;
        mergeLenCounter(editionHotBanMetrics.relaxedByLen, relaxed.relaxedByLen);
        mergeLenCounter(editionHotBanMetrics.unresolvedByLen, relaxed.unresolvedDeficitsByLen);
        return relaxed;
      };
      if (options.unique) {
        const neighborBlockedWords = new Set<string>();
        const neighborKeys = templateNeighbors.get(entry.key);
        if (neighborKeys) {
          for (const neighborKey of neighborKeys) {
            const used = solvedWordsByTemplate.get(neighborKey);
            if (!used) continue;
            for (const word of used) neighborBlockedWords.add(word);
          }
        }

        const strictBlockedWords = new Set<string>(neighborBlockedWords);
        for (const word of usedWordsInJob) strictBlockedWords.add(word);
        const neighborCappedBlockedWords = buildCappedBlockedWords(
          neighborBlockedWords,
          usedWordCountInJob,
          MAX_WORD_USES
        );
        const canFallbackToNeighbor = strictBlockedWords.size !== neighborCappedBlockedWords.size;
        const fallbackPriority = buildInJobUsagePriority(
          usedWordCountInJob,
          options.usageStats ? usagePriorityByWord : undefined
        );
        const buildRebalanceBlockedVariants = (
          baseBlockedWords: Set<string>,
          variantOptions: { allowCostHardFirst?: boolean } = {}
        ): RebalanceBlockedVariant[] => {
          if (!usageRebalanceThresholds || !usageRebalanceContext || !options.usageStats || !usageCountByWord.size) {
            return [{ kind: "base", blockedWords: baseBlockedWords }];
          }
          if (usageRebalanceCostMode) {
            return buildCostHardFirstRebalanceBlockedVariants(
              baseBlockedWords,
              usedWordCountInJob,
              entry.lenCounts,
              usageRebalanceContext,
              usageRebalanceMetrics,
              { allowHardFirst: variantOptions.allowCostHardFirst === true }
            );
          }
          const softOnlyBlockedWords = new Set<string>(baseBlockedWords);
          const softBlockedWords = buildSoftHotDuplicateBlock(
            usedWordCountInJob,
            usageRebalanceContext
          );
          for (const word of softBlockedWords) {
            if (softOnlyBlockedWords.has(word)) continue;
            softOnlyBlockedWords.add(word);
            usageRebalanceMetrics.softBlocked += 1;
            const len = usageRebalanceContext.wordLenInfoByWord.get(word)?.len;
            if (typeof len === "number") {
              incrementUsageRebalanceMetricByLen(usageRebalanceMetrics.softBlockedByLen, len, 1);
            }
          }
          const hard = applyHardHotBanLengthSafe(
            entry.lenCounts,
            softOnlyBlockedWords,
            usageRebalanceContext
          );
          usageRebalanceMetrics.hardCandidates += hard.hardCandidates;
          usageRebalanceMetrics.hardApplied += hard.hardApplied;
          usageRebalanceMetrics.hardRelaxed += hard.hardRelaxed;
          if (hard.disabledBySafety) usageRebalanceMetrics.hardDisabledBySafety += 1;
          mergeUsageRebalanceMetricByLen(
            usageRebalanceMetrics.hardAppliedByLen,
            hard.hardAppliedByLen
          );

          return buildRebalanceBlockedVariantCascade(
            baseBlockedWords,
            softOnlyBlockedWords,
            hard.blockedWords
          );
        };

        const solveWithBlockedVariants = async (
          phase: "strict" | "adaptive" | "neighbor",
          variants: RebalanceBlockedVariant[],
          phaseOptions: {
            sortByFallbackPriority: boolean;
            strictBudget?: { maxNodes: number; maxMs: number } | null;
          }
        ): Promise<string[] | null> => {
          let appliedStrictBudget = false;
          for (const [index, variant] of variants.entries()) {
            if (index > 0 && variant.kind === "softOnly") {
              usageRebalanceMetrics.hardRetrySoftOnly += 1;
            }
            const filtered = filterDictionaryByBlockedWords(dict, variant.blockedWords);
            const dictForSolve = phaseOptions.sortByFallbackPriority
              ? sortDictionaryByPriority(filtered, fallbackPriority)
              : filtered;
            const overrides: {
              maxNodes?: number;
              maxMs?: number;
              wordPriority?: Map<string, number>;
              lcv?: boolean;
              shuffle?: boolean;
              lcvPrioritySlack?: number;
            } = {};
            if (phase === "strict" && phaseOptions.strictBudget && !appliedStrictBudget) {
              overrides.maxNodes = phaseOptions.strictBudget.maxNodes;
              overrides.maxMs = phaseOptions.strictBudget.maxMs;
              appliedStrictBudget = true;
            }
            if (usageRebalanceCostMode) {
              overrides.wordPriority = fallbackPriority;
            }
            if (phase !== "strict") {
              overrides.wordPriority = fallbackPriority;
              overrides.lcv = false;
              overrides.shuffle = false;
            }
            const solvedVariant = await solveWithDictionary(dictForSolve, overrides);
            if (solvedVariant) return solvedVariant;
          }
          return null;
        };

        const strictHotBan = applyEditionHotBan(strictBlockedWords);
        const strictVariants = buildRebalanceBlockedVariants(strictHotBan.blockedWords, {
          allowCostHardFirst: usageRebalanceCostMode,
        });
        const strictPrimaryVariant = usageRebalanceCostMode
          ? strictVariants.find((variant) => variant.kind !== "hardAggressive")
          : strictVariants[0];
        const strictPrimaryBlockedWords =
          strictPrimaryVariant?.blockedWords ?? strictVariants[0]?.blockedWords ?? strictHotBan.blockedWords;
        const strictProbeBlockedWords = usageRebalanceCostMode
          ? (strictVariants[0]?.blockedWords ?? strictPrimaryBlockedWords)
          : strictPrimaryBlockedWords;
        const strictDeficitLengths = collectLengthDeficitsForBlockedWords(
          entry.lenCounts,
          dict,
          strictPrimaryBlockedWords
        );
        let adaptiveDeficitLengths = strictDeficitLengths;
        if (strictDeficitLengths.size === 0) {
          const strictDict = filterDictionaryByBlockedWords(dict, strictProbeBlockedWords);
          uniqueFallbackStats.probeAttempted += 1;
          const probeResult = runDlxProbe(entry.grid.data, entry.slots, strictDict, {
            label: `${entry.name}:probe`,
            maxNodes: options.maxNodes,
            maxMs: options.maxMs,
            uniqueWords: true,
            wordPriority: options.usageStats ? usagePriorityByWord : undefined,
            lcvPrioritySlack: rebalanceLcvPrioritySlack,
          });
          lastFail = probeResult.failInfo ?? lastFail;
          if (probeResult.solved) {
            solved = probeResult.solved;
            uniqueFallbackStats.probeSolved += 1;
          } else if (probeResult.outcome === "unsat") {
            uniqueFallbackStats.probeUnsat += 1;
            const failLen = extractFailedSlotLength(probeResult.failInfo);
            if (failLen !== null) {
              adaptiveDeficitLengths = new Set<number>([failLen]);
            } else {
              adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                entry.lenCounts,
                dict,
                strictPrimaryBlockedWords
              );
            }
            uniqueFallbackStats.strictAttempted += 1;
            const hasFallbackPotential = canFallbackToNeighbor || usedWordsInJob.size > 0;
            const strictBudget = hasFallbackPotential
              ? resolveStrictLimitedBudget(options.maxNodes, options.maxMs)
              : null;
            if (strictBudget) uniqueFallbackStats.strictLimited += 1;
            solved = await solveWithBlockedVariants("strict", strictVariants, {
              sortByFallbackPriority: false,
              strictBudget,
            });
            if (solved) {
              uniqueFallbackStats.strictSolved += 1;
            } else {
              const strictFailLen = extractFailedSlotLength(lastFail);
              if (strictFailLen !== null) {
                adaptiveDeficitLengths = new Set<number>([strictFailLen]);
              } else {
                adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                  entry.lenCounts,
                  dict,
                  strictPrimaryBlockedWords
                );
              }
            }
          } else {
            uniqueFallbackStats.probeUnknown += 1;
            uniqueFallbackStats.strictAttempted += 1;
            const hasFallbackPotential = canFallbackToNeighbor || usedWordsInJob.size > 0;
            const strictBudget = hasFallbackPotential
              ? resolveStrictLimitedBudget(options.maxNodes, options.maxMs)
              : null;
            if (strictBudget) uniqueFallbackStats.strictLimited += 1;
            solved = await solveWithBlockedVariants("strict", strictVariants, {
              sortByFallbackPriority: false,
              strictBudget,
            });
            if (solved) {
              uniqueFallbackStats.strictSolved += 1;
            } else {
              const failLen = extractFailedSlotLength(lastFail);
              if (failLen !== null) {
                adaptiveDeficitLengths = new Set<number>([failLen]);
              } else {
                adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                  entry.lenCounts,
                  dict,
                  strictPrimaryBlockedWords
                );
              }
            }
          }
        } else {
          uniqueFallbackStats.strictSkippedByDeficit += 1;
        }
        if (!solved && adaptiveDeficitLengths.size > 0) {
          const adaptiveBaseBlockedWords = buildAdaptiveBlockedWords(
            usedWordsInJob,
            usedWordCountInJob,
            neighborBlockedWords,
            adaptiveDeficitLengths,
            wordLengthByWord,
            MAX_WORD_USES
          );
          const adaptiveHotBan = applyEditionHotBan(adaptiveBaseBlockedWords);
          if (!areSetsEqual(adaptiveHotBan.blockedWords, strictHotBan.blockedWords)) {
            uniqueFallbackStats.adaptiveAttempted += 1;
            const adaptiveVariants = buildRebalanceBlockedVariants(adaptiveHotBan.blockedWords);
            solved = await solveWithBlockedVariants("adaptive", adaptiveVariants, {
              sortByFallbackPriority: true,
              strictBudget: null,
            });
            if (solved) uniqueFallbackStats.adaptiveSolved += 1;
          }
        }
        if (!solved && canFallbackToNeighbor) {
          uniqueFallbackStats.neighborAttempted += 1;
          const neighborHotBan = applyEditionHotBan(neighborCappedBlockedWords);
          const neighborVariants = buildRebalanceBlockedVariants(neighborHotBan.blockedWords);
          solved = await solveWithBlockedVariants("neighbor", neighborVariants, {
            sortByFallbackPriority: true,
            strictBudget: null,
          });
          if (solved) uniqueFallbackStats.neighborSolved += 1;
        }
      } else {
        const nonUniqueHotBan = applyEditionHotBan(new Set<string>());
        const hotBanFilteredDict = filterDictionaryByBlockedWords(dict, nonUniqueHotBan.blockedWords);
        const dictForTemplate = new Map<number, string[]>(
          [...hotBanFilteredDict].map(([len, words]) => [len, [...words]])
        );
        solved = await solveWithDictionary(dictForTemplate);
      }
      if (usageRebalanceCostMode && solved) {
        const polishPriority = buildInJobUsagePriority(
          usedWordCountInJob,
          options.usageStats ? usagePriorityByWord : undefined
        );
        const polish = polishSolvedRowsByCost({
          solvedRows: solved,
          slots: entry.slots,
          dict,
          uniqueWords: options.unique,
          maxPasses: COST_REBALANCE_POLISH_PASSES,
          priorityByWord: polishPriority,
          usedWordCountByWord: usedWordCountInJob,
          forbiddenWords: options.unique ? usedWordsInJob : undefined,
          repeatPenalty: IN_JOB_REPEAT_PRIORITY_MULTIPLIER,
        });
        usageCostMetrics.examinedCandidates += polish.examinedCandidates;
        if (polish.improved) {
          solved = polish.solvedRows;
          usageCostMetrics.templatesPolished += 1;
          usageCostMetrics.replacements += polish.replacements;
          usageCostMetrics.totalDeltaCost += polish.totalDeltaCost;
          console.log(
            `🧪 cost-polish: template=${entry.name} passes=${polish.passCount} replacements=${polish.replacements} delta=${polish.totalDeltaCost.toFixed(1)}`
          );
        }
      }
      solveTotalMs += Date.now() - solveStartedAt;

      if (!solved) {
        if (!lastFail && options.explainFail && nativeAvailable) {
          lastFail = consumeLastNativeFail();
        }
        const reason = lastFail ? formatFail(lastFail) : "no-solution";
        if (idx !== undefined) {
          templatesState[idx] = {
            ...templatesState[idx],
            status: "error",
            error: reason,
          };
        }
        failedTemplates += 1;
        await pushTemplateUpdate({ currentTemplate: entry.name });
        continue;
      }

      const usedWordsList = entry.slots.map((s) => s.cells.map(([r, c]) => solved![r][c]).join(""));
      templateWordCounts.set(entry.key, collectWordCounts(usedWordsList));
      if (options.unique) {
        const usedHere = new Set<string>();
        for (const word of usedWordsList) {
          const key = normalizeWordKey(word);
          if (!key) continue;
          usedHere.add(key);
          usedWordsInJob.add(key);
          usedWordCountInJob.set(key, (usedWordCountInJob.get(key) ?? 0) + 1);
        }
        solvedWordsByTemplate.set(entry.key, usedHere);
      }
      const langCode = template.language.toLowerCase();
      let langId = langIdCache.get(langCode);
      if (langId === undefined) {
        langId = await resolveLanguageId(langCode);
        langIdCache.set(langCode, langId);
      }
      const usedDefinitionsForTemplate = new Set(usedDefinitionKeys);
      const selectedWords =
        typeof langId === "number"
          ? await selectWordsAndDefinitionsForEdition(usedWordsList, {
              langId,
              editionId: issue.editionId,
              preferUsageStats: options.usageStats,
              definitionWhere,
              usedDefinitions: usedDefinitionsForTemplate,
            })
          : new Map<string, WordSelection>();
      const fallbackDefinitions = await loadDefinitions(usedWordsList, {
        langCode: template.language,
        definitionWhere,
      });
      reviewTemplates.push(
        buildReviewTemplate(
          entry,
          solved!,
          langCode,
          langId ?? null,
          selectedWords,
          fallbackDefinitions,
          usedDefinitionKeys
        )
      );

      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "done",
        };
      }
      completedTemplates += 1;
      await pushTemplateUpdate({ currentTemplate: entry.name });
    }

    if (completedTemplates <= 0) {
      const msg = "No templates were solved";
      await updateJob(jobId, {
        status: "error",
        error: msg,
        templates: templatesState,
        completedTemplates,
        totalTemplates,
      });
      updateLocal({
        status: "error",
        error: msg,
        templates: templatesState,
        completedTemplates,
        totalTemplates,
      });
      return;
    }

    reviewTemplates.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name, "ru");
    });
    const reviewData: FillReviewPayload = {
      version: 1,
      issue: {
        issueId: String(issue.issueId),
        editionId: issue.editionId,
        editionCode: issue.editionCode,
        issueLabel: issue.issueLabel,
      },
      options: {
        style: options.style,
        writeCrw: options.writeCrw,
        usageStats: options.usageStats,
      },
      templates: reviewTemplates,
    };
    const totalMin = ((Date.now() - jobStartedAt) / 60000).toFixed(1);
    const solveMin = (solveTotalMs / 60000).toFixed(1);
    const duplicateReport = buildDuplicateReport(templateWordCounts, templateNameByKey);
    console.log(
      `Итог: успешно заполнены ${completedTemplates}, не удалось ${failedTemplates} (всего ${totalTemplates})`
    );
    console.log(`\nВсе файлы обработаны. time=${totalMin}m solve=${solveMin}m`);
    if (options.unique) {
      console.log(
        `🔁 unique fallback: probeAttempted=${uniqueFallbackStats.probeAttempted} probeSolved=${uniqueFallbackStats.probeSolved} probeUnsat=${uniqueFallbackStats.probeUnsat} probeUnknown=${uniqueFallbackStats.probeUnknown} strict=${uniqueFallbackStats.strictSolved}/${uniqueFallbackStats.strictAttempted} strictLimited=${uniqueFallbackStats.strictLimited} skippedByDeficit=${uniqueFallbackStats.strictSkippedByDeficit} adaptive=${uniqueFallbackStats.adaptiveSolved}/${uniqueFallbackStats.adaptiveAttempted} neighbor=${uniqueFallbackStats.neighborSolved}/${uniqueFallbackStats.neighborAttempted}`
      );
    }
    if (options.usageRebalance) {
      console.log(`🧊 ${formatUsageRebalanceMetrics(usageRebalanceMetrics)}`);
      console.log(`🧊 ${formatUsageRebalanceLenMetrics(usageRebalanceMetrics)}`);
      if (usageRebalanceCostMode) {
        console.log(
          `🧪 cost-rebalance: strategy=hard-lite+soft+cost polished=${usageCostMetrics.templatesPolished} replacements=${usageCostMetrics.replacements} delta=${usageCostMetrics.totalDeltaCost.toFixed(1)} examined=${usageCostMetrics.examinedCandidates}`
        );
      }
    }
    if (options.editionHotBan) {
      console.log(
        `🔥 hot-ban: loaded=${editionHotBanMetrics.loaded} applied=${editionHotBanMetrics.applied} relaxed=${editionHotBanMetrics.relaxed}`
      );
      console.log(
        `🔥 hot-ban-by-len: relaxed=${formatLenCounter(editionHotBanMetrics.relaxedByLen)} unresolved=${formatLenCounter(editionHotBanMetrics.unresolvedByLen)}`
      );
    }
    console.log("\n📊 отчёт по дублям слов");
    console.log(
      `  слов-дублей=${duplicateReport.duplicateWordCount} повторных использований=${duplicateReport.totalRepeatUses} шаблонов-с-дублями=${duplicateReport.templatesWithDuplicates}`
    );
    await updateJob(jobId, {
      status: "review",
      progress: 100,
      currentTemplate: null,
      templates: templatesState,
      completedTemplates,
      totalTemplates,
      reviewData,
    });
    updateLocal({
      status: "review",
      progress: 100,
      currentTemplate: null,
      templates: templatesState,
      completedTemplates,
      totalTemplates,
      archiveReady: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateJob(jobId, { status: "error", error: msg });
    updateLocal({ status: "error", error: msg });
  }
}

export async function startFillJob(
  issueId: bigint,
  overrides: Partial<FillJobOptions> = {}
): Promise<FillJobUpdate> {
  await ensureFillJobsTable();
  await cleanupOldArchives();
  const reviewRows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM scanword_fill_jobs
    WHERE "issueId" = ${issueId} AND status = 'review'
    ORDER BY id DESC
    LIMIT 1
  `;
  if (reviewRows.length) {
    const reviewJob = mapJobRow(reviewRows[0]);
    ensureRuntime(reviewJob.id);
    return reviewJob;
  }
  const options = { ...DEFAULT_OPTIONS, ...overrides };
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO scanword_fill_jobs ("issueId", status, progress, options)
    VALUES (${issueId}, 'queued', 0, ${JSON.stringify(options)}::jsonb)
    ON CONFLICT ("issueId")
      WHERE status IN ('queued', 'running')
      DO NOTHING
    RETURNING *
  `;
  if (!rows.length) {
    const existing = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM scanword_fill_jobs
      WHERE "issueId" = ${issueId} AND status IN ('queued', 'running')
      ORDER BY id DESC
      LIMIT 1
    `;
    if (existing.length) {
      const update = mapJobRow(existing[0]);
      ensureRuntime(update.id);
      return update;
    }
    const retry = await prisma.$queryRaw<any[]>`
      INSERT INTO scanword_fill_jobs ("issueId", status, progress, options)
      VALUES (${issueId}, 'queued', 0, ${JSON.stringify(options)}::jsonb)
      ON CONFLICT ("issueId")
        WHERE status IN ('queued', 'running')
        DO NOTHING
      RETURNING *
    `;
    if (!retry.length) {
      throw new Error("Failed to create or load fill job");
    }
    const update = mapJobRow(retry[0]);
    ensureRuntime(update.id);
    runFillJob(BigInt(retry[0].id), issueId, options);
    return update;
  }

  const row = rows[0];
  const update = mapJobRow(row);
  ensureRuntime(update.id);
  runFillJob(BigInt(row.id), issueId, options);
  return update;
}

export async function getFillJob(jobId: bigint): Promise<FillJobUpdate | null> {
  await ensureFillJobsTable();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `;
  if (!rows.length) return null;
  return mapJobRow(rows[0]);
}

export async function getLatestFillJob(issueId: bigint): Promise<FillJobUpdate | null> {
  await ensureFillJobsTable();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM scanword_fill_jobs
    WHERE "issueId" = ${issueId}
    ORDER BY id DESC
    LIMIT 1
  `;
  if (!rows.length) return null;
  return mapJobRow(rows[0]);
}

export async function getJobArchivePath(jobId: bigint): Promise<string | null> {
  await ensureFillJobsTable();
  await cleanupOldArchives();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT "outputPath" FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0]?.outputPath ?? null;
}

export async function getFillJobReview(jobId: bigint): Promise<FillReviewPayload | null> {
  await ensureFillJobsTable();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT "reviewData" FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `;
  if (!rows.length) return null;
  return parseReviewPayload(rows[0]?.reviewData);
}

export async function getFillWordCandidates(
  jobId: bigint,
  payload: { templateKey?: string; slotId?: number; mask?: string; limit?: number }
): Promise<{ mask: string; slotId: number; candidates: FillMaskCandidate[] }> {
  const review = await getFillJobReview(jobId);
  if (!review) throw new Error("Review data not found");

  const templateKey = typeof payload.templateKey === "string" ? payload.templateKey : "";
  const slotIdRaw = Number(payload.slotId);
  const maskRaw = typeof payload.mask === "string" ? payload.mask : "";
  if (!templateKey) throw new Error("templateKey is required");
  if (!Number.isFinite(slotIdRaw)) throw new Error("slotId is required");
  const slotId = Math.trunc(slotIdRaw);
  const mask = normalizeMask(maskRaw);
  if (!mask) throw new Error("mask is required");

  const template = review.templates.find((item) => item.key === templateKey);
  if (!template) throw new Error("Template not found");
  const slot = template.slots.find((item) => item.slotId === slotId);
  if (!slot) throw new Error("Slot not found");
  if (slot.len !== mask.length) {
    throw new Error(`Mask length ${mask.length} does not match slot length ${slot.len}`);
  }
  if (template.langId == null) {
    throw new Error(`Language is not configured for template ${template.name}`);
  }

  const candidates = await findWordsByMask(mask, template.langId, payload.limit ?? 80);
  return {
    slotId,
    mask,
    candidates,
  };
}

export async function finalizeFillJob(jobId: bigint, payloadRaw: unknown): Promise<FillJobUpdate> {
  await ensureFillJobsTable();
  const row = await loadJobRow(jobId);
  if (!row) throw new Error("Job not found");
  const status = String(row.status ?? "");
  if (status !== "review") throw new Error("Job is not waiting for review");

  const review = parseReviewPayload(row.reviewData);
  if (!review) throw new Error("Review data not found for this job");
  const payload = (payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {}) as FinalizePayload;
  const templateInputMap = new Map<string, FinalizeTemplateInput>();
  for (const item of payload.templates ?? []) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.key !== "string" || item.key.length === 0) continue;
    templateInputMap.set(item.key, item);
  }

  const options = parseFillJobOptions(row.options);
  const outputRoot = getOutputDir();
  const issueRoot = path.join(
    outputRoot,
    sanitizeName(review.issue.editionCode),
    sanitizeName(review.issue.issueLabel)
  );
  const issueDir = path.join(issueRoot, `job-${jobId.toString()}`);
  mkdirSync(issueDir, { recursive: true });

  const templatesState = parseTemplatesPayload(row.templates) ?? review.templates.map((template) => ({
    key: template.key,
    name: template.name,
    status: "pending" as const,
    error: null,
    order: template.order,
    sourceName: template.sourceName,
  }));
  const indexByKey = new Map<string, number>();
  templatesState.forEach((item, idx) => {
    if (item.key) indexByKey.set(item.key, idx);
  });

  const issueWordUsage = new Map<bigint, number>();
  const issueOpredUsage = new Map<bigint, number>();
  const usedDefinitions = new Map<string, { templateName: string; slotId: number }>();
  const usedWordsByTemplate = new Map<string, Map<string, number>>();
  const templateNameByKey = new Map(review.templates.map((template) => [template.key, template.name]));
  const neighborsByTemplate = buildTemplateNeighbors(
    review.templates.map((template) => ({
      key: template.key,
      name: template.name,
      sourceName: template.sourceName,
      order: template.order,
      path: template.path,
    }))
  );
  const finalizeErrors: string[] = [];
  let completedTemplates = 0;
  const totalTemplates = templatesState.length || review.templates.length;

  await updateJob(jobId, {
    status: "running",
    progress: 0,
    currentTemplate: null,
    completedTemplates: 0,
    totalTemplates,
  });
  await emitCurrentJob(jobId);

  for (const template of review.templates) {
    const idx = indexByKey.get(template.key);
    if (idx !== undefined) {
      templatesState[idx] = {
        ...templatesState[idx],
        status: "running",
        error: null,
      };
    }

    const inputTemplate = templateInputMap.get(template.key);
    const slotInputMap = new Map<number, FinalizeSlotInput>();
    for (const item of inputTemplate?.slots ?? []) {
      if (!item || typeof item !== "object") continue;
      const slotIdRaw = Number(item.slotId);
      if (!Number.isFinite(slotIdRaw)) continue;
      slotInputMap.set(Math.trunc(slotIdRaw), item);
    }

    const states = new Map<number, FinalSlotState>();
    const errors: string[] = [];
    for (const slot of template.slots) {
      const built = buildFinalSlotState(slot, slotInputMap.get(slot.slotId));
      states.set(slot.slotId, built.state);
      errors.push(...built.errors.map((msg) => `Template ${template.name}: ${msg}`));
    }
    const wordsInTemplate = collectTemplateWords(states);
    errors.push(...validateWordUniqueness(template, states));
    errors.push(
      ...validateNeighborWordReuse(
        template,
        wordsInTemplate,
        neighborsByTemplate,
        usedWordsByTemplate,
        templateNameByKey
      )
    );
    errors.push(...validateTemplateDefinitions(template, states));
    errors.push(...validateDefinitionConsistency(template, states));
    errors.push(...validateDefinitionUniqueness(template, states));
    errors.push(...validateDefinitionReuseAcrossTemplates(template, states, usedDefinitions));

    let solvedRows: string[] | null = null;
    if (!errors.length) {
      try {
        solvedRows = buildSolvedGridFromSlots(template, states);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Template ${template.name}: ${msg}`);
      }
    }

    if (errors.length || !solvedRows) {
      finalizeErrors.push(...errors);
      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "error",
          error: errors[0] ?? "Failed to finalize template",
        };
      }
      continue;
    }
    usedWordsByTemplate.set(template.key, wordsInTemplate);
    registerUsedDefinitions(template, states, usedDefinitions);

    const slotStatesInOrder = template.slots
      .map((slot) => states.get(slot.slotId))
      .filter((item): item is FinalSlotState => Boolean(item));

    const definitions = new Map<string, string>();
    for (const state of slotStatesInOrder) {
      if (!definitions.has(state.word)) {
        definitions.set(state.word, state.definition);
      }
      if (state.wordId !== null) addCount(issueWordUsage, state.wordId, 1);
      if (state.opredId !== null) addCount(issueOpredUsage, state.opredId, 1);
    }

    const slots = template.slots.map((slot) => convertReviewSlotToSlot(slot));
    const { svg, svgRaw, usedWords } = buildSvg(template.grid, slots, solvedRows, definitions, {
      style: review.options.style,
    });

    const templateDir = path.join(issueDir, sanitizeName(template.name));
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(path.join(templateDir, "crossword.svg"), svg);
    writeFileSync(path.join(templateDir, "crossword-no-text.svg"), svgRaw);
    writeFileSync(path.join(templateDir, "used-words.txt"), usedWords);

    if (options.writeCrw && template.path) {
      const crw = buildCrw(template.grid, slots, solvedRows, {
        templatePath: template.path,
        lowerCaseWords: true,
      });
      writeFileSync(path.join(templateDir, `${template.name}.crw`), crw);
    }

    if (idx !== undefined) {
      templatesState[idx] = {
        ...templatesState[idx],
        status: "done",
        error: null,
      };
    }
    completedTemplates += 1;
  }

  if (finalizeErrors.length > 0) {
    writeFileSync(path.join(issueDir, "failures.json"), JSON.stringify(finalizeErrors, null, 2));
  }

  if (options.usageStats && completedTemplates > 0) {
    await persistUsageStatsForIssue(
      BigInt(review.issue.issueId),
      review.issue.editionId,
      issueWordUsage,
      issueOpredUsage
    );
    if (options.editionHotBan) {
      await recomputeEditionHotBanState(review.issue.editionId, prisma);
    }
  }

  const archivePath = path.join(issueRoot, `scanwords_${jobId.toString()}.zip`);
  const archiveSize = await zipDirectory(issueDir, archivePath);
  const finalStatus: FillJobStatus = completedTemplates > 0 ? "done" : "error";
  const finalError =
    completedTemplates > 0
      ? null
      : finalizeErrors[0] ?? "No templates were finalized successfully";

  await updateJob(jobId, {
    status: finalStatus,
    progress: 100,
    currentTemplate: null,
    templates: templatesState,
    completedTemplates,
    totalTemplates,
    outputPath: archivePath,
    outputSize: archiveSize,
    reviewData: review,
    ...(finalError ? { error: finalError } : {}),
  });
  await emitCurrentJob(jobId);

  const updated = await getFillJob(jobId);
  if (!updated) throw new Error("Failed to load updated job");
  return updated;
}

export function subscribeFillJob(jobId: string, listener: (update: FillJobUpdate) => void): () => void {
  const runtime = jobRuntimes.get(jobId);
  if (!runtime) return () => {};
  runtime.emitter.on("update", listener);
  if (runtime.lastUpdate) listener(runtime.lastUpdate);
  return () => {
    runtime.emitter.off("update", listener);
    if (
      runtime.emitter.listenerCount("update") === 0 &&
      (runtime.lastUpdate?.status === "done" || runtime.lastUpdate?.status === "error")
    ) {
      jobRuntimes.delete(jobId);
    }
  };
}
