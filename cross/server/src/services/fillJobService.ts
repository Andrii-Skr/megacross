import archiver from "archiver";
import { EventEmitter } from "node:events";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Prisma, prisma } from "../db/prisma";
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
import {
  consumeLastNativeFail,
  isNativeCspAvailable,
  isNativeDlxAvailable,
  solveCspNativeAsync,
  solveDlxNativeAsync,
} from "../utils/nativeDlx";
import {
  collectWordCounts,
  extractFailedSlotLength,
  normalizeWordKey,
  sortDictionaryByUsagePriority,
} from "../utils/fillShared";
import { buildCrw } from "../utils/writeCrw";
import { type Grid, type Slot } from "../types";
import { loadDefinitions, loadDictionaryByTemplate, type DictionaryFilterTemplate } from "./dictionary";
import {
  areSetsEqual,
  buildAdaptiveBlockedWords,
  buildCappedBlockedWords,
  buildEntries,
  buildInJobUsagePriority,
  buildTemplateNeighbors,
  buildWordLengthLookup,
  collectLengthDeficitsForBlockedWords,
  collectMostConstrainedLengthsForBlockedWords,
  compareByComplexity,
  computePressure,
  filterDictionaryByBlockedWords,
  getOutputDir,
  getSamplesDir,
  getSamplesDirForIssue,
  resolveTemplatePaths,
  sanitizeName,
  type SnapshotFile,
  type TemplateEntry,
  type TemplateError,
  type ResolvedTemplate,
} from "./fillJobTemplateService";
import {
  buildSolveRows,
  buildTemplateSetupMap,
  findKeywordPlacement,
  parseTemplateSetupPayload,
  resolveTemplateSetupForEntry,
  type FillTemplateKeywordCell,
  type FillTemplateSetup,
} from "./fillJobTemplateSetupService";
import {
  buildReviewTemplate,
  definitionSelectionBucket,
  normalizeDefinitionKey,
  normalizeDefinitionText,
  parseReviewPayload,
  type FillReviewPayload,
  type ReviewDefinitionOption,
  type ReviewTemplate,
  type ReviewWordSelection,
} from "./fillJobReviewService";
import {
  buildWordImageAbsolutePath,
  loadWordImagesByIds,
  loadWordImagesByWordIds,
  type ReviewWordImageOption,
} from "./fillWordImageService";
import {
  applyReviewTemplateOverrides,
  applyTemplateReviewResult,
  buildFillReviewPayload,
  collectReviewUsageState,
  type ReviewTemplateOverrideInput,
  type ReviewTemplateStatusRow,
} from "./fillJobReviewStateService";
import {
  buildFinalSlotState,
  buildSolvedGridFromSlots,
  collectTemplateWords,
  convertReviewSlotToSlot,
  registerUsedDefinitions,
  validateDefinitionConsistency,
  validateDefinitionReuseAcrossTemplates,
  validateDefinitionUniqueness,
  validateNeighborWordReuse,
  validateTemplateDefinitions,
  validateWordUniqueness,
  type DefinitionLengthLimits,
  type FinalizeSlotInput,
  type FinalSlotState,
} from "./fillFinalizeService";
import {
  cleanupOldFillJobArchives,
  createQueuedFillJob,
  loadFillJobArchivePath,
  loadFillJobById,
  loadFillJobReviewData,
  loadLatestActiveJobByIssue,
  loadLatestFillJobByIssue,
  patchFillJob,
  type FillJobRow,
  type FillJobPatch,
} from "./fillJobRepository";
import { buildAnswersOnlySvg } from "../../scripts/answer-only-svg";
import { buildCrosswordSvg } from "../../scripts/crossword-svg";

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

export type FillJobOptions = {
  engine: "dlx" | "csp";
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
  templateSetup?: FillTemplateSetup[];
};

type FinalizeTemplateInput = {
  key: string;
  slots?: FinalizeSlotInput[] | null;
};

type FinalizeSvgTypographyInput = {
  clueFontBasePt?: unknown;
  clueFontMinPt?: unknown;
  clueGlyphWidthPct?: unknown;
  clueLineHeightPct?: unknown;
  fontId?: unknown;
  systemFontFamily?: unknown;
};

type FinalizePayload = {
  templates?: FinalizeTemplateInput[] | null;
  definitionLimits?: DefinitionLengthLimits | null;
  svgTypography?: FinalizeSvgTypographyInput | null;
};

type RegenerateTemplatePayload = {
  templateKey?: unknown;
  templates?: ReviewTemplateOverrideInput[] | null;
};

type ParsedFinalizeSvgTypography = {
  clueFontBasePt: number | null;
  clueFontMinPt: number | null;
  clueGlyphWidthPct: number;
  clueLineHeightPct: number;
  fontId: bigint | null;
  systemFontFamily: string | null;
};

type ResolvedFinalizeSvgTypography = {
  clueFontBasePt: number | null;
  clueFontMinPt: number | null;
  clueGlyphWidthPct: number;
  clueLineHeightPct: number;
  fontFamily: string | null;
  fontFaceCss: string | null;
};

export type FillMaskCandidate = {
  wordId: string;
  word: string;
  definitions: ReviewDefinitionOption[];
  availableImages?: ReviewWordImageOption[];
};

type IssueContext = {
  issueId: bigint;
  editionId: number;
  editionCode: string;
  issueLabel: string;
  filterTemplateId: number | null;
  snapshotTemplateId: number | null;
};

type JobRuntime = {
  emitter: EventEmitter;
  lastUpdate: FillJobUpdate | null;
};

type FillExecutionContext = {
  issue: IssueContext;
  overrideTemplateId: number | null;
  templateId: number;
  templateSource: string;
  dictionaryTemplate: DictionaryFilterTemplate;
  resolved: ResolvedTemplate[];
  sortedEntries: TemplateEntry[];
  entryByKey: Map<string, TemplateEntry>;
  invalidByKey: Map<string, TemplateError>;
  templateNeighbors: Map<string, Set<string>>;
  dict: Map<number, string[]>;
  wordLengthByWord: Map<string, number>;
  usageCountByWord: Map<string, number>;
  editionUsageCountByWord: Map<string, number>;
  usagePriorityByWord: Map<string, number>;
  editionHotBannedWords: Set<string>;
  usageRebalanceThresholds: UsageRebalanceThresholds | null;
  usageRebalanceContext: UsageRebalanceContext | null;
  usageRebalanceReason: string;
  usageRebalanceCostMode: boolean;
  editionHotBanReason: string;
  definitionWhere: Prisma.opred_vWhereInput;
  effectiveParallelRestarts: number;
  cpuParallel: number;
  languageCode: string;
  languageId: number | null;
  templateSetupByKey: Map<string, FillTemplateSetup>;
};

type SolveSingleTemplateState = {
  solvedWordsByTemplate: Map<string, Set<string>>;
  usedWordsInJob: Set<string>;
  usedWordCountInJob: Map<string, number>;
  usedDefinitionKeys: Set<string>;
  reviewData?: FillReviewPayload | null;
};

type SolveSingleTemplateMetrics = {
  uniqueFallbackStats?: {
    probeAttempted: number;
    probeSolved: number;
    probeUnsat: number;
    probeUnknown: number;
    strictAttempted: number;
    strictLimited: number;
    strictSkippedByDeficit: number;
    strictSolved: number;
    adaptiveAttempted: number;
    adaptiveSolved: number;
    neighborAttempted: number;
    neighborSolved: number;
  };
  usageRebalanceMetrics: ReturnType<typeof buildUsageRebalanceMetrics>;
  usageCostMetrics: {
    templatesPolished: number;
    replacements: number;
    totalDeltaCost: number;
    examinedCandidates: number;
  };
  editionHotBanMetrics: {
    loaded: number;
    applied: number;
    relaxed: number;
    relaxedByLen: Map<number, number>;
    unresolvedByLen: Map<number, number>;
  };
};

const jobRuntimes = new Map<string, JobRuntime>();
const jobRunners = new Set<string>();

const DEFAULT_OPTIONS: FillJobOptions = {
  engine: "dlx",
  shuffle: true,
  unique: true,
  lcv: true,
  restarts: 2,
  parallelRestarts: 1,
  maxNodes: 200_000,
  maxMs: undefined,
  style: "corel",
  explainFail: true,
  noDefs: true,
  writeCrw: false,
  usageStats: true,
  usageRebalance: true,
  usageRebalanceMode: "cost",
  editionHotBan: false,
  filterTemplateId: null,
  templateSetup: [],
};

// Baseline defaults used specifically for API startFillJob.
// CLI-only flags from fill-batch (e.g. --report-duplicates, --template-parallel)
// are intentionally not part of FillJobOptions.
const START_FILL_JOB_DEFAULT_OPTIONS: FillJobOptions = {
  engine: "dlx",
  shuffle: true,
  unique: true,
  lcv: true,
  restarts: 2,
  parallelRestarts: 1,
  maxNodes: 200_000,
  maxMs: undefined,
  style: "corel",
  explainFail: true,
  noDefs: true,
  writeCrw: false,
  usageStats: true,
  usageRebalance: true,
  usageRebalanceMode: "cost",
  editionHotBan: false,
  filterTemplateId: null,
  templateSetup: [],
};

const ARCHIVE_TTL_MS = 1000 * 60 * 60 * 24 * 30 * 6;

type WordDefinitionCandidate = {
  id: bigint;
  word_text: string;
  word_text_norm: string | null;
  opred_v: Array<{
    id: bigint;
    text_opr: string;
  }>;
};

type UsageCountMap = Map<bigint, number>;

const IN_JOB_REPEAT_PRIORITY_MULTIPLIER = 1_000_000_000;
const MAX_WORD_USES = 2;
const AGGRESSIVE_REBALANCE_LCV_PRIORITY_SLACK = 24;
const COST_REBALANCE_PRIORITY_FIRST_LCV_SLACK = 1_000_000;
const COST_REBALANCE_POLISH_PASSES = 2;
const SVG_CLUE_FONT_PT_MIN = 1;
const SVG_CLUE_FONT_PT_MAX = 72;
const SVG_TYPOGRAPHY_PERCENT_MIN = 40;
const SVG_TYPOGRAPHY_PERCENT_MAX = 200;
const SVG_TYPOGRAPHY_PERCENT_DEFAULT = 80;
const DEFAULT_SYSTEM_SVG_FONT_FAMILY = "Arial";

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
  return Math.max(1, Math.min(safeRestarts, safeConfigured));
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
): Promise<Map<string, ReviewWordSelection>> {
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

  const selected = new Map<string, ReviewWordSelection>();
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

  const toPositiveMs = (raw: string | undefined, fallback: number): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  };
  const usageStatsTxMaxWaitMs = toPositiveMs(process.env.CROSS_USAGE_STATS_TX_MAX_WAIT_MS, 5_000);
  const usageStatsTxTimeoutMs = toPositiveMs(process.env.CROSS_USAGE_STATS_TX_TIMEOUT_MS, 60_000);

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
  }, {
    maxWait: usageStatsTxMaxWaitMs,
    timeout: usageStatsTxTimeoutMs,
  });
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

function mapJobRow(row: FillJobRow): FillJobUpdate {
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

function resumeActiveJobIfNeeded(row: FillJobRow): void {
  const status = String(row.status ?? "");
  if (status !== "queued" && status !== "running") return;
  if (status === "running") {
    const hasReviewData =
      row.reviewData !== null &&
      row.reviewData !== undefined &&
      (!(typeof row.reviewData === "string") || row.reviewData.trim().length > 0);
    const hasArchive = typeof row.outputPath === "string" && row.outputPath.trim().length > 0;
    // During review finalization we temporarily use "running", but that must never
    // restart the full fill pipeline via lazy "resume" calls.
    if (hasReviewData || hasArchive) return;
  }
  ensureRuntime(String(row.id));
  const options = parseFillJobOptions(row.options);
  void runFillJob(row.id, row.issueId, options);
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

export function buildInitialTemplatesState(
  resolved: ResolvedTemplate[],
  entryByKey: Map<string, TemplateEntry>,
  invalidByKey: Map<string, TemplateError>,
): ReviewTemplateStatusRow[] {
  return resolved.map((item) => {
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
}

async function loadFillExecutionContext(issueId: bigint, options: FillJobOptions): Promise<FillExecutionContext> {
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

  const dictionaryTemplate = await loadFilterTemplate(templateId);
  if (!dictionaryTemplate) throw new Error("Filter template not found");

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
  const dict = await loadDictionaryByTemplate(dictionaryTemplate, { lengths });
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
    usageRebalanceThresholds = resolveUsageRebalanceThresholds(dict, usageCountByWord, options.usageRebalanceMode);
    usageRebalanceContext = buildUsageRebalanceContext(dict, usageCountByWord, usageRebalanceThresholds);
    usageRebalanceReason = usageRebalanceCostMode
      ? `on (mode=cost strategy=hard-lite+soft+cost soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`
      : `on (mode=${options.usageRebalanceMode} soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`;
  }
  const definitionWhere = buildDefinitionWhereFromTemplate(dictionaryTemplate);

  const dictCounts = new Map<number, number>();
  for (const [len, words] of dict) dictCounts.set(len, words.length);
  for (const entry of entries) {
    entry.stats.pressure = computePressure(entry.lenCounts, dictCounts);
  }

  const sortedEntries = [...entries].sort((a, b) => compareByComplexity(a.stats, b.stats));
  const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const invalidByKey = new Map(invalid.map((entry) => [entry.key, entry]));
  const templateSetupByKey = buildTemplateSetupMap(options.templateSetup, new Set(resolved.map((template) => template.key)));
  const templateNeighbors = buildTemplateNeighbors(resolved);
  const cpuParallel = detectCpuParallelism();
  const effectiveParallelRestarts = resolveParallelRestarts(options.restarts, options.parallelRestarts);
  const languageCode = dictionaryTemplate.language.toLowerCase();
  const languageId = await resolveLanguageId(languageCode);
  const templateSource =
    overrideTemplateId !== null
      ? "override"
      : issue.filterTemplateId !== null
        ? "issue.filterTemplateId"
        : "issue.snapshotTemplateId";

  return {
    issue,
    overrideTemplateId,
    templateId,
    templateSource,
    dictionaryTemplate,
    resolved,
    sortedEntries,
    entryByKey,
    invalidByKey,
    templateNeighbors,
    dict,
    wordLengthByWord,
    usageCountByWord,
    editionUsageCountByWord,
    usagePriorityByWord,
    editionHotBannedWords,
    usageRebalanceThresholds,
    usageRebalanceContext,
    usageRebalanceReason,
    usageRebalanceCostMode,
    editionHotBanReason,
    definitionWhere,
    effectiveParallelRestarts,
    cpuParallel,
    languageCode,
    languageId,
    templateSetupByKey,
  };
}

function buildSvg(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>,
  options: {
    style: "default" | "corel";
    svgTypography?: ResolvedFinalizeSvgTypography | null;
    photoClues?: Array<{
      clueKey: string;
      href: string;
    }>;
    keyword?: {
      text: string;
      cells: FillTemplateKeywordCell[];
    } | null;
  }
): { svg: string; svgRaw: string; usedWords: string } {
  const isTruthyEnv = (value: string | undefined): boolean => {
    if (value === undefined) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
  };
  const typography = options.svgTypography ?? null;
  const configuredFontFamily = sanitizeSvgFontFamily(typography?.fontFamily);
  const fontFamily = configuredFontFamily ?? DEFAULT_SYSTEM_SVG_FONT_FAMILY;
  const debugClusterFill = isTruthyEnv(process.env.CROSS_ENABLE_02_AREA_EXPANSION);

  return buildCrosswordSvg(grid, slots, solved, definitions, {
    style: options.style,
    arrowMode: "batch",
    arrowScale: 0.6,
    fontFamily,
    debugClusterFill,
    svgTypography: {
      clueFontBasePt: typography?.clueFontBasePt ?? null,
      clueFontMinPt: typography?.clueFontMinPt ?? null,
      clueGlyphWidthScale: typography ? typography.clueGlyphWidthPct / 100 : undefined,
      clueLineHeightScale: typography ? typography.clueLineHeightPct / 100 : undefined,
      fontFaceCss: typography?.fontFaceCss ?? null,
    },
    photoClues: options.photoClues ?? [],
    type0Features: true,
    keyword: options.keyword ?? null,
  });
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
  const patch: FillJobPatch = {};
  if (data.status !== undefined) patch.status = data.status ?? null;
  if (data.progress !== undefined) patch.progress = data.progress ?? null;
  if (data.currentTemplate !== undefined) patch.currentTemplate = data.currentTemplate ?? null;
  if (data.completedTemplates !== undefined) patch.completedTemplates = data.completedTemplates ?? null;
  if (data.totalTemplates !== undefined) patch.totalTemplates = data.totalTemplates ?? null;
  if (data.error !== undefined) patch.error = data.error ?? null;
  if (data.templates !== undefined) {
    patch.templatesJson = data.templates === null ? null : JSON.stringify(data.templates);
  }
  if (data.reviewData !== undefined) {
    patch.reviewJson = data.reviewData === null ? null : JSON.stringify(data.reviewData);
  }
  if (data.outputPath !== undefined) patch.outputPath = data.outputPath ?? null;
  if (data.outputSize !== undefined) patch.outputSize = data.outputSize ?? null;
  await patchFillJob(prisma, jobId, patch);
}

function formatFail(info: SolveFailInfo): string {
  if (info.reason === "aborted") return `aborted (${info.detail?.limit ?? "limit"})`;
  if (info.reason === "forward-check") return "forward-check";
  if (info.reason === "zero-pick") return "zero-pick";
  return "no-solution";
}

function findConstraintViolation(
  templateName: string,
  solvedRows: string[],
  constrainedLetters: Map<string, string>,
): string | null {
  for (const [cellKey, expectedLetter] of constrainedLetters) {
    const [rowRaw, colRaw] = cellKey.split(",");
    const row = Number(rowRaw);
    const col = Number(colRaw);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) {
      continue;
    }
    const actualLetter = solvedRows[row]?.[col] ?? "";
    if (actualLetter === expectedLetter) continue;
    return `Template ${templateName}: solver ignored constrained cell (${row},${col}), expected ${expectedLetter}, got ${actualLetter || "empty"}`;
  }
  return null;
}

async function solveSingleTemplateForReview(
  entry: TemplateEntry,
  context: FillExecutionContext,
  options: FillJobOptions,
  state: SolveSingleTemplateState,
  metrics: SolveSingleTemplateMetrics,
  callbacks: {
    onProgress?: (info: SolveProgress) => void;
  } = {},
): Promise<{ reviewTemplate: ReviewTemplate; wordCounts: Map<string, number> } | { error: string }> {
  let lastFail: SolveFailInfo | null = null;
  const resolvedSetupResult = resolveTemplateSetupForEntry(
    entry,
    context.dict,
    context.templateSetupByKey.get(entry.key),
  );
  if (resolvedSetupResult.errors.length > 0) {
    return { error: resolvedSetupResult.errors[0] ?? "invalid-template-setup" };
  }
  const solveRowsBase = buildSolveRows(entry.grid.data, resolvedSetupResult.resolved.fixedLetters);
  let currentSolveRows = solveRowsBase;
  let constrainedLetters = resolvedSetupResult.resolved.fixedLetters;
  let keywordResult: { text: string; cells: FillTemplateKeywordCell[] } | null = null;
  if (resolvedSetupResult.resolved.keyword) {
    const placement = findKeywordPlacement(
      entry,
      context.dict,
      resolvedSetupResult.resolved.fixedLetters,
      resolvedSetupResult.resolved.keyword,
      { shuffle: options.shuffle },
    );
    if ("error" in placement) {
      return { error: placement.error };
    }
    currentSolveRows = buildSolveRows(entry.grid.data, placement.letters);
    constrainedLetters = placement.letters;
    keywordResult = {
      text: resolvedSetupResult.resolved.keyword,
      cells: placement.cells,
    };
  }
  const onFail = options.explainFail
    ? (info: SolveFailInfo) => {
        lastFail = info;
      }
    : undefined;
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
    } = {},
  ) => {
    const effectiveWordPriority =
      overrides.wordPriority ?? (options.usageStats ? context.usagePriorityByWord : undefined);
    const nativeOptions = {
      shuffle: overrides.shuffle ?? options.shuffle,
      lcv: overrides.lcv ?? options.lcv,
      lcvPrioritySlack: overrides.lcvPrioritySlack ?? rebalanceLcvPrioritySlack,
      restarts: options.restarts,
      parallelRestarts: context.effectiveParallelRestarts,
      maxNodes: overrides.maxNodes ?? options.maxNodes,
      maxMs: overrides.maxMs ?? options.maxMs,
      nativeDlx: true,
      label: entry.name,
      wordPriority: effectiveWordPriority,
      onProgress: callbacks.onProgress,
      onFail,
    };
    const solvedNative =
      options.engine === "csp"
        ? await solveCspNativeAsync(currentSolveRows, entry.slots, dictForSolve, nativeOptions)
        : await solveDlxNativeAsync(currentSolveRows, entry.slots, dictForSolve, nativeOptions);
    if (solvedNative === undefined) {
      throw new Error(
        options.engine === "csp"
          ? "Native CSP solver is not available (JS solver is disabled)"
          : "Native DLX solver is not available (JS solver is disabled)",
      );
    }
    return solvedNative;
  };

  let solved: string[] | null | undefined;
  const applyEditionHotBan = (baseBlockedWords: Set<string>) => {
    if (!options.editionHotBan || !context.editionHotBannedWords.size) {
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
      context.dict,
      baseBlockedWords,
      context.editionHotBannedWords,
      context.editionUsageCountByWord,
    );
    metrics.editionHotBanMetrics.applied += relaxed.appliedHotWords;
    metrics.editionHotBanMetrics.relaxed += relaxed.relaxedWords.size;
    mergeLenCounter(metrics.editionHotBanMetrics.relaxedByLen, relaxed.relaxedByLen);
    mergeLenCounter(metrics.editionHotBanMetrics.unresolvedByLen, relaxed.unresolvedDeficitsByLen);
    return relaxed;
  };

  if (options.unique) {
    const neighborBlockedWords = new Set<string>();
    const neighborKeys = context.templateNeighbors.get(entry.key);
    if (neighborKeys) {
      for (const neighborKey of neighborKeys) {
        const used = state.solvedWordsByTemplate.get(neighborKey);
        if (!used) continue;
        for (const word of used) neighborBlockedWords.add(word);
      }
    }

    const strictBlockedWords = new Set<string>(neighborBlockedWords);
    for (const word of state.usedWordsInJob) strictBlockedWords.add(word);
    const neighborCappedBlockedWords = buildCappedBlockedWords(
      neighborBlockedWords,
      state.usedWordCountInJob,
      MAX_WORD_USES,
    );
    const canFallbackToNeighbor = strictBlockedWords.size !== neighborCappedBlockedWords.size;
    const fallbackPriority = buildInJobUsagePriority(
      state.usedWordCountInJob,
      options.usageStats ? context.usagePriorityByWord : undefined,
      IN_JOB_REPEAT_PRIORITY_MULTIPLIER,
    );
    const buildRebalanceBlockedVariants = (
      baseBlockedWords: Set<string>,
      variantOptions: { allowCostHardFirst?: boolean } = {},
    ): RebalanceBlockedVariant[] => {
      if (
        !context.usageRebalanceThresholds ||
        !context.usageRebalanceContext ||
        !options.usageStats ||
        !context.usageCountByWord.size
      ) {
        return [{ kind: "base", blockedWords: baseBlockedWords }];
      }
      if (context.usageRebalanceCostMode) {
        return buildCostHardFirstRebalanceBlockedVariants(
          baseBlockedWords,
          state.usedWordCountInJob,
          entry.lenCounts,
          context.usageRebalanceContext,
          metrics.usageRebalanceMetrics,
          { allowHardFirst: variantOptions.allowCostHardFirst === true },
        );
      }
      const softOnlyBlockedWords = new Set<string>(baseBlockedWords);
      const softBlockedWords = buildSoftHotDuplicateBlock(state.usedWordCountInJob, context.usageRebalanceContext);
      for (const word of softBlockedWords) {
        if (softOnlyBlockedWords.has(word)) continue;
        softOnlyBlockedWords.add(word);
        metrics.usageRebalanceMetrics.softBlocked += 1;
        const len = context.usageRebalanceContext.wordLenInfoByWord.get(word)?.len;
        if (typeof len === "number") {
          incrementUsageRebalanceMetricByLen(metrics.usageRebalanceMetrics.softBlockedByLen, len, 1);
        }
      }
      const hard = applyHardHotBanLengthSafe(entry.lenCounts, softOnlyBlockedWords, context.usageRebalanceContext);
      metrics.usageRebalanceMetrics.hardCandidates += hard.hardCandidates;
      metrics.usageRebalanceMetrics.hardApplied += hard.hardApplied;
      metrics.usageRebalanceMetrics.hardRelaxed += hard.hardRelaxed;
      if (hard.disabledBySafety) metrics.usageRebalanceMetrics.hardDisabledBySafety += 1;
      mergeUsageRebalanceMetricByLen(metrics.usageRebalanceMetrics.hardAppliedByLen, hard.hardAppliedByLen);

      return buildRebalanceBlockedVariantCascade(baseBlockedWords, softOnlyBlockedWords, hard.blockedWords);
    };

    const solveWithBlockedVariants = async (
      phase: "strict" | "adaptive" | "neighbor",
      variants: RebalanceBlockedVariant[],
      phaseOptions: {
        sortByFallbackPriority: boolean;
        strictBudget?: { maxNodes: number; maxMs: number } | null;
      },
    ): Promise<string[] | null> => {
      let appliedStrictBudget = false;
      for (const [index, variant] of variants.entries()) {
        if (index > 0 && variant.kind === "softOnly") {
          metrics.usageRebalanceMetrics.hardRetrySoftOnly += 1;
        }
        const filtered = filterDictionaryByBlockedWords(context.dict, variant.blockedWords);
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
        if (context.usageRebalanceCostMode) {
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
      allowCostHardFirst: context.usageRebalanceCostMode,
    });
    const strictPrimaryVariant = context.usageRebalanceCostMode
      ? strictVariants.find((variant) => variant.kind !== "hardAggressive")
      : strictVariants[0];
    const strictPrimaryBlockedWords =
      strictPrimaryVariant?.blockedWords ?? strictVariants[0]?.blockedWords ?? strictHotBan.blockedWords;
    const strictProbeBlockedWords = context.usageRebalanceCostMode
      ? (strictVariants[0]?.blockedWords ?? strictPrimaryBlockedWords)
      : strictPrimaryBlockedWords;
    const strictDeficitLengths = collectLengthDeficitsForBlockedWords(
      entry.lenCounts,
      context.dict,
      strictPrimaryBlockedWords,
    );
    let adaptiveDeficitLengths = strictDeficitLengths;
    if (strictDeficitLengths.size === 0) {
      const strictDict = filterDictionaryByBlockedWords(context.dict, strictProbeBlockedWords);
      metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.probeAttempted += 1);
      const probeResult = runDlxProbe(currentSolveRows, entry.slots, strictDict, {
        label: `${entry.name}:probe`,
        maxNodes: options.maxNodes,
        maxMs: options.maxMs,
        uniqueWords: true,
        wordPriority: options.usageStats ? context.usagePriorityByWord : undefined,
        lcvPrioritySlack: rebalanceLcvPrioritySlack,
      });
      lastFail = probeResult.failInfo ?? lastFail;
      if (probeResult.solved) {
        solved = probeResult.solved;
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.probeSolved += 1);
      } else if (probeResult.outcome === "unsat") {
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.probeUnsat += 1);
        const failLen = extractFailedSlotLength(probeResult.failInfo);
        if (failLen !== null) {
          adaptiveDeficitLengths = new Set<number>([failLen]);
        } else {
          adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
            entry.lenCounts,
            context.dict,
            strictPrimaryBlockedWords,
          );
        }
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.strictAttempted += 1);
        const hasFallbackPotential = canFallbackToNeighbor || state.usedWordsInJob.size > 0;
        const strictBudget = hasFallbackPotential ? resolveStrictLimitedBudget(options.maxNodes, options.maxMs) : null;
        if (strictBudget && metrics.uniqueFallbackStats) metrics.uniqueFallbackStats.strictLimited += 1;
        solved = await solveWithBlockedVariants("strict", strictVariants, {
          sortByFallbackPriority: false,
          strictBudget,
        });
        if (solved) {
          metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.strictSolved += 1);
        } else {
          const strictFailLen = extractFailedSlotLength(lastFail);
          if (strictFailLen !== null) {
            adaptiveDeficitLengths = new Set<number>([strictFailLen]);
          } else {
            adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
              entry.lenCounts,
              context.dict,
              strictPrimaryBlockedWords,
            );
          }
        }
      } else {
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.probeUnknown += 1);
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.strictAttempted += 1);
        const hasFallbackPotential = canFallbackToNeighbor || state.usedWordsInJob.size > 0;
        const strictBudget = hasFallbackPotential ? resolveStrictLimitedBudget(options.maxNodes, options.maxMs) : null;
        if (strictBudget && metrics.uniqueFallbackStats) metrics.uniqueFallbackStats.strictLimited += 1;
        solved = await solveWithBlockedVariants("strict", strictVariants, {
          sortByFallbackPriority: false,
          strictBudget,
        });
        if (solved) {
          metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.strictSolved += 1);
        } else {
          const failLen = extractFailedSlotLength(lastFail);
          if (failLen !== null) {
            adaptiveDeficitLengths = new Set<number>([failLen]);
          } else {
            adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
              entry.lenCounts,
              context.dict,
              strictPrimaryBlockedWords,
            );
          }
        }
      }
    } else if (metrics.uniqueFallbackStats) {
      metrics.uniqueFallbackStats.strictSkippedByDeficit += 1;
    }
    if (!solved && adaptiveDeficitLengths.size > 0) {
      const adaptiveBaseBlockedWords = buildAdaptiveBlockedWords(
        state.usedWordsInJob,
        state.usedWordCountInJob,
        neighborBlockedWords,
        adaptiveDeficitLengths,
        context.wordLengthByWord,
        MAX_WORD_USES,
      );
      const adaptiveHotBan = applyEditionHotBan(adaptiveBaseBlockedWords);
      if (!areSetsEqual(adaptiveHotBan.blockedWords, strictHotBan.blockedWords)) {
        metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.adaptiveAttempted += 1);
        const adaptiveVariants = buildRebalanceBlockedVariants(adaptiveHotBan.blockedWords);
        solved = await solveWithBlockedVariants("adaptive", adaptiveVariants, {
          sortByFallbackPriority: true,
          strictBudget: null,
        });
        if (solved && metrics.uniqueFallbackStats) metrics.uniqueFallbackStats.adaptiveSolved += 1;
      }
    }
    if (!solved && canFallbackToNeighbor) {
      metrics.uniqueFallbackStats && (metrics.uniqueFallbackStats.neighborAttempted += 1);
      const neighborHotBan = applyEditionHotBan(neighborCappedBlockedWords);
      const neighborVariants = buildRebalanceBlockedVariants(neighborHotBan.blockedWords);
      solved = await solveWithBlockedVariants("neighbor", neighborVariants, {
        sortByFallbackPriority: true,
        strictBudget: null,
      });
      if (solved && metrics.uniqueFallbackStats) metrics.uniqueFallbackStats.neighborSolved += 1;
    }
  } else {
    const nonUniqueHotBan = applyEditionHotBan(new Set<string>());
    const hotBanFilteredDict = filterDictionaryByBlockedWords(context.dict, nonUniqueHotBan.blockedWords);
    const dictForTemplate = new Map<number, string[]>([...hotBanFilteredDict].map(([len, words]) => [len, [...words]]));
    solved = await solveWithDictionary(dictForTemplate);
  }

  if (context.usageRebalanceCostMode && solved) {
    const polishPriority = buildInJobUsagePriority(
      state.usedWordCountInJob,
      options.usageStats ? context.usagePriorityByWord : undefined,
      IN_JOB_REPEAT_PRIORITY_MULTIPLIER,
    );
    const polish = polishSolvedRowsByCost({
      solvedRows: solved,
      slots: entry.slots,
      dict: context.dict,
      uniqueWords: options.unique,
      maxPasses: COST_REBALANCE_POLISH_PASSES,
      priorityByWord: polishPriority,
      usedWordCountByWord: state.usedWordCountInJob,
      forbiddenWords: options.unique ? state.usedWordsInJob : undefined,
      repeatPenalty: IN_JOB_REPEAT_PRIORITY_MULTIPLIER,
      fixedLetters: constrainedLetters,
    });
    metrics.usageCostMetrics.examinedCandidates += polish.examinedCandidates;
    if (polish.improved) {
      solved = polish.solvedRows;
      metrics.usageCostMetrics.templatesPolished += 1;
      metrics.usageCostMetrics.replacements += polish.replacements;
      metrics.usageCostMetrics.totalDeltaCost += polish.totalDeltaCost;
      console.log(
        `🧪 cost-polish: template=${entry.name} passes=${polish.passCount} replacements=${polish.replacements} delta=${polish.totalDeltaCost.toFixed(1)}`,
      );
    }
  }

  if (!solved) {
    if (!lastFail && options.explainFail) {
      lastFail = consumeLastNativeFail();
    }
    return {
      error: lastFail ? formatFail(lastFail) : "no-solution",
    };
  }

  const constraintViolation = findConstraintViolation(entry.name, solved, constrainedLetters);
  if (constraintViolation) {
    return { error: constraintViolation };
  }

  const usedWordsList = entry.slots.map((slot) => slot.cells.map(([row, col]) => solved?.[row]?.[col] ?? "").join(""));
  const wordCounts = collectWordCounts(usedWordsList);
  if (options.unique) {
    const usedHere = new Set<string>();
    for (const word of usedWordsList) {
      const key = normalizeWordKey(word);
      if (!key) continue;
      usedHere.add(key);
      state.usedWordsInJob.add(key);
      state.usedWordCountInJob.set(key, (state.usedWordCountInJob.get(key) ?? 0) + 1);
    }
    state.solvedWordsByTemplate.set(entry.key, usedHere);
  }

  const usedDefinitionsForTemplate = new Set(state.usedDefinitionKeys);
  const selectedWords =
    typeof context.languageId === "number"
      ? await selectWordsAndDefinitionsForEdition(usedWordsList, {
          langId: context.languageId,
          editionId: context.issue.editionId,
          preferUsageStats: options.usageStats,
          definitionWhere: context.definitionWhere,
          usedDefinitions: usedDefinitionsForTemplate,
        })
      : new Map<string, ReviewWordSelection>();
  const fallbackDefinitions = await loadDefinitions(usedWordsList, {
    langCode: context.dictionaryTemplate.language,
    definitionWhere: context.definitionWhere,
  });
  const wordImagesByWordId = await loadWordImagesByWordIds(
    [...selectedWords.values()].map((selection) => selection.wordId),
  );
  const previousTemplate = state.reviewData?.templates.find((template) => template.key === entry.key) ?? null;

  return {
    reviewTemplate: buildReviewTemplate(
      entry,
      solved,
      context.languageCode,
      context.languageId ?? null,
      selectedWords,
      fallbackDefinitions,
      wordImagesByWordId,
      state.usedDefinitionKeys,
      keywordResult,
      previousTemplate,
    ),
    wordCounts,
  };
}


function normalizeMask(input: string): string {
  return input.trim().toUpperCase();
}

function buildArchiveFileName(jobId: bigint): string {
  return `scanwords_${jobId.toString()}__${Date.now()}.zip`;
}

function escapeLikeChar(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function computeAspectRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 0;
  return width / height;
}

function matchesPhotoAreaRatio(
  image: { width: number; height: number },
  bounds: { minRow: number; minCol: number; maxRow: number; maxCol: number },
): boolean {
  const areaWidth = bounds.maxCol - bounds.minCol + 1;
  const areaHeight = bounds.maxRow - bounds.minRow + 1;
  const imageRatio = computeAspectRatio(image.width, image.height);
  const areaRatio = computeAspectRatio(areaWidth, areaHeight);
  if (!(imageRatio > 0) || !(areaRatio > 0)) return false;
  return Math.abs(imageRatio - areaRatio) / areaRatio <= 0.08;
}

async function findWordsByMask(
  mask: string,
  langId: number,
  limit: number
): Promise<Array<{ wordId: string; word: string; definitions: ReviewDefinitionOption[]; availableImages: ReviewWordImageOption[] }>> {
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
  const wordImagesByWordId = await loadWordImagesByWordIds(ids);

  return rows
    .map((row) => ({
      wordId: String(row.id),
      word: normalizeWordKey(row.word ?? ""),
      definitions: defsByWord.get(row.id) ?? [],
      availableImages: wordImagesByWordId.get(String(row.id)) ?? [],
    }))
    .filter((row) => row.word.length > 0);
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

async function loadJobRow(jobId: bigint): Promise<FillJobRow | null> {
  return loadFillJobById(prisma, jobId);
}

async function emitCurrentJob(jobId: bigint) {
  const row = await loadJobRow(jobId);
  if (!row) return;
  const update = mapJobRow(row);
  ensureRuntime(update.id);
  emitJobUpdate(update.id, update);
}

function parseFillJobOptions(value: unknown, fallbackDefaults: FillJobOptions = DEFAULT_OPTIONS): FillJobOptions {
  const defaults = { ...fallbackDefaults };
  if (!value) return defaults;
  if (typeof value === "string") {
    try {
      return parseFillJobOptions(JSON.parse(value), defaults);
    } catch {
      return defaults;
    }
  }
  if (typeof value !== "object") return defaults;
  const raw = value as Record<string, unknown>;

  const toPositiveInt = (input: unknown, fallback: number): number => {
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  };
  const toOptionalPositiveInt = (input: unknown, fallback: number | undefined): number | undefined => {
    if (input === undefined || input === null) return fallback;
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  };
  const toOptionalTemplateId = (input: unknown, fallback: number | null): number | null => {
    if (input === undefined || input === null) return fallback;
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  };
  const toBoolean = (input: unknown, fallback: boolean): boolean =>
    typeof input === "boolean" ? input : fallback;

  const restarts = toPositiveInt(raw.restarts, defaults.restarts);
  // Backward compatibility for older payloads that used `parallel`.
  const parallelSource = raw.parallelRestarts ?? raw.parallel;
  const parallelRestarts = toPositiveInt(parallelSource, defaults.parallelRestarts);
  const modeRaw =
    typeof raw.usageRebalanceMode === "string" ? raw.usageRebalanceMode.toLowerCase() : undefined;
  const usageRebalanceMode: UsageRebalanceMode =
    modeRaw === "safe" || modeRaw === "aggressive" || modeRaw === "cost"
      ? modeRaw
      : defaults.usageRebalanceMode;

  return {
    engine: raw.engine === "csp" || raw.engine === "dlx" ? raw.engine : defaults.engine,
    shuffle: toBoolean(raw.shuffle, defaults.shuffle),
    unique: toBoolean(raw.unique, defaults.unique),
    lcv: toBoolean(raw.lcv, defaults.lcv),
    restarts,
    parallelRestarts,
    maxNodes: toOptionalPositiveInt(raw.maxNodes, defaults.maxNodes),
    maxMs: toOptionalPositiveInt(raw.maxMs, defaults.maxMs),
    style: raw.style === "default" || raw.style === "corel" ? raw.style : defaults.style,
    explainFail: toBoolean(raw.explainFail, defaults.explainFail),
    noDefs: toBoolean(raw.noDefs, defaults.noDefs),
    writeCrw: toBoolean(raw.writeCrw, defaults.writeCrw),
    usageStats: toBoolean(raw.usageStats, defaults.usageStats),
    usageRebalance: toBoolean(raw.usageRebalance, defaults.usageRebalance),
    usageRebalanceMode,
    editionHotBan: toBoolean(raw.editionHotBan, defaults.editionHotBan),
    filterTemplateId: toOptionalTemplateId(raw.filterTemplateId, defaults.filterTemplateId ?? null),
    templateSetup: parseTemplateSetupPayload(raw.templateSetup),
  };
}

function parseDefinitionLengthLimits(value: unknown): DefinitionLengthLimits | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { maxPerCell?: unknown; maxPerHalfCell?: unknown };
  const maxPerCellRaw = Number(raw.maxPerCell);
  const maxPerHalfCellRaw = Number(raw.maxPerHalfCell);
  if (!Number.isFinite(maxPerCellRaw) || !Number.isFinite(maxPerHalfCellRaw)) return null;
  const maxPerCell = Math.max(1, Math.trunc(maxPerCellRaw));
  const maxPerHalfCell = Math.max(1, Math.trunc(maxPerHalfCellRaw));
  return {
    maxPerCell,
    maxPerHalfCell: Math.min(maxPerHalfCell, maxPerCell),
  };
}

function sanitizeSvgFontFamily(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\r\n\t]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/[<>`"]/g, "")
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function parseOptionalPositiveBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value > 0n ? value : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^\d+$/u.test(normalized)) return null;
    try {
      const parsed = BigInt(normalized);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseSvgCluePtValue(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < SVG_CLUE_FONT_PT_MIN || parsed > SVG_CLUE_FONT_PT_MAX) return null;
  return Math.round(parsed * 1000) / 1000;
}

function parseSvgTypographyPercentValue(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  if (normalized < SVG_TYPOGRAPHY_PERCENT_MIN || normalized > SVG_TYPOGRAPHY_PERCENT_MAX) {
    return null;
  }
  return normalized;
}

function parseFinalizeSvgTypography(value: unknown): ParsedFinalizeSvgTypography {
  if (!value || typeof value !== "object") {
    return {
      clueFontBasePt: null,
      clueFontMinPt: null,
      clueGlyphWidthPct: SVG_TYPOGRAPHY_PERCENT_DEFAULT,
      clueLineHeightPct: SVG_TYPOGRAPHY_PERCENT_DEFAULT,
      fontId: null,
      systemFontFamily: null,
    };
  }
  const raw = value as FinalizeSvgTypographyInput;
  const clueFontBasePt = parseSvgCluePtValue(raw.clueFontBasePt);
  const clueFontMinPtRaw = parseSvgCluePtValue(raw.clueFontMinPt);
  const clueFontMinPt =
    clueFontBasePt != null && clueFontMinPtRaw != null
      ? Math.min(clueFontMinPtRaw, clueFontBasePt)
      : clueFontMinPtRaw;
  const clueGlyphWidthPct =
    parseSvgTypographyPercentValue(raw.clueGlyphWidthPct) ?? SVG_TYPOGRAPHY_PERCENT_DEFAULT;
  const clueLineHeightPct =
    parseSvgTypographyPercentValue(raw.clueLineHeightPct) ?? SVG_TYPOGRAPHY_PERCENT_DEFAULT;
  return {
    clueFontBasePt,
    clueFontMinPt,
    clueGlyphWidthPct,
    clueLineHeightPct,
    fontId: parseOptionalPositiveBigInt(raw.fontId),
    systemFontFamily: sanitizeSvgFontFamily(
      typeof raw.systemFontFamily === "string" ? raw.systemFontFamily : null
    ),
  };
}

function resolveFontsDir(): string {
  const explicit = process.env.CROSS_FONTS_DIR?.trim();
  if (explicit) return explicit;
  return path.join(path.dirname(getSamplesDir()), "fonts");
}

function resolveStoredFontFormat(
  formatRaw: string | null | undefined,
  storageRelPathRaw: string | null | undefined
): "ttf" | "otf" | "woff" | "woff2" {
  const format = (formatRaw ?? "").trim().toLowerCase();
  if (format === "ttf" || format === "otf" || format === "woff" || format === "woff2") {
    return format;
  }
  const ext = path.extname(storageRelPathRaw ?? "").toLowerCase();
  if (ext === ".otf") return "otf";
  if (ext === ".woff") return "woff";
  if (ext === ".woff2") return "woff2";
  return "ttf";
}

function resolveFontMimeType(
  format: "ttf" | "otf" | "woff" | "woff2",
  mimeTypeRaw: string | null | undefined
): string {
  const normalizedMime = (mimeTypeRaw ?? "").trim().toLowerCase();
  if (normalizedMime) return normalizedMime;
  if (format === "woff") return "font/woff";
  if (format === "woff2") return "font/woff2";
  if (format === "otf") return "font/otf";
  return "font/ttf";
}

function resolveFontCssFormat(format: "ttf" | "otf" | "woff" | "woff2"): string {
  if (format === "woff2") return "woff2";
  if (format === "woff") return "woff";
  if (format === "otf") return "opentype";
  return "truetype";
}

function resolveSafeFontPath(fontsRoot: string, storageRelPath: string): string | null {
  const normalizedRel = storageRelPath.replace(/\\/g, "/").replace(/^\/+/g, "");
  if (!normalizedRel || normalizedRel.includes("..")) return null;
  const root = path.resolve(fontsRoot);
  const absolute = path.resolve(root, normalizedRel);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

async function loadEmbeddedSvgFont(fontId: bigint): Promise<{ familyName: string; fontFaceCss: string } | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        familyName: string | null;
        format: string | null;
        mimeType: string | null;
        storageRelPath: string | null;
      }>
    >`SELECT "familyName", "format", "mimeType", "storageRelPath"
      FROM "public"."scanword_svg_fonts"
      WHERE "id" = ${fontId}
      LIMIT 1`;
    const row = rows[0];
    if (!row?.storageRelPath) return null;

    const fontsDir = resolveFontsDir();
    const fontPath = resolveSafeFontPath(fontsDir, row.storageRelPath);
    if (!fontPath || !existsSync(fontPath)) return null;

    const format = resolveStoredFontFormat(row.format, row.storageRelPath);
    const mimeType = resolveFontMimeType(format, row.mimeType);
    const cssFormat = resolveFontCssFormat(format);
    const familyName = sanitizeSvgFontFamily(row.familyName) ?? `ScanwordFont${fontId.toString()}`;
    const fontData = readFileSync(fontPath).toString("base64");
    const escapedFamily = familyName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const fontFaceCss = `@font-face{font-family:'${escapedFamily}';src:url('data:${mimeType};base64,${fontData}') format('${cssFormat}');font-weight:normal;font-style:normal;}`;
    return { familyName, fontFaceCss };
  } catch {
    return null;
  }
}

async function resolveFinalizeSvgTypography(
  parsed: ParsedFinalizeSvgTypography
): Promise<ResolvedFinalizeSvgTypography> {
  let fontFamily = parsed.systemFontFamily;
  let fontFaceCss: string | null = null;

  if (parsed.fontId != null) {
    const embedded = await loadEmbeddedSvgFont(parsed.fontId);
    if (embedded) {
      fontFamily = embedded.familyName;
      fontFaceCss = embedded.fontFaceCss;
    }
  }

  return {
    clueFontBasePt: parsed.clueFontBasePt,
    clueFontMinPt:
      parsed.clueFontBasePt != null && parsed.clueFontMinPt != null
        ? Math.min(parsed.clueFontMinPt, parsed.clueFontBasePt)
        : parsed.clueFontMinPt,
    clueGlyphWidthPct: parsed.clueGlyphWidthPct,
    clueLineHeightPct: parsed.clueLineHeightPct,
    fontFamily,
    fontFaceCss,
  };
}

async function runFillJob(jobId: bigint, issueId: bigint, options: FillJobOptions) {
  const jobIdStr = String(jobId);
  if (jobRunners.has(jobIdStr)) return;
  jobRunners.add(jobIdStr);
  ensureRuntime(jobIdStr);
  const runtime = jobRuntimes.get(jobIdStr);
  if (!runtime) {
    jobRunners.delete(jobIdStr);
    return;
  }

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

    const context = await loadFillExecutionContext(issueId, options);
    const { issue } = context;
    const templatesState: ReviewTemplateStatusRow[] = buildInitialTemplatesState(
      context.resolved,
      context.entryByKey,
      context.invalidByKey,
    );

    const indexByKey = new Map<string, number>();
    templatesState.forEach((item, idx) => {
      if (item.key) indexByKey.set(item.key, idx);
    });

    const totalTemplates = templatesState.length;
    let completedTemplates = 0;
    let failedTemplates = templatesState.filter((t) => t.status === "error").length;
    const jobStartedAt = Date.now();
    let solveTotalMs = 0;
    const reviewTemplates: ReviewTemplate[] = [];
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
      loaded: context.editionHotBannedWords.size,
      applied: 0,
      relaxed: 0,
      relaxedByLen: new Map<number, number>(),
      unresolvedByLen: new Map<number, number>(),
    };
    const templateWordCounts = new Map<string, Map<string, number>>();
    const templateNameByKey = new Map(context.sortedEntries.map((entry) => [entry.key, entry.name]));
    const solveState: SolveSingleTemplateState = {
      solvedWordsByTemplate: new Map<string, Set<string>>(),
      usedWordsInJob: new Set<string>(),
      usedWordCountInJob: new Map<string, number>(),
      usedDefinitionKeys: new Set<string>(),
    };
    const solveMetrics: SolveSingleTemplateMetrics = {
      uniqueFallbackStats,
      usageRebalanceMetrics,
      usageCostMetrics,
      editionHotBanMetrics,
    };

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

    if (!context.sortedEntries.length) {
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

    const nativeAvailable =
      options.engine === "csp" ? isNativeCspAvailable() : isNativeDlxAvailable();
    if (!nativeAvailable) {
      throw new Error(
        options.engine === "csp"
          ? "Native CSP solver is not available (JS solver is disabled)"
          : "Native DLX solver is not available (JS solver is disabled)"
      );
    }
    const nativeEngineLabel = `${options.engine}(native,required)`;
    const maxNodesLabel =
      typeof options.maxNodes === "number" && Number.isFinite(options.maxNodes)
        ? String(options.maxNodes)
        : "none";
    const maxMsLabel =
      typeof options.maxMs === "number" && Number.isFinite(options.maxMs) ? String(options.maxMs) : "none";
    console.log(
      `⚙ fill options: native=${nativeEngineLabel} shuffle=${options.shuffle ? "on" : "off"} unique=${options.unique ? "on" : "off"} lcv=${options.lcv ? "on" : "off"} restarts=${options.restarts} parallel=${context.effectiveParallelRestarts} (cfg=${options.parallelRestarts} cpu=${context.cpuParallel}) maxNodes=${maxNodesLabel} maxMs=${maxMsLabel} style=${options.style} explainFail=${options.explainFail ? "on" : "off"} noDefs=${options.noDefs ? "on" : "off"} usageStats=${options.usageStats ? "on" : "off"} usageRebalance=${context.usageRebalanceReason} editionHotBan=${context.editionHotBanReason}`,
    );
    if (context.usageRebalanceThresholds) {
      console.log(
        `🧊 usage rebalance thresholds: mode=${options.usageRebalanceMode} soft=${context.usageRebalanceThresholds.softThreshold} hard=${context.usageRebalanceThresholds.hardThreshold}`,
      );
    }
    if (context.usageRebalanceContext) {
      for (const line of formatUsageBalanceByLen(context.usageRebalanceContext)) {
        console.log(line);
      }
    }
    console.log(
      `🎯 dictionary template: id=${context.templateId} source=${context.templateSource} issueId=${String(issue.issueId)} override=${context.overrideTemplateId ?? "none"} files=${context.sortedEntries.length}/${context.resolved.length}`,
    );

    for (const entry of context.sortedEntries) {
      const idx = indexByKey.get(entry.key);
      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "running",
          error: null,
        };
      }
      await pushTemplateUpdate({ currentTemplate: entry.name });

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
      const solveStartedAt = Date.now();
      const result = await solveSingleTemplateForReview(entry, context, options, solveState, solveMetrics, {
        onProgress,
      });
      solveTotalMs += Date.now() - solveStartedAt;

      if ("error" in result) {
        if (idx !== undefined) {
          templatesState[idx] = {
            ...templatesState[idx],
            status: "error",
            error: result.error,
          };
        }
        failedTemplates += 1;
        await pushTemplateUpdate({ currentTemplate: entry.name });
        continue;
      }

      templateWordCounts.set(entry.key, result.wordCounts);
      reviewTemplates.push(result.reviewTemplate);

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
    const reviewData = buildFillReviewPayload(
      {
        issueId: String(issue.issueId),
        editionId: issue.editionId,
        editionCode: issue.editionCode,
        issueLabel: issue.issueLabel,
      },
      {
        style: options.style,
        writeCrw: options.writeCrw,
        usageStats: options.usageStats,
      },
      reviewTemplates,
    );
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
      if (context.usageRebalanceCostMode) {
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
  } finally {
    jobRunners.delete(jobIdStr);
  }
}

export async function startFillJob(
  issueId: bigint,
  overrides: Partial<FillJobOptions> = {}
): Promise<FillJobUpdate> {
  await cleanupOldFillJobArchives(prisma, ARCHIVE_TTL_MS);
  const options = parseFillJobOptions(overrides, START_FILL_JOB_DEFAULT_OPTIONS);
  let row = await createQueuedFillJob(prisma, issueId, JSON.stringify(options));
  if (!row) {
    const existing = await loadLatestActiveJobByIssue(prisma, issueId);
    if (existing) {
      const update = mapJobRow(existing);
      resumeActiveJobIfNeeded(existing);
      return update;
    }
    row = await createQueuedFillJob(prisma, issueId, JSON.stringify(options));
    if (!row) {
      throw new Error("Failed to create or load fill job");
    }
  }

  const update = mapJobRow(row);
  ensureRuntime(update.id);
  void runFillJob(row.id, issueId, options);
  return update;
}

export async function getFillJob(jobId: bigint): Promise<FillJobUpdate | null> {
  const row = await loadFillJobById(prisma, jobId);
  if (!row) return null;
  resumeActiveJobIfNeeded(row);
  return mapJobRow(row);
}

export async function getLatestFillJob(issueId: bigint): Promise<FillJobUpdate | null> {
  const row = await loadLatestFillJobByIssue(prisma, issueId);
  if (!row) return null;
  resumeActiveJobIfNeeded(row);
  return mapJobRow(row);
}

export async function getJobArchivePath(jobId: bigint, fileName?: string | null): Promise<string | null> {
  await cleanupOldFillJobArchives(prisma, ARCHIVE_TTL_MS);
  const outputPath = await loadFillJobArchivePath(prisma, jobId);
  if (!outputPath) return null;
  const requested = typeof fileName === "string" ? fileName.trim() : "";
  if (!requested) return outputPath;

  const safeName = path.basename(requested);
  if (safeName !== requested) return null;
  const archiveNamePattern = new RegExp(`^scanwords_${jobId.toString()}(?:__\\d{10,})?\\.zip$`);
  if (!archiveNamePattern.test(safeName)) return null;
  return path.join(path.dirname(outputPath), safeName);
}

export async function getFillJobReview(jobId: bigint): Promise<FillReviewPayload | null> {
  const reviewData = await loadFillJobReviewData(prisma, jobId);
  return parseReviewPayload(reviewData);
}

export async function regenerateFillJobTemplate(jobId: bigint, payloadRaw: unknown): Promise<FillJobUpdate> {
  const row = await loadJobRow(jobId);
  if (!row) throw new Error("Job not found");
  if (String(row.status ?? "") !== "review") throw new Error("Job is not waiting for review");

  const review = parseReviewPayload(row.reviewData);
  if (!review) throw new Error("Review data not found for this job");

  const payload = (payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {}) as RegenerateTemplatePayload;
  const templateKey = typeof payload.templateKey === "string" ? payload.templateKey.trim() : "";
  if (!templateKey) throw new Error("templateKey is required");

  const options = parseFillJobOptions(row.options);
  const context = await loadFillExecutionContext(row.issueId, options);
  const templatesState =
    parseTemplatesPayload(row.templates) ??
    buildInitialTemplatesState(context.resolved, context.entryByKey, context.invalidByKey);

  const effectiveReview = applyReviewTemplateOverrides(review, Array.isArray(payload.templates) ? payload.templates : []);
  const usageState = collectReviewUsageState(effectiveReview, templateKey);
  const solveMetrics: SolveSingleTemplateMetrics = {
    usageRebalanceMetrics: buildUsageRebalanceMetrics(),
    usageCostMetrics: {
      templatesPolished: 0,
      replacements: 0,
      totalDeltaCost: 0,
      examinedCandidates: 0,
    },
    editionHotBanMetrics: {
      loaded: context.editionHotBannedWords.size,
      applied: 0,
      relaxed: 0,
      relaxedByLen: new Map<number, number>(),
      unresolvedByLen: new Map<number, number>(),
    },
  };

  const targetEntry = context.entryByKey.get(templateKey);
  const applied = !targetEntry
    ? applyTemplateReviewResult(effectiveReview, templatesState, templateKey, {
        type: "error",
        error: context.invalidByKey.get(templateKey)?.error ?? "Template is not available for regeneration",
      })
    : await (async () => {
        const result = await solveSingleTemplateForReview(
          targetEntry,
          context,
          options,
          { ...usageState, reviewData: effectiveReview },
          solveMetrics
        );
        if ("error" in result) {
          return applyTemplateReviewResult(effectiveReview, templatesState, templateKey, {
            type: "error",
            error: result.error,
          });
        }
        return applyTemplateReviewResult(effectiveReview, templatesState, templateKey, {
          type: "success",
          template: result.reviewTemplate,
        });
      })();

  const completedTemplates = applied.templatesState.filter((item) => item.status === "done").length;
  const totalTemplates = applied.templatesState.length;
  await updateJob(jobId, {
    status: "review",
    progress: 100,
    currentTemplate: null,
    completedTemplates,
    totalTemplates,
    error: null,
    templates: applied.templatesState,
    reviewData: applied.review,
  });
  await emitCurrentJob(jobId);

  const updated = await getFillJob(jobId);
  if (!updated) throw new Error("Failed to load updated job");
  return updated;
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
  const row = await loadJobRow(jobId);
  if (!row) throw new Error("Job not found");
  const status = String(row.status ?? "");
  if (status !== "review") throw new Error("Job is not waiting for review");

  const review = parseReviewPayload(row.reviewData);
  if (!review) throw new Error("Review data not found for this job");
  const payload = (payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {}) as FinalizePayload;
  const effectiveReview = applyReviewTemplateOverrides(review, Array.isArray(payload.templates) ? payload.templates : []);
  const definitionLengthLimits = parseDefinitionLengthLimits(payload.definitionLimits);
  const parsedSvgTypography = parseFinalizeSvgTypography(payload.svgTypography);
  const resolvedSvgTypography = await resolveFinalizeSvgTypography(parsedSvgTypography);
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
    sanitizeName(effectiveReview.issue.editionCode),
    sanitizeName(effectiveReview.issue.issueLabel)
  );
  const issueDir = path.join(issueRoot, `job-${jobId.toString()}`);
  mkdirSync(issueDir, { recursive: true });

  const templatesState = parseTemplatesPayload(row.templates) ?? effectiveReview.templates.map((template) => ({
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
  const templateNameByKey = new Map(effectiveReview.templates.map((template) => [template.key, template.name]));
  const neighborsByTemplate = buildTemplateNeighbors(
    effectiveReview.templates.map((template) => ({
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

  for (const template of effectiveReview.templates) {
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
    errors.push(...validateTemplateDefinitions(template, states, definitionLengthLimits));
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
    const selectedImageIds = slotStatesInOrder
      .map((state) => state.imageId)
      .filter((value): value is bigint => value !== null);
    const storedImagesById = await loadWordImagesByIds(selectedImageIds);

    const definitions = new Map<string, string>();
    for (const state of slotStatesInOrder) {
      if (!definitions.has(state.word)) {
        definitions.set(state.word, state.definition);
      }
      if (state.wordId !== null) addCount(issueWordUsage, state.wordId, 1);
      if (state.opredId !== null) addCount(issueOpredUsage, state.opredId, 1);
    }

    const slots = template.slots.map((slot) => convertReviewSlotToSlot(slot));
    const photoClues: Array<{ clueKey: string; href: string }> = [];
    const photoErrors: string[] = [];
    const templateDir = path.join(issueDir, sanitizeName(template.name));
    mkdirSync(templateDir, { recursive: true });
    const photoDir = path.join(templateDir, "assets");
    mkdirSync(photoDir, { recursive: true });
    for (const slot of template.slots) {
      if (!slot.isPhotoDefinition) continue;
      const state = states.get(slot.slotId);
      if (!state?.imageId) continue;
      const image = storedImagesById.get(String(state.imageId));
      if (!image) {
        photoErrors.push(`Template ${template.name}: image ${String(state.imageId)} not found for slot ${slot.slotId}`);
        continue;
      }
      if (state.wordId === null || image.wordId !== String(state.wordId)) {
        photoErrors.push(`Template ${template.name}: image ${image.id} does not belong to slot ${slot.slotId} word`);
        continue;
      }
      if (!slot.photoAreaBounds) {
        photoErrors.push(`Template ${template.name}: photo area is missing for slot ${slot.slotId}`);
        continue;
      }
      if (!matchesPhotoAreaRatio(image, slot.photoAreaBounds)) {
        photoErrors.push(`Template ${template.name}: image ${image.id} ratio does not match slot ${slot.slotId}`);
        continue;
      }
      const sourcePath = buildWordImageAbsolutePath(image.storageRelPath);
      const ext = path.extname(image.fileName) || ".img";
      const assetName = `slot-${slot.slotId}${ext}`;
      try {
        writeFileSync(path.join(photoDir, assetName), readFileSync(sourcePath));
      } catch {
        photoErrors.push(`Template ${template.name}: image file is missing for slot ${slot.slotId}`);
        continue;
      }
      if (slot.clueCell) {
        photoClues.push({
          clueKey: slot.clueCell.key,
          href: `assets/${assetName}`,
        });
      }
    }
    if (photoErrors.length) {
      finalizeErrors.push(...photoErrors);
      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "error",
          error: photoErrors[0] ?? "Photo clue validation failed",
        };
      }
      continue;
    }

    const { svg, svgRaw, usedWords } = buildSvg(template.grid, slots, solvedRows, definitions, {
      style: effectiveReview.options.style,
      svgTypography: resolvedSvgTypography,
      photoClues,
      keyword: template.keyword ?? null,
    });
    const svgAnswers = buildAnswersOnlySvg(template.grid, solvedRows);
    writeFileSync(path.join(templateDir, "crossword.svg"), svg);
    writeFileSync(path.join(templateDir, "crossword-no-text.svg"), svgRaw);
    writeFileSync(path.join(templateDir, "crossword-answers.svg"), svgAnswers);
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
      BigInt(effectiveReview.issue.issueId),
      effectiveReview.issue.editionId,
      issueWordUsage,
      issueOpredUsage
    );
    if (options.editionHotBan) {
      await recomputeEditionHotBanState(effectiveReview.issue.editionId, prisma);
    }
  }

  const archivePath = path.join(issueRoot, buildArchiveFileName(jobId));
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
    reviewData: effectiveReview,
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
