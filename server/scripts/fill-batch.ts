
//  • читает *.fsh из sample/ (или запускает каждый подпапку sample/ как отдельный ран)
//  • решает каждый кроссворд (shuffle optional)
//  • флаг -u / --unique  → максимум уникальных слов, но с fallback-повторами
//    (повторы запрещены внутри шаблона и в соседних шаблонах одного/соседних разворотов)
//  • флаг --report-duplicates → отчёт по дублям слов в конце
//  • сохраняет SVG + used-words.txt в out/<basename>/
//------------------------------------------------------------------
import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename, dirname, extname }               from "node:path";
import { parseArgs }                             from "node:util";
import { createPrismaClient } from "../src/db/prisma";

import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import type { SolveFailInfo, SolveProgress } from "../src/utils/solver";
import {
  resolveProbeBudget,
  resolveProbeOutcome,
  resolveStrictLimitedBudget,
  runDlxProbe,
  sortDictionaryByPriority,
} from "../src/utils/fillFallback";
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
} from "../src/utils/usageRebalance";
import {
  formatLenCounter,
  loadEditionHotBannedWords,
  mergeLenCounter,
  recomputeEditionHotBanState,
  relaxHotBanForLenDeficits,
} from "../src/utils/editionHotBan";
import { loadEditionUsageSnapshot } from "../src/utils/editionUsageSnapshot";
import { polishSolvedRowsByCost } from "../src/utils/solutionPolish";
import {
  consumeLastNativeFail,
  isNativeCspAvailable,
  isNativeDlxAvailable,
  solveCspNativeAsync,
  solveDlxNativeAsync,
} from "../src/utils/nativeDlx";
import {
  loadDictionary,
  loadDictionaryByTemplate,
  loadDefinitions,
  type DictionaryFilterTemplate,
} from "../src/services/dictionary";
import { buildCrw }            from "../src/utils/writeCrw";
import { buildClueEntries, buildClueLayouts } from "../src/utils/clues";
import { Cell, Grid, Slot }    from "../src/types";
import { arrowSvg }            from "./arrow-utils";
import { buildAnswersOnlySvg } from "./answer-only-svg";
import { buildClueTextMap, renderClueText, resolveMinClueFontSize } from "./clue-svg";
import { resolveCenteredTextStartX } from "./text-position";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  COREL_CELL_SIZE_UNITS,
  COREL_MIN_SVG_HEIGHT_UNITS,
  COREL_MIN_SVG_WIDTH_UNITS,
  COREL_STROKE_WIDTH_UNITS,
  formatCorelSizeMm,
  WORD_TEXT_FILL,
} from "./svg-theme";

const DEFAULT_CELL       = 30;        // px
const SAMPLE_DIR = "sample";
const OUT_DIR    = "out";
const FILL_BATCH_RUN_LOG_FILE = join(OUT_DIR, "fill-batch-runs.log");
const RUN_LOG_SEPARATOR = "=".repeat(96);
const IN_BATCH_REPEAT_PRIORITY_MULTIPLIER = 1_000_000_000;
const MAX_WORD_USES = 2;
const AGGRESSIVE_REBALANCE_LCV_PRIORITY_SLACK = 24;
const COST_REBALANCE_PRIORITY_FIRST_LCV_SLACK = 1_000_000;
const COST_REBALANCE_POLISH_PASSES = 2;

function parseUsageRebalanceMode(
  value: string | undefined,
  usageRebalanceEnabled: boolean
): UsageRebalanceMode {
  if (!usageRebalanceEnabled) return "safe";
  if (!value) return "aggressive";
  const normalized = value.trim().toLowerCase();
  if (normalized === "safe" || normalized === "aggressive" || normalized === "cost") {
    return normalized;
  }
  console.warn(`Unknown --usage-rebalance-mode value "${value}", using "aggressive".`);
  return "aggressive";
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function appendRunLogBlock(lines: string[]): void {
  try {
    mkdirSync(dirname(FILL_BATCH_RUN_LOG_FILE), { recursive: true });
    appendFileSync(FILL_BATCH_RUN_LOG_FILE, `${lines.join("\n")}\n`, "utf8");
  } catch (_error) {
    // Best-effort logging only; fill-batch should continue even if log file write fails.
  }
}

function buildRunCommand(args: string[]): string {
  return args.length > 0 ? `pnpm run fill-batch -- ${args.join(" ")}` : "pnpm run fill-batch";
}

function resolveParallelRestarts(
  restarts: number,
  configuredRaw: number | undefined,
  explicit: boolean
): number {
  const safeRestarts = Number.isFinite(restarts) && restarts > 0 ? Math.floor(restarts) : 1;
  if (!explicit) return 1;
  const safeConfigured =
    Number.isFinite(configuredRaw) && configuredRaw && configuredRaw > 0
      ? Math.floor(configuredRaw)
      : 1;
  return Math.max(1, Math.min(safeRestarts, safeConfigured));
}

type IssueTemplateContext = {
  issueId: bigint;
  editionCode: string;
  issueLabel: string;
  templateId: number;
  templateName: string;
  template: DictionaryFilterTemplate;
};

type IssueContext = {
  issueId: bigint;
  editionId: number;
  editionCode: string;
  issueLabel: string;
  filterTemplateId: number | null;
};

function parseIssueIdOption(value: string | undefined): bigint | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new Error(`Invalid --issue-id value: "${value}"`);
  }
  return BigInt(normalized);
}

function parseFilterTemplateIdOption(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --filter-template-id value: "${value}"`);
  }
  return Math.trunc(parsed);
}

function parseEditionIdOption(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --edition-id value: "${value}"`);
  }
  return Math.trunc(parsed);
}

function parseSampleSubdirOption(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\\/gu, "/");
  if (!normalized) {
    throw new Error(`Invalid --sample-subdir value: "${value}"`);
  }
  const parts = normalized
    .split("/")
    .filter((part) => part.length > 0 && part !== ".");
  if (!parts.length || parts.some((part) => part === "..")) {
    throw new Error(`Invalid --sample-subdir value: "${value}"`);
  }
  return parts.join("/");
}

function removeOptionsWithValue(args: string[], optionNames: string[]): string[] {
  const names = new Set(optionNames);
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (names.has(arg)) {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) i += 1;
      continue;
    }
    const hasInlineValue = [...names].some((name) => arg.startsWith(`${name}=`));
    if (hasInlineValue) continue;
    out.push(arg);
  }
  return out;
}

function collectSampleFoldersWithFsh(sampleRoot: string): string[] {
  const entries = readdirSync(sampleRoot, { withFileTypes: true });
  const folders: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(sampleRoot, entry.name);
    const hasFsh = readdirSync(dirPath).some((fileName) => extname(fileName).toLowerCase() === ".fsh");
    if (hasFsh) folders.push(entry.name);
  }
  folders.sort((a, b) => a.localeCompare(b, "ru"));
  return folders;
}

function runFillBatchBySampleFolders(folderNames: string[], rawArgs: string[]) {
  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const sanitizedArgs = removeOptionsWithValue(rawArgs, ["--sample-subdir", "--sampleSubdir"]);
  const startedAt = Date.now();
  let succeeded = 0;
  let failed = 0;
  const failedFolders: string[] = [];

  for (const [index, folderName] of folderNames.entries()) {
    const childArgs = [...sanitizedArgs, "--sample-subdir", folderName];
    const childCommand = buildRunCommand(childArgs);
    console.log(`\n📁 sample folder ${index + 1}/${folderNames.length}: ${folderName}`);
    console.log(`команда запуска: "${childCommand}"`);
    const result = spawnSync(pnpmBin, ["run", "fill-batch", "--", ...childArgs], {
      stdio: "inherit",
    });
    const exitCode = result.status ?? 1;
    if (result.error || exitCode !== 0) {
      failed += 1;
      failedFolders.push(folderName);
      const reason = result.error ? result.error.message : `code=${exitCode}`;
      console.error(`❌ folder failed: ${folderName} (${reason})`);
    } else {
      succeeded += 1;
    }
  }

  return {
    total: folderNames.length,
    succeeded,
    failed,
    failedFolders,
    elapsedMs: Date.now() - startedAt,
  };
}

function isEditionWordStatEditionFkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "P2003") return false;
  const meta = (error as { meta?: { constraint?: unknown } }).meta;
  const constraint = meta?.constraint;
  return typeof constraint === "string" && constraint === "edition_word_stat_editionId_fkey";
}

async function assertEditionExists(editionId: number): Promise<void> {
  const prisma = createPrismaClient();
  try {
    const edition = await prisma.editions.findUnique({
      where: { id: editionId },
      select: { id: true },
    });
    if (!edition) {
      throw new Error(
        `Edition ${editionId} not found. Provide a valid --edition-id or use --issue-id linked to an existing edition.`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function loadFilterTemplateById(templateId: number): Promise<{ name: string; template: DictionaryFilterTemplate }> {
  const prisma = createPrismaClient();
  try {
    const templateRows = await prisma.$queryRaw<any[]>`
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
    if (!templateRows.length) {
      throw new Error(`Filter template ${templateId} not found`);
    }

    const row = templateRows[0];
    return {
      name: String(row.name ?? row.id),
      template: {
        language: String(row.language ?? "ru"),
        query: row.query,
        scope: row.scope,
        searchMode: row.searchMode,
        lenFilterField: row.lenFilterField,
        lenMin: row.lenMin,
        lenMax: row.lenMax,
        difficultyMin: row.difficultyMin,
        difficultyMax: row.difficultyMax,
        tagNames: Array.isArray(row.tagNames) ? row.tagNames : [],
        excludeTagNames: Array.isArray(row.excludeTagNames) ? row.excludeTagNames : [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function loadIssueTemplateContext(issueId: bigint): Promise<IssueTemplateContext> {
  const prisma = createPrismaClient();
  try {
    const issueRows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        editionId: number;
        editionCode: string | null;
        issueLabel: string | null;
        filterTemplateId: number | null;
      }>
    >`
      SELECT
        i.id,
        i."editionId" as "editionId",
        e.code as "editionCode",
        n.label as "issueLabel",
        i."filterTemplateId" as "filterTemplateId"
      FROM issues i
      JOIN editions e ON e.id = i."editionId"
      JOIN issue_numbers n ON n.id = i."issueNumberId"
      WHERE i.id = ${issueId}
      LIMIT 1
    `;
    if (!issueRows.length) {
      throw new Error(`Issue ${String(issueId)} not found`);
    }
    const templateId = issueRows[0].filterTemplateId;
    if (templateId === null || templateId === undefined) {
      throw new Error(`Issue ${String(issueId)} has no filter template`);
    }

    const templateRows = await prisma.$queryRaw<any[]>`
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
    if (!templateRows.length) {
      throw new Error(`Filter template ${templateId} for issue ${String(issueId)} not found`);
    }

    const row = templateRows[0];
    return {
      issueId,
      editionCode: String(issueRows[0].editionCode ?? ""),
      issueLabel: String(issueRows[0].issueLabel ?? ""),
      templateId: Number(row.id),
      templateName: String(row.name ?? row.id),
      template: {
        language: String(row.language ?? "ru"),
        query: row.query,
        scope: row.scope,
        searchMode: row.searchMode,
        lenFilterField: row.lenFilterField,
        lenMin: row.lenMin,
        lenMax: row.lenMax,
        difficultyMin: row.difficultyMin,
        difficultyMax: row.difficultyMax,
        tagNames: Array.isArray(row.tagNames) ? row.tagNames : [],
        excludeTagNames: Array.isArray(row.excludeTagNames) ? row.excludeTagNames : [],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function loadIssueContext(issueId: bigint): Promise<IssueContext> {
  const prisma = createPrismaClient();
  try {
    const issueRows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        editionId: number;
        editionCode: string | null;
        issueLabel: string | null;
        filterTemplateId: number | null;
      }>
    >`
      SELECT
        i.id,
        i."editionId" as "editionId",
        e.code as "editionCode",
        n.label as "issueLabel",
        i."filterTemplateId" as "filterTemplateId"
      FROM issues i
      JOIN editions e ON e.id = i."editionId"
      JOIN issue_numbers n ON n.id = i."issueNumberId"
      WHERE i.id = ${issueId}
      LIMIT 1
    `;
    if (!issueRows.length) {
      throw new Error(`Issue ${String(issueId)} not found`);
    }
    return {
      issueId,
      editionId: issueRows[0].editionId,
      editionCode: String(issueRows[0].editionCode ?? ""),
      issueLabel: String(issueRows[0].issueLabel ?? ""),
      filterTemplateId: issueRows[0].filterTemplateId,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function tryLoadIssueContext(issueId: bigint): Promise<IssueContext | null> {
  try {
    return await loadIssueContext(issueId);
  } catch (_err) {
    console.warn(`issue-id ${String(issueId)} not found, running without issue context`);
    return null;
  }
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

function mergeWordUsageCounts(templateWordCounts: Map<string, Map<string, number>>): Map<string, number> {
  const merged = new Map<string, number>();
  for (const counts of templateWordCounts.values()) {
    for (const [word, count] of counts) {
      if (count <= 0) continue;
      merged.set(word, (merged.get(word) ?? 0) + count);
    }
  }
  return merged;
}

async function persistEditionWordStats(
  editionId: number,
  wordUsage: Map<string, number>,
  issueId: bigint | null
): Promise<{ updatedWords: number; skippedWords: number }> {
  if (!wordUsage.size) return { updatedWords: 0, skippedWords: 0 };
  const prisma = createPrismaClient();
  try {
    const words = [...wordUsage.keys()];
    const rows = await prisma.word_v.findMany({
      where: {
        is_deleted: false,
        OR: [
          { word_text_norm: { in: words, mode: "insensitive" as const } },
          { word_text: { in: words, mode: "insensitive" as const } },
        ],
      },
      select: {
        id: true,
        word_text: true,
        word_text_norm: true,
      },
    });

    const wordIdByWord = new Map<string, bigint>();
    for (const row of rows) {
      const normalized = row.word_text_norm?.trim();
      const key = normalizeWordKey(normalized && normalized.length > 0 ? normalized : row.word_text);
      if (!key) continue;
      const existing = wordIdByWord.get(key);
      if (existing === undefined || row.id < existing) {
        wordIdByWord.set(key, row.id);
      }
    }

    let updatedWords = 0;
    let skippedWords = 0;
    const now = new Date();
    try {
      await prisma.$transaction(async (tx) => {
        const edition = await tx.editions.findUnique({
          where: { id: editionId },
          select: { id: true },
        });
        if (!edition) {
          throw new Error(`Cannot persist edition usage stats: edition ${editionId} does not exist.`);
        }

        for (const [word, count] of wordUsage) {
          if (count <= 0) continue;
          const wordId = wordIdByWord.get(word);
          if (!wordId) {
            skippedWords += 1;
            continue;
          }
          updatedWords += 1;
          await tx.edition_word_stat.upsert({
            where: { editionId_wordId: { editionId, wordId } },
            update: {
              useCount: { increment: count },
              lastUsedAt: now,
              ...(issueId !== null ? { lastIssueId: issueId } : {}),
            },
            create: {
              editionId,
              wordId,
              useCount: count,
              lastUsedAt: now,
              ...(issueId !== null ? { lastIssueId: issueId } : {}),
            },
          });
        }
      });
    } catch (error) {
      if (isEditionWordStatEditionFkError(error)) {
        throw new Error(`Cannot persist edition usage stats: edition ${editionId} does not exist.`);
      }
      throw error;
    }

    return { updatedWords, skippedWords };
  } finally {
    await prisma.$disconnect();
  }
}

function formatLenCountsAligned(
  lengths: number[],
  primary: Map<number, number>,
  secondary: Map<number, number>,
  prefix: string
): string {
  const lenWidth = Math.max(1, ...lengths.map((len) => String(len).length));
  const colWidths = lengths.map((len) => {
    const a = primary.get(len) ?? 0;
    const b = secondary.get(len) ?? 0;
    const countWidth = Math.max(String(a).length, String(b).length, 1);
    return lenWidth + 1 + countWidth;
  });
  return (
    prefix +
    lengths
      .map((len, i) => {
        const count = primary.get(len) ?? 0;
        const countWidth = colWidths[i] - lenWidth - 1;
        const lenStr = String(len).padStart(lenWidth, " ");
        const countStr = String(count).padStart(countWidth, " ");
        return `${lenStr}:${countStr}`;
      })
      .join("  ")
  );
}

function formatLenCountsSimple(
  lengths: number[],
  counts: Map<number, number>
): string {
  if (!lengths.length) return "";
  const lenWidth = Math.max(1, ...lengths.map((len) => String(len).length));
  const countWidth = Math.max(1, ...lengths.map((len) => String(counts.get(len) ?? 0).length));
  return lengths
    .map((len) => {
      const count = counts.get(len) ?? 0;
      const lenStr = String(len).padStart(lenWidth, " ");
      const countStr = String(count).padStart(countWidth, " ");
      return `${lenStr}:${countStr}`;
    })
    .join("  ");
}

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

function computePressure(
  lenCounts: Map<number, number>,
  dictCounts: Map<number, number>
): number {
  let pressure = 0;
  for (const [len, need] of lenCounts) {
    const have = dictCounts.get(len) ?? 0;
    if (have <= 0) return Number.POSITIVE_INFINITY;
    pressure += need / have;
  }
  return pressure;
}

function formatComplexity(stats: TemplateStats): string {
  const pressure = stats.pressure ?? 0;
  const pressureStr = Number.isFinite(pressure) ? pressure.toFixed(4) : "inf";
  const densityStr = stats.density.toFixed(2);
  const avgDegStr = stats.avgDegree.toFixed(2);
  return `degMax=${stats.maxDegree} degAvg=${avgDegStr} degSq=${stats.degreeSqSum} press=${pressureStr} slots=${stats.slots} cells=${stats.uniqueCells} cross=${stats.intersections} dens=${densityStr}`;
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

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function extractTemplateNumber(value: string): number | null {
  const match = value.trim().match(/^(\d{1,6})(?=\D|$)/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function resolveSpreadIndex(page: number): number {
  return Math.floor((page - 1) / 2);
}

type BatchEntry = {
  key: string;
  order: number;
  path: string;
  name: string;
  grid: Grid;
  slots: Slot[];
  lenCounts: Map<number, number>;
  stats: TemplateStats;
};

function resolveEntryPageNumber(entry: BatchEntry): number {
  const fromName = extractTemplateNumber(entry.name);
  if (fromName !== null) return fromName;
  return entry.order + 1;
}

function buildEntryNeighbors(entries: BatchEntry[]): Map<string, Set<string>> {
  const spreadByKey = new Map<string, number>();
  const keysBySpread = new Map<number, string[]>();

  for (const entry of entries) {
    const spread = resolveSpreadIndex(resolveEntryPageNumber(entry));
    spreadByKey.set(entry.key, spread);
    const list = keysBySpread.get(spread) ?? [];
    list.push(entry.key);
    keysBySpread.set(spread, list);
  }

  const neighbors = new Map<string, Set<string>>();
  for (const entry of entries) {
    const spread = spreadByKey.get(entry.key);
    if (spread === undefined) continue;
    const set = new Set<string>();
    for (const candidateSpread of [spread - 1, spread, spread + 1]) {
      const keys = keysBySpread.get(candidateSpread);
      if (!keys) continue;
      for (const key of keys) {
        if (key !== entry.key) set.add(key);
      }
    }
    neighbors.set(entry.key, set);
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

function buildInBatchUsagePriority(
  usedWordCount: Map<string, number>,
  basePriority?: Map<string, number>
): Map<string, number> {
  const priority = basePriority ? new Map(basePriority) : new Map<string, number>();
  for (const [word, count] of usedWordCount) {
    if (count <= 0) continue;
    const current = priority.get(word) ?? 0;
    priority.set(word, current + count * IN_BATCH_REPEAT_PRIORITY_MULTIPLIER);
  }
  return priority;
}

type DuplicateUsage = {
  templateKey: string;
  templateName: string;
  count: number;
};

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
) {
  const usageByWord = new Map<string, DuplicateUsage[]>();
  for (const [templateKey, words] of templateWordCounts) {
    const templateName = templateNameByKey.get(templateKey) ?? templateKey;
    for (const [word, count] of words) {
      if (count <= 0) continue;
      const list = usageByWord.get(word) ?? [];
      list.push({ templateKey, templateName, count });
      usageByWord.set(word, list);
    }
  }

  const duplicates = [...usageByWord.entries()]
    .map(([word, usages]) => ({
      word,
      usages: usages.sort((a, b) => a.templateName.localeCompare(b.templateName, "ru")),
      totalUses: usages.reduce((sum, item) => sum + item.count, 0),
      templateCount: usages.length,
    }))
    .filter((item) => item.totalUses > 1)
    .sort((a, b) => {
      if (b.totalUses !== a.totalUses) return b.totalUses - a.totalUses;
      if (b.templateCount !== a.templateCount) return b.templateCount - a.templateCount;
      return a.word.localeCompare(b.word, "ru");
    });

  const duplicateTemplates = new Map<string, Set<string>>();
  for (const item of duplicates) {
    for (const usage of item.usages) {
      const set = duplicateTemplates.get(usage.templateName) ?? new Set<string>();
      set.add(item.word);
      duplicateTemplates.set(usage.templateName, set);
    }
  }

  const duplicateWordCount = duplicates.length;
  const totalRepeatUses = duplicates.reduce((sum, item) => sum + (item.totalUses - 1), 0);
  const templatesWithDuplicates = duplicateTemplates.size;

  return {
    duplicates,
    duplicateWordCount,
    totalRepeatUses,
    templatesWithDuplicates,
    duplicateTemplates,
  };
}

type FailSlot = NonNullable<NonNullable<SolveFailInfo["detail"]>["slot"]>;
type FailColumn = NonNullable<NonNullable<SolveFailInfo["detail"]>["column"]>;

function formatDir(dir: "down" | "right"): string {
  return dir === "down" ? "↓" : "→";
}

function formatSlotRef(slot?: FailSlot): string {
  if (!slot) return "slot=—";
  return `slot#${slot.id} (r=${slot.r} c=${slot.c} ${formatDir(slot.dir)} len=${slot.len})`;
}

function formatFail(info: SolveFailInfo): string {
  switch (info.reason) {
    case "aborted": {
      const limit = info.detail?.limit ?? "limit";
      return `aborted (${limit})`;
    }
    case "forward-check": {
      const patt = info.detail?.pattern ?? "";
      return `forward-check: ${formatSlotRef(info.detail?.slot)} patt=${patt}`;
    }
    case "zero-pick": {
      const col: FailColumn | undefined = info.detail?.column;
      if (col) {
        if (col.type === "slot") {
          return `zero-pick: ${formatSlotRef(col.slot)} candidates=0`;
        }
        if (col.type === "cell") {
          const cell = col.cell;
          if (cell) return `zero-pick: cell r=${cell.r} c=${cell.c} candidates=0`;
          return "zero-pick: cell candidates=0";
        }
        if (col.type === "word") {
          return `zero-pick: word "${col.word ?? ""}" candidates=0`;
        }
        return `zero-pick: column "${col.name}" candidates=0`;
      }
      const patt = info.detail?.pattern ?? "";
      return `zero-pick: ${formatSlotRef(info.detail?.slot)} patt=${patt}`;
    }
    default:
      return "no-solution";
  }
}

function extractFailedSlotLength(info: SolveFailInfo | null): number | null {
  const len = info?.detail?.slot?.len;
  if (typeof len !== "number" || !Number.isFinite(len) || len <= 0) return null;
  return Math.trunc(len);
}

async function waitForNativeFail(timeoutMs = 200): Promise<SolveFailInfo | null> {
  const started = Date.now();
  let info = consumeLastNativeFail();
  while (!info && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    info = consumeLastNativeFail();
  }
  return info;
}

type SolvePhase = "base" | "strict" | "adaptive" | "neighbor" | "rescue";

type SolveCallMetric = {
  phase: SolvePhase;
  template: string;
  parallelUsed: boolean;
  restartsUsed: number;
  elapsedMs: number;
  solved: boolean;
};

const SOLVE_PHASE_ORDER: SolvePhase[] = ["base", "strict", "adaptive", "neighbor", "rescue"];

function formatDurationMs(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
  return sorted[idx];
}

function buildSolverStatsLines(metrics: SolveCallMetric[]): string[] {
  if (metrics.length === 0) {
    return ["📉 solver stats: no solve calls recorded"];
  }

  const total = metrics.length;
  const solvedCount = metrics.filter((item) => item.solved).length;
  const unsolvedCount = total - solvedCount;
  const parallelCount = metrics.filter((item) => item.parallelUsed).length;
  const serialCount = total - parallelCount;
  const elapsedSorted = metrics
    .map((item) => item.elapsedMs)
    .sort((a, b) => a - b);
  const medianMs = percentile(elapsedSorted, 0.5);
  const p95Ms = percentile(elapsedSorted, 0.95);
  const parallelShare = ((parallelCount / total) * 100).toFixed(1);
  const serialShare = ((serialCount / total) * 100).toFixed(1);

  const perPhase = new Map<SolvePhase, { calls: number; solved: number; totalMs: number }>();
  for (const phase of SOLVE_PHASE_ORDER) {
    perPhase.set(phase, { calls: 0, solved: 0, totalMs: 0 });
  }
  for (const metric of metrics) {
    const bucket = perPhase.get(metric.phase);
    if (!bucket) continue;
    bucket.calls += 1;
    if (metric.solved) bucket.solved += 1;
    bucket.totalMs += metric.elapsedMs;
  }
  const phaseSummary = SOLVE_PHASE_ORDER
    .map((phase) => {
      const bucket = perPhase.get(phase);
      if (!bucket || bucket.calls === 0) return `${phase}=0`;
      const avgMs = bucket.totalMs / bucket.calls;
      return `${phase}=${bucket.solved}/${bucket.calls} avg=${formatDurationMs(avgMs)}`;
    })
    .join(" | ");

  const lines = [
    `📉 solver stats: calls=${total} solved=${solvedCount} unsolved=${unsolvedCount} median=${formatDurationMs(medianMs)} p95=${formatDurationMs(p95Ms)} parallel=${parallelShare}% serial=${serialShare}%`,
    `   phases: ${phaseSummary}`,
    "   slow top-10:",
  ];

  const slowCalls = [...metrics]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 10);
  for (const [index, metric] of slowCalls.entries()) {
    lines.push(
      `   ${index + 1}. ${metric.template} phase=${metric.phase} elapsed=${formatDurationMs(metric.elapsedMs)} solved=${metric.solved ? "yes" : "no"} parallel=${metric.parallelUsed ? "yes" : "no"} restarts=${metric.restartsUsed}`
    );
  }

  return lines;
}

/* ---------- CLI ---------- */
const rawCliArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const runCommand = buildRunCommand(rawCliArgs);
const runStartedAt = new Date();
appendRunLogBlock([
  "",
  RUN_LOG_SEPARATOR,
  `[RUN START] ${formatDateLocal(runStartedAt)}`,
  `команда запуска: "${runCommand}"`,
]);

const parsedCli = (() => {
  try {
    return parseArgs({
      args: rawCliArgs,
      options: {
        shuffle: { type: "boolean", short: "s" },
        unique:  { type: "boolean", short: "u" },
        crw:     { type: "boolean", short: "c" },
        progress:{ type: "boolean", short: "p" },
        logMs:   { type: "string" },
        "log-ms":{ type: "string" },
        maxMs:   { type: "string" },
        "max-ms":{ type: "string" },
        maxNodes:{ type: "string" },
        "max-nodes":{ type: "string" },
        lcv:     { type: "boolean" },
        debugDlx:{ type: "boolean" },
        "debug-dlx":{ type: "boolean" },
        nativeDlx:{ type: "boolean" },
        "native-dlx":{ type: "boolean" },
        nativeCsp:{ type: "boolean" },
        "native-csp":{ type: "boolean" },
        engine: { type: "string" },
        parallel: { type: "string" },
        "parallel-restarts": { type: "string" },
        restarts:{ type: "string" },
        issueId: { type: "string" },
        "issue-id": { type: "string" },
        editionId: { type: "string" },
        "edition-id": { type: "string" },
        filterTemplateId: { type: "string" },
        "filter-template-id": { type: "string" },
        dict:    { type: "string",  short: "d" },
        template:{ type: "string",  short: "t" },
        style:   { type: "string" },
        "no-defs": { type: "boolean" },
        "no-clues": { type: "boolean" },
        hardFirst: { type: "boolean" },
        "hard-first": { type: "boolean" },
        keepOrder: { type: "boolean" },
        "keep-order": { type: "boolean" },
        explainFail: { type: "boolean" },
        "explain-fail": { type: "boolean" },
        reportDuplicates: { type: "boolean" },
        "report-duplicates": { type: "boolean" },
        usageRebalance: { type: "boolean" },
        "usage-rebalance": { type: "boolean" },
        usageRebalanceMode: { type: "string" },
        "usage-rebalance-mode": { type: "string" },
        editionHotBan: { type: "boolean" },
        "edition-hot-ban": { type: "boolean" },
        solverStats: { type: "boolean" },
        "solver-stats": { type: "boolean" },
        templateParallel: { type: "string" },
        "template-parallel": { type: "string" },
        sampleSubdir: { type: "string" },
        "sample-subdir": { type: "string" },
      },
    });
  } catch (error) {
    const runFailedAt = new Date();
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const runDurationMin = ((runFailedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
    appendRunLogBlock([
      `[RUN END] ${formatDateLocal(runFailedAt)} status=cli-error duration=${runDurationMin}m`,
      `команда запуска: "${runCommand}"`,
      `ошибка: ${errorMessage}`,
    ]);
    throw error;
  }
})();
const { values } = parsedCli;
const shuffleOpt = values.shuffle === true ? true : undefined;
const unique    = !!values.unique;
const doCrw     = !!values.crw;
const doProgress = !!values.progress;
const progressMinMs = 5000;
const logEveryMsRaw = values.logMs ?? values["log-ms"];
const logEveryMsParsed = logEveryMsRaw !== undefined ? Number(logEveryMsRaw) : NaN;
const logEveryMs = Number.isFinite(logEveryMsParsed) ? logEveryMsParsed : 5000;
const maxMsRaw = values.maxMs
  ? Number(values.maxMs)
  : values["max-ms"] ? Number(values["max-ms"]) : undefined;
const maxNodesRaw = values.maxNodes
  ? Number(values.maxNodes)
  : values["max-nodes"] ? Number(values["max-nodes"]) : undefined;
const maxMs = Number.isFinite(maxMsRaw) ? maxMsRaw : undefined;
const maxNodes = Number.isFinite(maxNodesRaw) ? maxNodesRaw : undefined;
const doLcv = !!values.lcv;
const debugDlx = !!values.debugDlx || !!values["debug-dlx"];
const nativeDlxFlag = !!values.nativeDlx || !!values["native-dlx"];
const nativeCspFlag = !!values.nativeCsp || !!values["native-csp"];
const engineRaw = typeof values.engine === "string" ? values.engine.trim().toLowerCase() : "";
const engineFromValue = engineRaw === "dlx" || engineRaw === "csp" ? engineRaw : "";
const solverEngine: "dlx" | "csp" =
  engineFromValue === "csp" || (!engineFromValue && nativeCspFlag) ? "csp" : "dlx";
if (nativeDlxFlag && nativeCspFlag) {
  console.warn("Both --native-dlx and --native-csp passed; using CSP.");
}
const restartsRaw = values.restarts ? Number(values.restarts) : 1;
const restarts = Number.isFinite(restartsRaw) && restartsRaw > 0 ? Math.floor(restartsRaw) : 1;
const parallelValueRaw = values.parallel ?? values["parallel-restarts"];
const parallelExplicit = parallelValueRaw !== undefined;
const parallelRaw = parallelValueRaw !== undefined ? Number(parallelValueRaw) : undefined;
const configuredParallelRestarts =
  Number.isFinite(parallelRaw) && parallelRaw && parallelRaw > 0 ? Math.floor(parallelRaw) : 1;
const parallelRestarts = resolveParallelRestarts(restarts, parallelRaw, parallelExplicit);
const issueIdRaw = values.issueId ?? values["issue-id"];
const issueId = parseIssueIdOption(issueIdRaw);
const editionIdRaw = values.editionId ?? values["edition-id"];
const editionId = parseEditionIdOption(editionIdRaw);
const sampleSubdirRaw = values.sampleSubdir ?? values["sample-subdir"];
const sampleSubdir = parseSampleSubdirOption(sampleSubdirRaw);
const filterTemplateIdRaw = values.filterTemplateId ?? values["filter-template-id"];
const filterTemplateId = parseFilterTemplateIdOption(filterTemplateIdRaw);
const dictPath  = values.dict ?? "";
const templatePath = values.template ?? "";
const styleName = (values.style ?? "default").toLowerCase();
const hardFirst = !!values.hardFirst || !!values["hard-first"];
const keepOrder = !!values.keepOrder || !!values["keep-order"];
const explainFail = !!values.explainFail || !!values["explain-fail"];
const explainFailLite = explainFail && parallelRestarts > 1;
const reportDuplicates = !!values.reportDuplicates || !!values["report-duplicates"];
const usageRebalance = !!values.usageRebalance || !!values["usage-rebalance"];
const usageRebalanceModeRaw = values.usageRebalanceMode ?? values["usage-rebalance-mode"];
const usageRebalanceMode = parseUsageRebalanceMode(usageRebalanceModeRaw, usageRebalance);
const usageRebalanceCostMode = usageRebalance && usageRebalanceMode === "cost";
const editionHotBan = !!values.editionHotBan || !!values["edition-hot-ban"];
const solverStats = !!values.solverStats || !!values["solver-stats"];
const templateParallelRaw = values.templateParallel ?? values["template-parallel"];
const templateParallelParsed = templateParallelRaw !== undefined ? Number(templateParallelRaw) : NaN;
const templateParallel =
  Number.isFinite(templateParallelParsed) && templateParallelParsed > 1
    ? Math.floor(templateParallelParsed)
    : 1;
const writeDefsJson = !values["no-defs"] && !values["no-clues"];
const useCorelStyle = styleName === "corel";
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}
const CELL = useCorelStyle ? COREL_CELL_SIZE_UNITS : DEFAULT_CELL;
const EMPTY_CELL_FILL = useCorelStyle ? "#FEFEFE" : "#fff";
const STROKE_WIDTH = useCorelStyle ? COREL_STROKE_WIDTH_UNITS : CELL_STROKE_WIDTH;
const SVG_PAD = STROKE_WIDTH / 2;
const GRID_PAD = useCorelStyle ? 0 : SVG_PAD;
const GRID_OFFSET_X = (useCorelStyle ? -CELL / 2 : 0) + GRID_PAD;
const GRID_OFFSET_Y = (useCorelStyle ? -Math.round(CELL * 0.034) : 0) + GRID_PAD;
const WORD_FONT_SIZE = useCorelStyle
  ? Math.round(CELL * 0.565 * 1000) / 1000
  : CELL * 0.6;
const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
const WORD_TEXT_ANCHOR_ATTR = useCorelStyle ? ' text-anchor="start"' : "";
const WORD_TEXT_Y = useCorelStyle ? CELL * 0.7 : CELL / 2;
const SVG_WIDTH = useCorelStyle ? COREL_MIN_SVG_WIDTH_UNITS : 0;
const SVG_HEIGHT = useCorelStyle ? COREL_MIN_SVG_HEIGHT_UNITS : 0;
const SVG_XML_SPACE = useCorelStyle ? ' xml:space="preserve"' : "";
const SVG_STYLE_ATTR = useCorelStyle
  ? ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"'
  : "";
const SVG_PREAMBLE = useCorelStyle
  ? '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
  : "";
const FONT_FAMILY = useCorelStyle ? "Arial" : "monospace";
const DEBUG_CLUSTER_FILL = (() => {
  const raw = process.env.CROSS_ENABLE_02_AREA_EXPANSION;
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  return normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
})();
const DEBUG_CLUSTER_COLOR = "#FFB3B3";

if (!sampleSubdir) {
  const sampleFolders = collectSampleFoldersWithFsh(SAMPLE_DIR);
  if (sampleFolders.length > 0) {
    console.log(`📁 sample folders mode: found=${sampleFolders.length} (one folder = one run)`);
    const batchResult = runFillBatchBySampleFolders(sampleFolders, rawCliArgs);
    const elapsedMin = (batchResult.elapsedMs / 60000).toFixed(1);
    const summaryLine =
      `📁 sample folders processed: ok=${batchResult.succeeded} failed=${batchResult.failed} total=${batchResult.total} time=${elapsedMin}m`;
    console.log(`\n${summaryLine}`);
    if (batchResult.failedFolders.length) {
      console.log(`❌ failed folders: ${batchResult.failedFolders.join(", ")}`);
    }
    const runFinishedAt = new Date();
    const runDurationMin = ((runFinishedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
    appendRunLogBlock([
      `[RUN END] ${formatDateLocal(runFinishedAt)} status=${batchResult.failed > 0 ? "error" : "ok"} duration=${runDurationMin}m`,
      `команда запуска: "${runCommand}"`,
      summaryLine,
      ...(batchResult.failedFolders.length
        ? [`failed folders: ${batchResult.failedFolders.join(", ")}`]
        : []),
    ]);
    process.exit(batchResult.failed > 0 ? 1 : 0);
  }
}

const sampleInputDir = sampleSubdir ? join(SAMPLE_DIR, sampleSubdir) : SAMPLE_DIR;

/* ---------- ищем .fsh ---------- */
let files: string[] = [];
try {
  files = readdirSync(sampleInputDir)
    .filter(f => extname(f).toLowerCase() === ".fsh")
    .map(f => join(sampleInputDir, f));
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error);
  const readDirLine = `Не удалось прочитать входную папку ${sampleInputDir}: ${message}`;
  console.error(readDirLine);
  const runFinishedAt = new Date();
  const runDurationMin = ((runFinishedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
  appendRunLogBlock([
    `[RUN END] ${formatDateLocal(runFinishedAt)} status=error duration=${runDurationMin}m`,
    `команда запуска: "${runCommand}"`,
    readDirLine,
  ]);
  process.exit(1);
}

if (!files.length) {
  const noFilesLine = `Нет *.fsh в ${sampleInputDir}/`;
  console.log(noFilesLine);
  const runFinishedAt = new Date();
  const runDurationMin = ((runFinishedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
  appendRunLogBlock([
    `[RUN END] ${formatDateLocal(runFinishedAt)} status=no-files duration=${runDurationMin}m`,
    `команда запуска: "${runCommand}"`,
    noFilesLine,
  ]);
  process.exit(0);
}


(async () => {
  const batchStartedAt = Date.now();
  let solveTotalMs = 0;
  let solvedCount = 0;
  let failedCount = 0;
  const entries: BatchEntry[] = [];
  const lengthsSet = new Set<number>();

  for (const [order, path] of files.entries()) {
    const name = basename(path, ".fsh");
    try {
      const grid: Grid = parseFsh(path);
      validate(grid);
      const slots = scanSlots(grid);
      const lenCounts = buildLenCounts(slots);
      const stats = analyzeTemplate(slots);
      entries.push({
        key: `${name}#${order}`,
        order,
        path,
        name,
        grid,
        slots,
        lenCounts,
        stats,
      });
      for (const len of lenCounts.keys()) lengthsSet.add(len);
    } catch (e) {
      console.error(`  🛑 ${name}:`, (e as Error).message);
    }
  }

  if (!entries.length) {
    console.log("Нет валидных *.fsh для решения.");
    return;
  }

  /* 1. словарь на весь раунд */
  const lengths = [...lengthsSet];
  let masterDict: Map<number, string[]>;
  const issueContext = issueId !== null ? await tryLoadIssueContext(issueId) : null;
  const effectiveEditionId = editionId ?? issueContext?.editionId ?? null;
  if (effectiveEditionId !== null) {
    await assertEditionExists(effectiveEditionId);
  }
  const editionUsageCountByWord = new Map<string, number>();
  const editionUsagePriorityByWord = new Map<string, number>();
  const editionHotBannedWords = new Set<string>();
  let usageRebalanceThresholds: UsageRebalanceThresholds | null = null;
  let usageRebalanceContext: UsageRebalanceContext | null = null;
  let usageRebalanceReason = "off";
  let editionHotBanReason = "off";
  if (filterTemplateId !== null) {
    const templateData = await loadFilterTemplateById(filterTemplateId);
    masterDict = await loadDictionaryByTemplate(templateData.template, { lengths });
    const issueSuffix = issueContext
      ? ` issueId=${String(issueContext.issueId)} edition=${issueContext.editionCode} issue="${issueContext.issueLabel}" issueTemplateId=${issueContext.filterTemplateId ?? "none"}`
      : "";
    console.log(
      `\n🎯 dictionary source: filter template id (templateId=${filterTemplateId} name="${templateData.name}"${issueSuffix})`
    );
  } else if (issueId !== null) {
    const issueTemplate = await loadIssueTemplateContext(issueId);
    masterDict = await loadDictionaryByTemplate(issueTemplate.template, { lengths });
    console.log(
      `\n🎯 dictionary source: issue filter template (issueId=${String(issueTemplate.issueId)} edition=${issueTemplate.editionCode} issue="${issueTemplate.issueLabel}" templateId=${issueTemplate.templateId} name="${issueTemplate.templateName}")`
    );
  } else {
    masterDict = await loadDictionary({ langCode: "ru", lengths });
  }
  if (effectiveEditionId !== null) {
    const editionUsageSnapshot = await loadEditionUsageSnapshot(masterDict, effectiveEditionId, {
      usageRebalanceEnabled: usageRebalance,
      usageRebalanceMode,
    });
    for (const [word, usage] of editionUsageSnapshot.usageByWord) {
      editionUsageCountByWord.set(word, usage);
    }
    for (const [word, priority] of editionUsageSnapshot.priorityByWord) {
      editionUsagePriorityByWord.set(word, priority);
    }
    if (editionUsagePriorityByWord.size) {
      sortDictionaryByUsagePriority(masterDict, editionUsagePriorityByWord);
    }
    console.log(
      `📈 edition usage stats: editionId=${effectiveEditionId} loadedWords=${editionUsageCountByWord.size}`
    );
  } else {
    console.log("📈 edition usage stats: off (no --edition-id or resolvable issue edition)");
  }
  if (!editionHotBan) {
    editionHotBanReason = "off";
  } else if (effectiveEditionId === null) {
    editionHotBanReason = "skipped (no edition)";
  } else {
    const loadedHotBannedWords = await loadEditionHotBannedWords(effectiveEditionId);
    for (const word of loadedHotBannedWords) {
      editionHotBannedWords.add(word);
    }
    editionHotBanReason = `on (edition=${effectiveEditionId} banned=${editionHotBannedWords.size})`;
    if (!editionUsageCountByWord.size) {
      editionHotBanReason = `${editionHotBanReason} noUsage=1`;
    }
  }
  if (!usageRebalance) {
    usageRebalanceReason = "off";
  } else if (!unique) {
    usageRebalanceReason = "skipped (unique=off)";
  } else if (!editionUsageCountByWord.size) {
    usageRebalanceReason = "skipped (no usage stats)";
  } else {
    usageRebalanceThresholds = resolveUsageRebalanceThresholds(
      masterDict,
      editionUsageCountByWord,
      usageRebalanceMode
    );
    usageRebalanceContext = buildUsageRebalanceContext(
      masterDict,
      editionUsageCountByWord,
      usageRebalanceThresholds
    );
    usageRebalanceReason = usageRebalanceCostMode
      ? `on (mode=cost strategy=hard-lite+soft+cost soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`
      : `on (mode=${usageRebalanceMode} soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold})`;
  }
  const wordLengthByWord = buildWordLengthLookup(masterDict);
  const dictCounts = new Map<number, number>();
  for (const len of lengths) {
    dictCounts.set(len, masterDict.get(len)?.length ?? 0);
  }
  for (const entry of entries) {
    entry.stats.pressure = computePressure(entry.lenCounts, dictCounts);
  }
  const totalSlotCounts = new Map<number, number>();
  for (const entry of entries) {
    for (const slot of entry.slots) {
      totalSlotCounts.set(slot.len, (totalSlotCounts.get(slot.len) ?? 0) + 1);
    }
  }
  const totalSlotLengths = [...totalSlotCounts.keys()].sort((a, b) => a - b);
  const parallelLabel = `${parallelRestarts} (cfg=${configuredParallelRestarts} explicit=${parallelExplicit ? "yes" : "no"}${parallelRestarts > 1 ? " early-stop" : ""})`;
  const nativeAvailable = solverEngine === "csp" ? isNativeCspAvailable() : isNativeDlxAvailable();
  if (!nativeAvailable) {
    throw new Error(
      solverEngine === "csp"
        ? "Native CSP solver is not available (JS solver is disabled)"
        : "Native DLX solver is not available (JS solver is disabled)"
    );
  }
  const engineLabel = `${solverEngine}(native,required)`;
  const prefixNeed = "📚 нужно (все) → ";
  const prefixDict = "📖 словарь → ";
  const prefixPad = " ".repeat(Math.max(0, prefixNeed.length - prefixDict.length));
  console.log(`\n📄 файлов: ${entries.length}`);
  console.log(
    formatLenCountsAligned(totalSlotLengths, totalSlotCounts, dictCounts, prefixNeed)
  );
  console.log(
    formatLenCountsAligned(totalSlotLengths, dictCounts, totalSlotCounts, `${prefixDict}${prefixPad}`)
  );
  const useProgressStdout = doProgress && nativeAvailable && parallelRestarts > 1;
  const progressLabel = doProgress
    ? `on (logMs=${logEveryMs}${useProgressStdout ? " stdout" : ""})`
    : "off";
  const explainFailLabel = explainFail
    ? explainFailLite ? "lite" : "full"
    : "off";
  console.log(
    `⚙ engine=${engineLabel} restarts=${restarts} parallel=${parallelLabel} templateParallel=${templateParallel} progress=${progressLabel} lcv=${doLcv ? "on" : "off"} shuffle=${shuffleOpt ? "on" : "off"} unique=${unique ? "on" : "off"} explainFail=${explainFailLabel} usageRebalance=${usageRebalanceReason} editionHotBan=${editionHotBanReason} solverStats=${solverStats ? "on" : "off"}`
  );
  if (templateParallel > 1 && unique) {
    console.log("🧪 template parallel mode: experimental under --unique (cross-template word pressure may differ run-to-run)");
  }
  if (usageRebalanceThresholds) {
    console.log(
      `🧊 usage rebalance thresholds: mode=${usageRebalanceMode} soft=${usageRebalanceThresholds.softThreshold} hard=${usageRebalanceThresholds.hardThreshold}`
    );
  }
  if (usageRebalanceContext) {
    for (const line of formatUsageBalanceByLen(usageRebalanceContext)) {
      console.log(line);
    }
  }
  const orderMode = hardFirst || (unique && !keepOrder) ? "complex" : "file";
  console.log(`🧭 order=${orderMode === "complex" ? "complexity" : "file"}`);
  if (unique) {
    const deficits = totalSlotLengths
      .map((len) => {
        const need = totalSlotCounts.get(len) ?? 0;
        const have = dictCounts.get(len) ?? 0;
        return need > have ? { len, need, have } : null;
      })
      .filter(Boolean) as Array<{ len: number; need: number; have: number }>;
    if (deficits.length) {
      console.error("⚠ для полностью уникального набора слов словаря недостаточно, будет включен fallback повторов:");
      for (const d of deficits) {
        console.error(`   длина ${d.len}: нужно ${d.need}, в словаре ${d.have}`);
      }
    }
  }

  const orderedEntries =
    orderMode === "complex"
      ? [...entries].sort((a, b) => {
          const cmp = compareByComplexity(a.stats, b.stats);
          if (cmp !== 0) return cmp;
          return a.name.localeCompare(b.name);
        })
      : entries;
  if (orderMode === "complex") {
    console.log("\nСложность шаблонов (hard→easy):");
    for (const entry of orderedEntries) {
      console.log(`  ${entry.name}: ${formatComplexity(entry.stats)}`);
    }
  }

  const entryNeighbors = buildEntryNeighbors(entries);
  const solvedWordsByEntry = new Map<string, Set<string>>();
  const usedWordsInBatch = new Set<string>();
  const usedWordCountInBatch = new Map<string, number>();
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
  const solverStatsMetrics: SolveCallMetric[] = [];
  const templateWordCounts = new Map<string, Map<string, number>>();
  const templateNameByKey = new Map(entries.map((entry) => [entry.key, entry.name]));

  const runEntry = async (entry: BatchEntry): Promise<void> => {
    const { path, name, grid, slots, key } = entry;
    console.log(`\n● ${name} …`);
    const perTemplateCounts = entry.lenCounts;
    const perTemplateLengths = [...perTemplateCounts.keys()].sort((a, b) => a - b);
    console.log(`  нужно → ${formatLenCountsSimple(perTemplateLengths, perTemplateCounts)}`);
    console.log(`  сложность → ${formatComplexity(entry.stats)}`);
    const startedAt = Date.now();
    let failInfo: SolveFailInfo | null = null;
    let nativeActive = false;
    const useFailStdout = explainFail && !explainFailLite && nativeAvailable && parallelRestarts > 1;

    try {
      const logProgress = doProgress;
      const onProgress = logProgress
        ? (info: SolveProgress) => {
          if (nativeActive && useProgressStdout) return;
          if (info.elapsedMs < progressMinMs) return;
          const sec = (info.elapsedMs / 1000).toFixed(1);
          const pick = info.lastPick
            ? `slot=${info.lastPick.id} len=${info.lastPick.len} cand=${info.lastPick.candidates} deg=${info.lastPick.degree} patt=${info.lastPick.pattern}`
            : "slot=—";
          const stats = `rej=I:${info.stats.rejectIntersect} F:${info.stats.rejectForward} Z:${info.stats.zeroPick} bt=${info.stats.backtracks}`;
          console.log(
            `[progress][${info.label ?? "solve"}#${info.attempt}/${info.restarts}] ${sec}s nps=${info.nodesPerSec} nodes=${info.nodes} unfilled=${info.unfilled} depth=${info.depth} ${pick} ${stats}`
          );
        }
        : undefined;

      const solveStartedAt = Date.now();
      const rebalanceLcvPrioritySlack =
        !usageRebalance
          ? 0
          : usageRebalanceMode === "aggressive"
            ? AGGRESSIVE_REBALANCE_LCV_PRIORITY_SLACK
            : usageRebalanceMode === "cost"
              ? COST_REBALANCE_PRIORITY_FIRST_LCV_SLACK
              : 0;
      const onFail = explainFail && !explainFailLite
        ? (info: SolveFailInfo) => {
            failInfo = info;
            if (!(nativeActive && useFailStdout)) {
              console.warn(`  fail → ${formatFail(info)}`);
            }
          }
        : undefined;
      const solveWithDictionary = async (
        dictForSolve: Map<number, string[]>,
        phase: SolvePhase,
        overrides: {
          maxNodes?: number;
          maxMs?: number;
          wordPriority?: Map<string, number>;
          lcv?: boolean;
          shuffle?: boolean;
          lcvPrioritySlack?: number;
        } = {}
      ) => {
        const solveCallStartedAt = Date.now();
        let solveCallResult: string[] | null = null;
        const solveBaseOptions = {
          engine: solverEngine,
          shuffle: overrides.shuffle ?? shuffleOpt,
          lcv: overrides.lcv ?? doLcv,
          lcvPrioritySlack: overrides.lcvPrioritySlack ?? rebalanceLcvPrioritySlack,
          restarts,
          parallelRestarts,
          maxMs: overrides.maxMs ?? maxMs,
          maxNodes: overrides.maxNodes ?? maxNodes,
          label: name,
          debugDlx,
          nativeDlx: true,
          wordPriority:
            overrides.wordPriority ?? (editionUsagePriorityByWord.size ? editionUsagePriorityByWord : undefined),
          onFail,
        };
        const solveOptions = logProgress
          ? { ...solveBaseOptions, logEveryMs, onProgress }
          : solveBaseOptions;
        const useNativeStreaming = (doProgress || (explainFail && !explainFailLite)) && parallelRestarts > 1;
        const nativeOptions = useNativeStreaming
          ? {
            ...solveOptions,
            logEveryMs: logProgress ? logEveryMs : 0,
            progressStdout: useProgressStdout,
            failStdout: useFailStdout,
          }
          : solveOptions;
        nativeActive = useNativeStreaming;
        try {
          const nativeSolved =
            solverEngine === "csp"
              ? await solveCspNativeAsync(grid.data, slots, dictForSolve, nativeOptions)
              : await solveDlxNativeAsync(grid.data, slots, dictForSolve, nativeOptions);
          if (nativeSolved === undefined) {
            throw new Error(
              solverEngine === "csp"
                ? "Native CSP solver is not available (JS solver is disabled)"
                : "Native DLX solver is not available (JS solver is disabled)"
            );
          }
          solveCallResult = nativeSolved;
          return nativeSolved;
        } finally {
          nativeActive = false;
          if (solverStats) {
            solverStatsMetrics.push({
              phase,
              template: name,
              parallelUsed: parallelRestarts > 1,
              restartsUsed: restarts,
              elapsedMs: Date.now() - solveCallStartedAt,
              solved: !!solveCallResult,
            });
          }
        }
      };

      let solved: string[] | null = null;
      const applyEditionHotBan = (baseBlockedWords: Set<string>) => {
        if (!editionHotBan || !editionHotBannedWords.size) {
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
          masterDict,
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
      if (unique) {
        const neighborBlockedWords = new Set<string>();
        const neighbors = entryNeighbors.get(key);
        if (neighbors) {
          for (const neighborKey of neighbors) {
            const used = solvedWordsByEntry.get(neighborKey);
            if (!used) continue;
            for (const word of used) neighborBlockedWords.add(word);
          }
        }

        const strictBlockedWords = new Set<string>(neighborBlockedWords);
        for (const word of usedWordsInBatch) strictBlockedWords.add(word);
        const neighborCappedBlockedWords = buildCappedBlockedWords(
          neighborBlockedWords,
          usedWordCountInBatch,
          MAX_WORD_USES
        );
        const canFallbackToNeighbor = strictBlockedWords.size !== neighborCappedBlockedWords.size;
        const fallbackPriority = buildInBatchUsagePriority(
          usedWordCountInBatch,
          editionUsagePriorityByWord.size ? editionUsagePriorityByWord : undefined
        );
        const buildRebalanceBlockedVariants = (
          baseBlockedWords: Set<string>,
          options: { allowCostHardFirst?: boolean } = {}
        ): RebalanceBlockedVariant[] => {
          if (!usageRebalanceThresholds || !usageRebalanceContext || !editionUsageCountByWord.size) {
            return [{ kind: "base", blockedWords: baseBlockedWords }];
          }
          if (usageRebalanceCostMode) {
            return buildCostHardFirstRebalanceBlockedVariants(
              baseBlockedWords,
              usedWordCountInBatch,
              entry.lenCounts,
              usageRebalanceContext,
              usageRebalanceMetrics,
              { allowHardFirst: options.allowCostHardFirst === true }
            );
          }
          const softOnlyBlockedWords = new Set<string>(baseBlockedWords);
          const softBlockedWords = buildSoftHotDuplicateBlock(
            usedWordCountInBatch,
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
          options: {
            sortByFallbackPriority: boolean;
            strictBudget?: { maxNodes: number; maxMs: number } | null;
          }
        ): Promise<string[] | null> => {
          let appliedStrictBudget = false;
          for (const [index, variant] of variants.entries()) {
            if (index > 0 && variant.kind === "softOnly") {
              usageRebalanceMetrics.hardRetrySoftOnly += 1;
            }
            const filtered = filterDictionaryByBlockedWords(masterDict, variant.blockedWords);
            const dictForSolve = options.sortByFallbackPriority
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
            if (phase === "strict" && options.strictBudget && !appliedStrictBudget) {
              overrides.maxNodes = options.strictBudget.maxNodes;
              overrides.maxMs = options.strictBudget.maxMs;
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
            const solvedVariant = await solveWithDictionary(dictForSolve, phase, overrides);
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
          masterDict,
          strictPrimaryBlockedWords
        );
        let adaptiveDeficitLengths = strictDeficitLengths;
        if (strictDeficitLengths.size === 0) {
          const strictDict = filterDictionaryByBlockedWords(masterDict, strictProbeBlockedWords);
          uniqueFallbackStats.probeAttempted += 1;
          const probeResult =
            solverEngine === "csp"
              ? await (async () => {
                  const budget = resolveProbeBudget(maxNodes, maxMs);
                  let probeFailInfo: SolveFailInfo | null = null;
                  const solvedProbe = await solveCspNativeAsync(grid.data, slots, strictDict, {
                    engine: "csp",
                    nativeDlx: true,
                    shuffle: false,
                    lcv: true,
                    lcvPrioritySlack: rebalanceLcvPrioritySlack,
                    uniqueWords: true,
                    splitComponents: true,
                    restarts: 1,
                    parallelRestarts: 1,
                    maxNodes: budget.maxNodes,
                    maxMs: budget.maxMs,
                    label: `${name}:probe`,
                    wordPriority:
                      editionUsagePriorityByWord.size ? editionUsagePriorityByWord : undefined,
                    onFail: (info) => {
                      probeFailInfo = info;
                    },
                  });
                  if (solvedProbe === undefined) {
                    throw new Error("Native CSP solver is not available (JS solver is disabled)");
                  }
                  return {
                    solved: solvedProbe,
                    outcome: resolveProbeOutcome(solvedProbe, probeFailInfo),
                    failInfo: probeFailInfo,
                  };
                })()
              : runDlxProbe(grid.data, slots, strictDict, {
                  label: `${name}:probe`,
                  maxNodes,
                  maxMs,
                  uniqueWords: true,
                  wordPriority: editionUsagePriorityByWord.size ? editionUsagePriorityByWord : undefined,
                  lcvPrioritySlack: rebalanceLcvPrioritySlack,
                });
          failInfo = probeResult.failInfo ?? failInfo;
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
                masterDict,
                strictPrimaryBlockedWords
              );
            }
            uniqueFallbackStats.strictAttempted += 1;
            const hasFallbackPotential = canFallbackToNeighbor || usedWordsInBatch.size > 0;
            const strictBudget = hasFallbackPotential ? resolveStrictLimitedBudget(maxNodes, maxMs) : null;
            if (strictBudget) uniqueFallbackStats.strictLimited += 1;
            solved = await solveWithBlockedVariants("strict", strictVariants, {
              sortByFallbackPriority: false,
              strictBudget,
            });
            if (solved) {
              uniqueFallbackStats.strictSolved += 1;
            } else {
              const strictFailLen = extractFailedSlotLength(failInfo);
              if (strictFailLen !== null) {
                adaptiveDeficitLengths = new Set<number>([strictFailLen]);
              } else {
                adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                  entry.lenCounts,
                  masterDict,
                  strictPrimaryBlockedWords
                );
              }
            }
          } else {
            uniqueFallbackStats.probeUnknown += 1;
            uniqueFallbackStats.strictAttempted += 1;
            const hasFallbackPotential = canFallbackToNeighbor || usedWordsInBatch.size > 0;
            const strictBudget = hasFallbackPotential ? resolveStrictLimitedBudget(maxNodes, maxMs) : null;
            if (strictBudget) uniqueFallbackStats.strictLimited += 1;
            solved = await solveWithBlockedVariants("strict", strictVariants, {
              sortByFallbackPriority: false,
              strictBudget,
            });
            if (solved) {
              uniqueFallbackStats.strictSolved += 1;
            } else {
              const failLen = extractFailedSlotLength(failInfo);
              if (failLen !== null) {
                adaptiveDeficitLengths = new Set<number>([failLen]);
              } else {
                adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                  entry.lenCounts,
                  masterDict,
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
            usedWordsInBatch,
            usedWordCountInBatch,
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
            if (solved) {
              uniqueFallbackStats.adaptiveSolved += 1;
            }
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
          if (solved) {
            uniqueFallbackStats.neighborSolved += 1;
          }
        }
      } else {
        const nonUniqueHotBan = applyEditionHotBan(new Set<string>());
        const hotBanFilteredDict = filterDictionaryByBlockedWords(masterDict, nonUniqueHotBan.blockedWords);
        const dictForSolve = new Map<number, string[]>(
          [...hotBanFilteredDict].map(([len, words]) => [len, [...words]])
        );
        solved = await solveWithDictionary(dictForSolve, "base");
      }
      if (usageRebalanceCostMode && solved) {
        const polishPriority = buildInBatchUsagePriority(
          usedWordCountInBatch,
          editionUsagePriorityByWord.size ? editionUsagePriorityByWord : undefined
        );
        const polish = polishSolvedRowsByCost({
          solvedRows: solved,
          slots,
          dict: masterDict,
          uniqueWords: unique,
          maxPasses: COST_REBALANCE_POLISH_PASSES,
          priorityByWord: polishPriority,
          usedWordCountByWord: usedWordCountInBatch,
          forbiddenWords: unique ? usedWordsInBatch : undefined,
          repeatPenalty: IN_BATCH_REPEAT_PRIORITY_MULTIPLIER,
        });
        usageCostMetrics.examinedCandidates += polish.examinedCandidates;
        if (polish.improved) {
          solved = polish.solvedRows;
          usageCostMetrics.templatesPolished += 1;
          usageCostMetrics.replacements += polish.replacements;
          usageCostMetrics.totalDeltaCost += polish.totalDeltaCost;
          console.log(
            `🧪 cost-polish: passes=${polish.passCount} replacements=${polish.replacements} delta=${polish.totalDeltaCost.toFixed(1)}`
          );
        }
      }
      const solveMs = Date.now() - solveStartedAt;
      solveTotalMs += solveMs;
      if (!solved) {
        if (explainFail && !explainFailLite && !failInfo) {
          failInfo = await waitForNativeFail();
        }
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        const solveSec = (solveMs / 1000).toFixed(2);
        console.warn(`  ⚠ недостаточно слов (time=${elapsedSec}s solve=${solveSec}s)`);
        if (explainFail) {
          if (explainFailLite) {
            console.warn("  причина → no-solution (lite)");
          } else if (failInfo) {
            console.warn(`  причина → ${formatFail(failInfo)}`);
          }
        }
        failedCount += 1;
        return;
      }

      if (unique) {
        const usedHere = new Set<string>();
        for (const slot of slots) {
          const word = slot.cells.map(([r, c]) => solved[r][c]).join("");
          const normalized = normalizeWordKey(word);
          if (!normalized) continue;
          usedHere.add(normalized);
          usedWordsInBatch.add(normalized);
          usedWordCountInBatch.set(normalized, (usedWordCountInBatch.get(normalized) ?? 0) + 1);
        }
        solvedWordsByEntry.set(key, usedHere);
      }

      /* 5. SVG */
      const { rows: ROWS, cols: COLS } = grid;
      const usedWordsList = slots.map((s) =>
        s.cells.map(([r, c]) => solved[r][c]).join("")
      );
      templateWordCounts.set(key, collectWordCounts(usedWordsList));
      const usedWords = usedWordsList.join("\n");
      const definitions = await loadDefinitions(usedWordsList, { langCode: "ru" });
      const clues = buildClueEntries(grid, slots, solved, definitions);
      const clueLayouts = buildClueLayouts(grid, slots, solved, definitions);
      const clueTextMap = buildClueTextMap(clueLayouts);
      const debugClusterCells = new Set<string>();
      if (DEBUG_CLUSTER_FILL) {
        for (const layout of clueLayouts) {
          const cells = layout.clusterCells?.length ? layout.clusterCells : layout.areaCells;
          if (cells.length <= 1) continue;
          for (const [row, col] of cells) {
            debugClusterCells.add(`${row},${col}`);
          }
        }
      }

      const gridWidth = COLS * CELL;
      const gridHeight = ROWS * CELL;
      const contentWidth = gridWidth + SVG_PAD * 2;
      const contentHeight = gridHeight + SVG_PAD * 2;
      const svgWidth = useCorelStyle ? Math.max(SVG_WIDTH, contentWidth) : contentWidth;
      const svgHeight = useCorelStyle ? Math.max(SVG_HEIGHT, contentHeight) : contentHeight;
      const svgWidthAttr = useCorelStyle ? formatCorelSizeMm(svgWidth) : String(svgWidth);
      const svgHeightAttr = useCorelStyle ? formatCorelSizeMm(svgHeight) : String(svgHeight);
      const svgViewBox = useCorelStyle
        ? ` viewBox="${GRID_OFFSET_X - SVG_PAD} ${GRID_OFFSET_Y - SVG_PAD} ${svgWidth} ${svgHeight}"`
        : "";
      const svgParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
      ];
      const svgRawParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
      ];
      const clueDefs: string[] = [];
      const clueLayer: string[] = [];
      const clueRawLayer: string[] = [];
      const borderLayer: string[] = [];
      const borderRawLayer: string[] = [];
      const clueMode = useCorelStyle ? "corel" : "default";
      const clueFont = Math.max(resolveMinClueFontSize(clueMode), Math.floor(CELL * 0.22));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = GRID_OFFSET_X + c * CELL, y = GRID_OFFSET_Y + r * CELL;
          const ch = solved[r][c] as Cell;
          const orig = grid.data[r][c] as Cell;
          const code = grid.codes[r][c];
          const clueKey = `${r},${c}`;
          const clueLayout = clueTextMap.get(clueKey);

          if (ch === "#") {
            const blockFill = debugClusterCells.has(clueKey) ? DEBUG_CLUSTER_COLOR : BLOCK_CELL_FILL;
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${blockFill}"/>`;
            svgParts.push(rect);
            svgRawParts.push(rect);
            if (clueLayout?.text) {
              const clipId = `clue-${r}-${c}`;
              const clueSvg = renderClueText(
                x,
                y,
                CELL,
                clueFont,
                clueLayout.text,
                clipId,
                CLUE_TEXT_FILL,
                {
                  mode: clueMode,
                  areaCells: clueLayout.areaCells,
                  anchorCell: [r, c],
                  textAlign: clueLayout.areaCells.length > 1 ? "bottom-left" : "center",
                  background: clueLayout.areaCells.length > 1 ? "text-block" : "none",
                  backgroundInset: clueLayout.areaCells.length > 1 ? STROKE_WIDTH : 0,
                }
              );
              if (clueSvg.defs) {
                clueDefs.push(clueSvg.defs);
              }
              clueLayer.push(clueSvg.text);
              clueRawLayer.push(clueSvg.text);
            }
            const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
            borderLayer.push(border);
            borderRawLayer.push(border);
          } else {
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${EMPTY_CELL_FILL}"/>`;
            svgParts.push(rect);
            svgRawParts.push(rect);
            const arrow = arrowSvg("batch", code, orig, x, y, CELL, CELL * 0.6);
            if (arrow) {
              svgParts.push(arrow);
              svgRawParts.push(arrow);
            }
            const wordTextX = useCorelStyle
              ? resolveCenteredTextStartX(x, CELL, ch, WORD_FONT_SIZE)
              : x + CELL / 2;
            svgParts.push(
              `<text x="${wordTextX}" y="${y + WORD_TEXT_Y}" font-size="${WORD_FONT_SIZE}" fill="${WORD_TEXT_FILL}"${WORD_TEXT_ANCHOR_ATTR}${WORD_FONT_WEIGHT_ATTR}${WORD_BASELINE_ATTR}>${ch}</text>`
            );
            const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
            borderLayer.push(border);
            borderRawLayer.push(border);
          }
        }
      }
      svgParts.push(...borderLayer, ...clueLayer);
      svgRawParts.push(...borderRawLayer, ...clueRawLayer);
      if (clueDefs.length) {
        svgParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
        svgRawParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
      }
      svgParts.push("</svg>");
      svgRawParts.push("</svg>");

      const svg = svgParts.join("");
      const svgRaw = svgRawParts.join("");
      const svgAnswers = buildAnswersOnlySvg(grid, solved);

      /* 6. write */
      const dstDir = join(OUT_DIR, name);
      mkdirSync(dstDir, { recursive: true });
      writeFileSync(join(dstDir, "crossword.svg"), svg);
      writeFileSync(join(dstDir, "crossword-no-text.svg"), svgRaw);
      writeFileSync(join(dstDir, "crossword-answers.svg"), svgAnswers);
      writeFileSync(join(dstDir, "used-words.txt"), usedWords);
      if (writeDefsJson) {
        writeFileSync(join(dstDir, "definitions-down.json"), JSON.stringify(clues.down, null, 2));
        writeFileSync(join(dstDir, "definitions-right.json"), JSON.stringify(clues.right, null, 2));
      }

      if (doCrw) {
        const crw = buildCrw(grid, slots, solved, {
          dictPath,
          templatePath: templatePath || path,
          lowerCaseWords: true,
        });
        const crwOut = join(dstDir, `${name}.crw`);
        writeFileSync(crwOut, crw);
      }

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const solveSec = (solveMs / 1000).toFixed(2);
      console.log(`  ✔ готово → ${dstDir} (time=${elapsedSec}s solve=${solveSec}s)`);
      solvedCount += 1;
    } catch (e) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.error("  🛑", (e as Error).message);
      console.error(`  time=${elapsedSec}s`);
      failedCount += 1;
    }
  };

  const pickWaveEntries = (
    pending: BatchEntry[],
    maxWaveSize: number
  ): BatchEntry[] => {
    const wave: BatchEntry[] = [];
    const blocked = new Set<string>();
    for (const entry of pending) {
      if (wave.length >= maxWaveSize) break;
      if (blocked.has(entry.key)) continue;
      wave.push(entry);
      blocked.add(entry.key);
      const neighbors = entryNeighbors.get(entry.key);
      if (!neighbors) continue;
      for (const neighborKey of neighbors) blocked.add(neighborKey);
    }
    return wave;
  };

  if (templateParallel > 1) {
    const pending = [...orderedEntries];
    while (pending.length > 0) {
      const wave = pickWaveEntries(pending, templateParallel);
      if (!wave.length) {
        // Safety fallback; should not happen, but guarantees progress.
        wave.push(pending[0]);
      }
      const waveKeys = new Set(wave.map((entry) => entry.key));
      for (let i = pending.length - 1; i >= 0; i--) {
        if (waveKeys.has(pending[i].key)) pending.splice(i, 1);
      }
      console.log(`\n🧵 wave size=${wave.length} remaining=${pending.length}`);
      await Promise.all(wave.map((entry) => runEntry(entry)));
    }
  } else {
    for (const entry of orderedEntries) {
      await runEntry(entry);
    }
  }

  let editionUsageLine: string | null = null;
  let editionHotBanStateLine: string | null = null;
  if (effectiveEditionId !== null && solvedCount > 0) {
    const batchWordUsage = mergeWordUsageCounts(templateWordCounts);
    const persisted = await persistEditionWordStats(effectiveEditionId, batchWordUsage, issueContext?.issueId ?? null);
    editionUsageLine =
      `📈 edition usage stats updated: editionId=${effectiveEditionId} words=${persisted.updatedWords} skipped=${persisted.skippedWords}`;
    console.log(editionUsageLine);
    if (editionHotBan) {
      const hotState = await recomputeEditionHotBanState(effectiveEditionId);
      editionHotBanStateLine =
        `🔥 hot-ban state updated: editionId=${effectiveEditionId} tracked=${hotState.trackedWords} banned=${hotState.bannedWords} +${hotState.becameBanned} -${hotState.becameUnbanned}`;
      console.log(editionHotBanStateLine);
    }
  }

  const totalMin = ((Date.now() - batchStartedAt) / 60000).toFixed(1);
  const solveMin = (solveTotalMs / 60000).toFixed(1);
  const totalLine = `Итог: успешно заполнены ${solvedCount}, не удалось ${failedCount} (всего ${entries.length})`;
  const doneLine = `Все файлы обработаны. time=${totalMin}m solve=${solveMin}m`;
  console.log(totalLine);
  console.log(`\n${doneLine}`);
  let uniqueLine: string | null = null;
  if (unique) {
    uniqueLine =
      `🔁 unique fallback: probeAttempted=${uniqueFallbackStats.probeAttempted} probeSolved=${uniqueFallbackStats.probeSolved} probeUnsat=${uniqueFallbackStats.probeUnsat} probeUnknown=${uniqueFallbackStats.probeUnknown} strict=${uniqueFallbackStats.strictSolved}/${uniqueFallbackStats.strictAttempted} strictLimited=${uniqueFallbackStats.strictLimited} skippedByDeficit=${uniqueFallbackStats.strictSkippedByDeficit} adaptive=${uniqueFallbackStats.adaptiveSolved}/${uniqueFallbackStats.adaptiveAttempted} neighbor=${uniqueFallbackStats.neighborSolved}/${uniqueFallbackStats.neighborAttempted}`
    console.log(uniqueLine);
  }
  let usageRebalanceLine: string | null = null;
  let usageRebalanceByLenLine: string | null = null;
  let usageCostLine: string | null = null;
  if (usageRebalance) {
    usageRebalanceLine = `🧊 ${formatUsageRebalanceMetrics(usageRebalanceMetrics)}`;
    usageRebalanceByLenLine = `🧊 ${formatUsageRebalanceLenMetrics(usageRebalanceMetrics)}`;
    console.log(usageRebalanceLine);
    console.log(usageRebalanceByLenLine);
    if (usageRebalanceCostMode) {
      usageCostLine =
        `🧪 cost-rebalance: strategy=hard-lite+soft+cost polished=${usageCostMetrics.templatesPolished} replacements=${usageCostMetrics.replacements} delta=${usageCostMetrics.totalDeltaCost.toFixed(1)} examined=${usageCostMetrics.examinedCandidates}`;
      console.log(usageCostLine);
    }
  }
  let editionHotBanLine: string | null = null;
  let editionHotBanByLenLine: string | null = null;
  if (editionHotBan) {
    editionHotBanLine =
      `🔥 hot-ban: loaded=${editionHotBanMetrics.loaded} applied=${editionHotBanMetrics.applied} relaxed=${editionHotBanMetrics.relaxed}`;
    editionHotBanByLenLine =
      `🔥 hot-ban-by-len: relaxed=${formatLenCounter(editionHotBanMetrics.relaxedByLen)} unresolved=${formatLenCounter(editionHotBanMetrics.unresolvedByLen)}`;
    console.log(editionHotBanLine);
    console.log(editionHotBanByLenLine);
  }
  let solverStatsLines: string[] = [];
  if (solverStats) {
    solverStatsLines = buildSolverStatsLines(solverStatsMetrics);
    for (const line of solverStatsLines) {
      console.log(line);
    }
  }

  let duplicatesHeaderLine: string | null = null;
  let duplicatesSummaryLine: string | null = null;
  if (reportDuplicates) {
    const report = buildDuplicateReport(templateWordCounts, templateNameByKey);
    duplicatesHeaderLine = "📊 отчёт по дублям слов";
    duplicatesSummaryLine =
      `  слов-дублей=${report.duplicateWordCount} повторных использований=${report.totalRepeatUses} шаблонов-с-дублями=${report.templatesWithDuplicates}`;
    console.log(`\n${duplicatesHeaderLine}`);
    console.log(duplicatesSummaryLine);
  }

  const runFinishedAt = new Date();
  const runDurationMin = ((runFinishedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
  appendRunLogBlock([
    `[RUN END] ${formatDateLocal(runFinishedAt)} status=ok duration=${runDurationMin}m`,
    `команда запуска: "${runCommand}"`,
    ...(editionUsageLine ? [editionUsageLine] : []),
    ...(editionHotBanStateLine ? [editionHotBanStateLine] : []),
    totalLine,
    doneLine,
    ...(uniqueLine ? [uniqueLine] : []),
    ...(usageRebalanceLine ? [usageRebalanceLine] : []),
    ...(usageRebalanceByLenLine ? [usageRebalanceByLenLine] : []),
    ...(usageCostLine ? [usageCostLine] : []),
    ...(editionHotBanLine ? [editionHotBanLine] : []),
    ...(editionHotBanByLenLine ? [editionHotBanByLenLine] : []),
    ...(solverStats ? solverStatsLines : []),
    ...(duplicatesHeaderLine ? [duplicatesHeaderLine] : []),
    ...(duplicatesSummaryLine ? [duplicatesSummaryLine] : []),
  ]);
})().catch((error: unknown) => {
  const runFailedAt = new Date();
  const runDurationMin = ((runFailedAt.getTime() - runStartedAt.getTime()) / 60000).toFixed(1);
  const errorMessage = error instanceof Error
    ? error.stack ?? error.message
    : String(error);
  appendRunLogBlock([
    `[RUN END] ${formatDateLocal(runFailedAt)} status=error duration=${runDurationMin}m`,
    `команда запуска: "${runCommand}"`,
    `ошибка: ${errorMessage}`,
  ]);
  throw error;
});
