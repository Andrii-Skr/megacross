
//  • читает ВСЕ *.fsh в sample/
//  • решает каждый кроссворд (shuffle optional)
//  • флаг -u / --unique  → максимум уникальных слов, но с fallback-повторами
//    (повторы запрещены внутри шаблона и в соседних шаблонах одного/соседних разворотов)
//  • флаг --report-duplicates → отчёт по дублям слов в конце
//  • сохраняет SVG + used-words.txt в out/<basename>/
//------------------------------------------------------------------
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename, extname }               from "node:path";
import os                                        from "node:os";
import { parseArgs }                             from "node:util";
import { PrismaClient }                          from "@prisma/client";

import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import type { SolveFailInfo, SolveProgress } from "../src/utils/solver";
import { consumeLastNativeFail, isNativeDlxAvailable, solveDlxNativeAsync } from "../src/utils/nativeDlx";
import {
  loadDictionary,
  loadDictionaryByTemplate,
  loadDefinitions,
  type DictionaryFilterTemplate,
} from "../src/services/dictionary";
import { buildCrw }            from "../src/utils/writeCrw";
import { buildClueEntries }    from "../src/utils/clues";
import { Cell, Grid, Slot }    from "../src/types";
import { arrowSvg }            from "./arrow-utils";
import { buildClueTextMap, renderClueText } from "./clue-svg";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  WORD_TEXT_FILL,
} from "./svg-theme";

const DEFAULT_CELL       = 30;        // px
const SAMPLE_DIR = "sample";
const OUT_DIR    = "out";
const IN_BATCH_REPEAT_PRIORITY_MULTIPLIER = 1_000_000_000;
const MAX_WORD_USES = 2;

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

type WordPriorityRow = {
  word: string | null;
  useCount: number | bigint | null;
};

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

async function loadFilterTemplateById(templateId: number): Promise<{ name: string; template: DictionaryFilterTemplate }> {
  const prisma = new PrismaClient();
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
  const prisma = new PrismaClient();
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
  const prisma = new PrismaClient();
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

function toNumber(value: number | bigint | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  return 0;
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

async function loadEditionUsagePriority(editionId: number): Promise<Map<string, number>> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<WordPriorityRow[]>`
      SELECT
        UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
        SUM(ews."useCount")::int AS "useCount"
      FROM edition_word_stat ews
      JOIN word_v w ON w.id = ews."wordId"
      WHERE ews."editionId" = ${editionId}
      GROUP BY 1
    `;
    const priority = new Map<string, number>();
    for (const row of rows) {
      if (!row.word) continue;
      priority.set(normalizeWordKey(row.word), toNumber(row.useCount));
    }
    return priority;
  } finally {
    await prisma.$disconnect();
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
  const prisma = new PrismaClient();
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
    await prisma.$transaction(async (tx) => {
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

/* ---------- CLI ---------- */
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
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
  },
});
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
const nativeDlx = true;
const restartsRaw = values.restarts ? Number(values.restarts) : 1;
const restarts = Number.isFinite(restartsRaw) && restartsRaw > 0 ? Math.floor(restartsRaw) : 1;
const parallelRaw = values.parallel
  ? Number(values.parallel)
  : values["parallel-restarts"] ? Number(values["parallel-restarts"]) : undefined;
const configuredParallelRestarts =
  Number.isFinite(parallelRaw) && parallelRaw && parallelRaw > 0 ? Math.floor(parallelRaw) : 1;
const parallelRestarts = resolveParallelRestarts(restarts, configuredParallelRestarts);
const issueIdRaw = values.issueId ?? values["issue-id"];
const issueId = parseIssueIdOption(issueIdRaw);
const editionIdRaw = values.editionId ?? values["edition-id"];
const editionId = parseEditionIdOption(editionIdRaw);
const filterTemplateIdRaw = values.filterTemplateId ?? values["filter-template-id"];
const filterTemplateId = parseFilterTemplateIdOption(filterTemplateIdRaw);
const dictPath  = values.dict ?? "";
const templatePath = values.template ?? "";
const styleName = (values.style ?? "default").toLowerCase();
const hardFirst = !!values.hardFirst || !!values["hard-first"];
const keepOrder = !!values.keepOrder || !!values["keep-order"];
const explainFail = !!values.explainFail || !!values["explain-fail"];
const reportDuplicates = !!values.reportDuplicates || !!values["report-duplicates"];
const writeDefsJson = !values["no-defs"] && !values["no-clues"];
const useCorelStyle = styleName === "corel";
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}
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

/* ---------- ищем .fsh ---------- */
const files = readdirSync(SAMPLE_DIR)
  .filter(f => extname(f).toLowerCase() === ".fsh")
  .map(f => join(SAMPLE_DIR, f));

if (!files.length) {
  console.log("Нет *.fsh в sample/");
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
  const editionUsagePriorityByWord = new Map<string, number>();
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
    const loadedPriority = await loadEditionUsagePriority(effectiveEditionId);
    for (const [word, priority] of loadedPriority) {
      editionUsagePriorityByWord.set(word, priority);
    }
    sortDictionaryByUsagePriority(masterDict, editionUsagePriorityByWord);
    console.log(
      `📈 edition usage stats: editionId=${effectiveEditionId} loadedWords=${editionUsagePriorityByWord.size}`
    );
  } else {
    console.log("📈 edition usage stats: off (no --edition-id or resolvable issue edition)");
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
  const cpuParallel = detectCpuParallelism();
  const parallelLabel =
    parallelRestarts > 1
      ? `${parallelRestarts} (cfg=${configuredParallelRestarts} cpu=${cpuParallel} early-stop)`
      : "1";
  const nativeAvailable = isNativeDlxAvailable();
  if (!nativeAvailable) {
    throw new Error("Native DLX solver is not available (JS solver is disabled)");
  }
  const engineLabel = "dlx(native,required)";
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
  console.log(
    `⚙ engine=${engineLabel} restarts=${restarts} parallel=${parallelLabel} progress=${progressLabel} lcv=${doLcv ? "on" : "off"} shuffle=${shuffleOpt ? "on" : "off"} unique=${unique ? "on" : "off"} explainFail=${explainFail ? "on" : "off"}`
  );
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
    strictAttempted: 0,
    strictLimited: 0,
    strictSkippedByDeficit: 0,
    strictSolved: 0,
    adaptiveAttempted: 0,
    adaptiveSolved: 0,
    neighborAttempted: 0,
    neighborSolved: 0,
  };
  const templateWordCounts = new Map<string, Map<string, number>>();
  const templateNameByKey = new Map(entries.map((entry) => [entry.key, entry.name]));

  for (const entry of orderedEntries) {
    const { path, name, grid, slots, key } = entry;
    console.log(`\n● ${name} …`);
    const perTemplateCounts = entry.lenCounts;
    const perTemplateLengths = [...perTemplateCounts.keys()].sort((a, b) => a - b);
    console.log(`  нужно → ${formatLenCountsSimple(perTemplateLengths, perTemplateCounts)}`);
    console.log(`  сложность → ${formatComplexity(entry.stats)}`);
    const startedAt = Date.now();
    let failInfo: SolveFailInfo | null = null;
    let nativeActive = false;
    const useFailStdout = explainFail && nativeAvailable && parallelRestarts > 1;

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
      const onFail = explainFail
        ? (info: SolveFailInfo) => {
            failInfo = info;
            if (!(nativeActive && useFailStdout)) {
              console.warn(`  fail → ${formatFail(info)}`);
            }
          }
        : undefined;
      const solveWithDictionary = async (
        dictForSolve: Map<number, string[]>,
        overrides: {
          maxNodes?: number;
          maxMs?: number;
          wordPriority?: Map<string, number>;
          lcv?: boolean;
        } = {}
      ) => {
        const solveBaseOptions = {
          shuffle: shuffleOpt,
          lcv: overrides.lcv ?? doLcv,
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
        const nativeOptions = (doProgress || explainFail) && parallelRestarts > 1
          ? {
            ...solveOptions,
            logEveryMs: logProgress ? logEveryMs : 0,
            progressStdout: useProgressStdout,
            failStdout: useFailStdout,
          }
          : solveOptions;
        nativeActive = (doProgress || explainFail) && parallelRestarts > 1;
        try {
          const nativeSolved = await solveDlxNativeAsync(grid.data, slots, dictForSolve, nativeOptions);
          if (nativeSolved === undefined) {
            throw new Error("Native DLX solver is not available (JS solver is disabled)");
          }
          return nativeSolved;
        } finally {
          nativeActive = false;
        }
      };

      let solved: string[] | null = null;
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
        const strictDeficitLengths = collectLengthDeficitsForBlockedWords(
          entry.lenCounts,
          masterDict,
          strictBlockedWords
        );
        let adaptiveDeficitLengths = strictDeficitLengths;
        if (strictDeficitLengths.size === 0) {
          uniqueFallbackStats.strictAttempted += 1;
          solved = await solveWithDictionary(filterDictionaryByBlockedWords(masterDict, strictBlockedWords));
          if (solved) {
            uniqueFallbackStats.strictSolved += 1;
          }
          if (!solved) {
            const failLen = extractFailedSlotLength(failInfo);
            if (failLen !== null) {
              adaptiveDeficitLengths = new Set<number>([failLen]);
            } else {
              adaptiveDeficitLengths = collectMostConstrainedLengthsForBlockedWords(
                entry.lenCounts,
                masterDict,
                strictBlockedWords
              );
            }
          }
        } else {
          uniqueFallbackStats.strictSkippedByDeficit += 1;
        }
        if (!solved && adaptiveDeficitLengths.size > 0) {
          const adaptiveBlockedWords = buildAdaptiveBlockedWords(
            usedWordsInBatch,
            usedWordCountInBatch,
            neighborBlockedWords,
            adaptiveDeficitLengths,
            wordLengthByWord,
            MAX_WORD_USES
          );
          if (adaptiveBlockedWords.size !== strictBlockedWords.size) {
            uniqueFallbackStats.adaptiveAttempted += 1;
            solved = await solveWithDictionary(
              filterDictionaryByBlockedWords(masterDict, adaptiveBlockedWords),
              {
                wordPriority: fallbackPriority,
                lcv: false,
              }
            );
            if (solved) {
              uniqueFallbackStats.adaptiveSolved += 1;
            }
          }
        }
        if (!solved && canFallbackToNeighbor) {
          uniqueFallbackStats.neighborAttempted += 1;
          solved = await solveWithDictionary(
            filterDictionaryByBlockedWords(masterDict, neighborCappedBlockedWords),
            {
              wordPriority: fallbackPriority,
              lcv: false,
            }
          );
          if (solved) {
            uniqueFallbackStats.neighborSolved += 1;
          }
        }
      } else {
        const dict = new Map<number, string[]>([...masterDict].map(([len, words]) => [len, [...words]]));
        solved = await solveWithDictionary(dict);
      }
      const solveMs = Date.now() - solveStartedAt;
      solveTotalMs += solveMs;
      if (!solved) {
        if (explainFail && !failInfo && nativeDlx) {
          failInfo = await waitForNativeFail();
        }
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        const solveSec = (solveMs / 1000).toFixed(2);
        console.warn(`  ⚠ недостаточно слов (time=${elapsedSec}s solve=${solveSec}s)`);
        if (explainFail && failInfo) {
          console.warn(`  причина → ${formatFail(failInfo)}`);
        }
        failedCount += 1;
        continue;
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
      const clueTextMap = buildClueTextMap([...clues.down, ...clues.right]);

      const gridWidth = COLS * CELL;
      const gridHeight = ROWS * CELL;
      const svgWidth = useCorelStyle ? SVG_WIDTH : gridWidth + SVG_PAD * 2;
      const svgHeight = useCorelStyle ? SVG_HEIGHT : gridHeight + SVG_PAD * 2;
      const svgViewBox = useCorelStyle
        ? ` viewBox="${GRID_OFFSET_X - SVG_PAD} ${GRID_OFFSET_Y - SVG_PAD} ${Math.max(SVG_WIDTH, gridWidth + SVG_PAD * 2)} ${Math.max(SVG_HEIGHT, gridHeight + SVG_PAD * 2)}"`
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
          const x = GRID_OFFSET_X + c * CELL, y = GRID_OFFSET_Y + r * CELL;
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
              const clueSvg = renderClueText(
                x,
                y,
                CELL,
                clueFont,
                clueText,
                clipId,
                CLUE_TEXT_FILL,
                { mode: useCorelStyle ? "corel" : "default" }
              );
              if (clueSvg.defs) {
                clueDefs.push(clueSvg.defs);
              }
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

      const svg = svgParts.join("");
      const svgRaw = svgRawParts.join("");

      /* 6. write */
      const dstDir = join(OUT_DIR, name);
      mkdirSync(dstDir, { recursive: true });
      writeFileSync(join(dstDir, "crossword.svg"), svg);
      writeFileSync(join(dstDir, "crossword-no-text.svg"), svgRaw);
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
  }

  if (effectiveEditionId !== null && solvedCount > 0) {
    const batchWordUsage = mergeWordUsageCounts(templateWordCounts);
    const persisted = await persistEditionWordStats(effectiveEditionId, batchWordUsage, issueContext?.issueId ?? null);
    console.log(
      `📈 edition usage stats updated: editionId=${effectiveEditionId} words=${persisted.updatedWords} skipped=${persisted.skippedWords}`
    );
  }

  const totalMin = ((Date.now() - batchStartedAt) / 60000).toFixed(1);
  const solveMin = (solveTotalMs / 60000).toFixed(1);
  console.log(
    `Итог: успешно заполнены ${solvedCount}, не удалось ${failedCount} (всего ${entries.length})`
  );
  console.log(`\nВсе файлы обработаны. time=${totalMin}m solve=${solveMin}m`);
  if (unique) {
    console.log(
      `🔁 unique fallback: strict=${uniqueFallbackStats.strictSolved}/${uniqueFallbackStats.strictAttempted} strictLimited=${uniqueFallbackStats.strictLimited} skippedByDeficit=${uniqueFallbackStats.strictSkippedByDeficit} adaptive=${uniqueFallbackStats.adaptiveSolved}/${uniqueFallbackStats.adaptiveAttempted} neighbor=${uniqueFallbackStats.neighborSolved}/${uniqueFallbackStats.neighborAttempted}`
    );
  }

  if (reportDuplicates) {
    const report = buildDuplicateReport(templateWordCounts, templateNameByKey);
    console.log("\n📊 отчёт по дублям слов");
    console.log(
      `  слов-дублей=${report.duplicateWordCount} повторных использований=${report.totalRepeatUses} шаблонов-с-дублями=${report.templatesWithDuplicates}`
    );
  }
})();
