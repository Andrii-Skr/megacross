import archiver from "archiver";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildClueEntries } from "../utils/clues";
import { parseFsh } from "../utils/parseFsh";
import { validate, scanSlots } from "../utils/grid";
import { solve, type SolveFailInfo, type SolveProgress } from "../utils/solver";
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
  requireNative: boolean;
  writeCrw: boolean;
  usageStats: boolean;
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
  requireNative: false,
  writeCrw: false,
  usageStats: true,
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

type WordPriorityRow = {
  word: string | null;
  useCount: number | bigint | null;
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

const WORD_USE_PRIORITY_MULTIPLIER = 1_000_000;

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

async function loadEditionUsagePriority(
  editionId: number,
  excludeIssueId?: bigint
): Promise<Map<string, number>> {
  const [wordRows, opredRows] = await Promise.all([
    excludeIssueId === undefined
      ? prisma.$queryRaw<WordPriorityRow[]>`
          SELECT
            UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
            SUM(iwu."useCount")::int AS "useCount"
          FROM issue_word_usage iwu
          JOIN issues i ON i.id = iwu."issueId"
          JOIN word_v w ON w.id = iwu."wordId"
          WHERE i."editionId" = ${editionId}
          GROUP BY 1
        `
      : prisma.$queryRaw<WordPriorityRow[]>`
          SELECT
            UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
            SUM(iwu."useCount")::int AS "useCount"
          FROM issue_word_usage iwu
          JOIN issues i ON i.id = iwu."issueId"
          JOIN word_v w ON w.id = iwu."wordId"
          WHERE i."editionId" = ${editionId}
            AND iwu."issueId" <> ${excludeIssueId}
          GROUP BY 1
        `,
    excludeIssueId === undefined
      ? prisma.$queryRaw<WordPriorityRow[]>`
          SELECT
            UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
            SUM(iou."useCount")::int AS "useCount"
          FROM issue_opred_usage iou
          JOIN issues i ON i.id = iou."issueId"
          JOIN opred_v o ON o.id = iou."opredId"
          JOIN word_v w ON w.id = o.word_id
          WHERE i."editionId" = ${editionId}
          GROUP BY 1, iou."opredId"
        `
      : prisma.$queryRaw<WordPriorityRow[]>`
          SELECT
            UPPER(COALESCE(NULLIF(BTRIM(w.word_text_norm), ''), w.word_text)) AS word,
            SUM(iou."useCount")::int AS "useCount"
          FROM issue_opred_usage iou
          JOIN issues i ON i.id = iou."issueId"
          JOIN opred_v o ON o.id = iou."opredId"
          JOIN word_v w ON w.id = o.word_id
          WHERE i."editionId" = ${editionId}
            AND iou."issueId" <> ${excludeIssueId}
          GROUP BY 1, iou."opredId"
        `,
  ]);

  const wordUse = new Map<string, number>();
  for (const row of wordRows) {
    if (!row.word) continue;
    wordUse.set(normalizeWordKey(row.word), toNumber(row.useCount));
  }

  const minOpredUse = new Map<string, number>();
  for (const row of opredRows) {
    if (!row.word) continue;
    const key = normalizeWordKey(row.word);
    const usage = toNumber(row.useCount);
    const current = minOpredUse.get(key);
    if (current === undefined || usage < current) {
      minOpredUse.set(key, usage);
    }
  }

  const priority = new Map<string, number>();
  for (const [word, usage] of wordUse) {
    const minDefUsage = minOpredUse.get(word) ?? 0;
    priority.set(word, usage * WORD_USE_PRIORITY_MULTIPLIER + minDefUsage);
  }
  for (const [word, minDefUsage] of minOpredUse) {
    if (!priority.has(word)) {
      priority.set(word, minDefUsage);
    }
  }
  return priority;
}

function pickBestOpred(
  opreds: Array<{ id: bigint; text_opr: string }>,
  opredUseCount: Map<bigint, number>
): { id: bigint; text: string } | null {
  let best: { id: bigint; text: string; usage: number } | null = null;
  for (const opred of opreds) {
    const usage = opredUseCount.get(opred.id) ?? 0;
    if (
      !best ||
      usage < best.usage ||
      (usage === best.usage && opred.id < best.id)
    ) {
      best = {
        id: opred.id,
        text: opred.text_opr,
        usage,
      };
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
    const bestOpred = pickBestOpred(bestWord.opred_v, opredUseCount);
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
  }
  return selected;
}

async function persistUsageStatsForIssue(
  issueId: bigint,
  editionId: number,
  wordUsage: UsageCountMap,
  opredUsage: UsageCountMap
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM issue_word_usage
      WHERE "issueId" = ${issueId}
    `;
    await tx.$executeRaw`
      DELETE FROM issue_opred_usage
      WHERE "issueId" = ${issueId}
    `;

    for (const [wordId, useCount] of wordUsage) {
      if (useCount <= 0) continue;
      await tx.$executeRaw`
        INSERT INTO issue_word_usage ("issueId", "wordId", "useCount", "createdAt")
        VALUES (${issueId}, ${wordId}, ${useCount}, now())
      `;
    }

    for (const [opredId, useCount] of opredUsage) {
      if (useCount <= 0) continue;
      await tx.$executeRaw`
        INSERT INTO issue_opred_usage ("issueId", "opredId", "useCount", "createdAt")
        VALUES (${issueId}, ${opredId}, ${useCount}, now())
      `;
    }

    await tx.$executeRaw`
      DELETE FROM edition_word_stat
      WHERE "editionId" = ${editionId}
    `;
    await tx.$executeRaw`
      INSERT INTO edition_word_stat ("editionId", "wordId", "useCount", "lastIssueId", "lastUsedAt")
      SELECT
        ${editionId} AS "editionId",
        agg."wordId",
        agg."useCount",
        last_use."issueId" AS "lastIssueId",
        last_use."createdAt" AS "lastUsedAt"
      FROM (
        SELECT
          iwu."wordId",
          SUM(iwu."useCount")::int AS "useCount"
        FROM issue_word_usage iwu
        JOIN issues i ON i.id = iwu."issueId"
        WHERE i."editionId" = ${editionId}
        GROUP BY iwu."wordId"
      ) agg
      LEFT JOIN LATERAL (
        SELECT
          iwu2."issueId",
          iwu2."createdAt"
        FROM issue_word_usage iwu2
        JOIN issues i2 ON i2.id = iwu2."issueId"
        WHERE i2."editionId" = ${editionId}
          AND iwu2."wordId" = agg."wordId"
        ORDER BY iwu2."createdAt" DESC, iwu2."issueId" DESC
        LIMIT 1
      ) last_use ON true
    `;

    await tx.$executeRaw`
      DELETE FROM edition_opred_stat
      WHERE "editionId" = ${editionId}
    `;
    await tx.$executeRaw`
      INSERT INTO edition_opred_stat ("editionId", "opredId", "useCount", "lastIssueId", "lastUsedAt")
      SELECT
        ${editionId} AS "editionId",
        agg."opredId",
        agg."useCount",
        last_use."issueId" AS "lastIssueId",
        last_use."createdAt" AS "lastUsedAt"
      FROM (
        SELECT
          iou."opredId",
          SUM(iou."useCount")::int AS "useCount"
        FROM issue_opred_usage iou
        JOIN issues i ON i.id = iou."issueId"
        WHERE i."editionId" = ${editionId}
        GROUP BY iou."opredId"
      ) agg
      LEFT JOIN LATERAL (
        SELECT
          iou2."issueId",
          iou2."createdAt"
        FROM issue_opred_usage iou2
        JOIN issues i2 ON i2.id = iou2."issueId"
        WHERE i2."editionId" = ${editionId}
          AND iou2."opredId" = agg."opredId"
        ORDER BY iou2."createdAt" DESC, iou2."issueId" DESC
        LIMIT 1
      ) last_use ON true
    `;
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
  if (a.maxDegree !== b.maxDegree) return b.maxDegree - a.maxDegree;
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
  const seen = new Map<string, number>();
  return files.map((file, idx) => {
    const key = buildSnapshotKey(file, idx, seen);
    const sourceName = file.name;
    const name = normalizeTemplateDisplayName(file.name);
    const sanitized = sanitizeName(file.name);
    const candidates = [sanitized, file.name];
    const found = candidates
      .map((candidate) => path.join(samplesDir, candidate))
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
      const slots = scanSlots(grid);
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
  const templatesJson = data.templates ? JSON.stringify(data.templates) : null;
  const reviewJson = data.reviewData ? JSON.stringify(data.reviewData) : null;
  await prisma.$executeRaw`
    UPDATE scanword_fill_jobs
    SET
      status = COALESCE(${data.status}, status),
      progress = COALESCE(${data.progress}, progress),
      "currentTemplate" = COALESCE(${data.currentTemplate ?? null}, "currentTemplate"),
      "completedTemplates" = COALESCE(${data.completedTemplates ?? null}, "completedTemplates"),
      "totalTemplates" = COALESCE(${data.totalTemplates ?? null}, "totalTemplates"),
      error = COALESCE(${data.error ?? null}, error),
      templates = COALESCE(${templatesJson}::jsonb, templates),
      "reviewData" = COALESCE(${reviewJson}::jsonb, "reviewData"),
      "outputPath" = COALESCE(${data.outputPath ?? null}, "outputPath"),
      "outputSize" = COALESCE(${data.outputSize ?? null}, "outputSize"),
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

function buildReviewTemplate(
  entry: TemplateEntry,
  solved: string[],
  language: string,
  langId: number | null,
  selections: Map<string, WordSelection>,
  fallbackDefinitions: Map<string, string>
): ReviewTemplate {
  const wordsBySlot = new Map<number, string>();
  entry.slots.forEach((slot, index) => {
    const word = slot.cells.map(([row, col]) => solved[row]?.[col] ?? "").join("");
    wordsBySlot.set(slot.id, normalizeWordKey(word));
  });

  const intersectionsBySlot = buildSlotIntersections(entry.slots, wordsBySlot);
  const { clueBySlot, clueGroups } = buildClueMaps(entry.grid, entry.slots, solved);

  const slots: ReviewSlot[] = entry.slots.map((slot, index) => {
    const word = wordsBySlot.get(slot.id) ?? "";
    const selection = selections.get(word);
    const fallbackDefinition = normalizeDefinitionText(fallbackDefinitions.get(word));
    const selectedDefinition = normalizeDefinitionText(selection?.definition) || fallbackDefinition;
    const optionMap = new Map<string, ReviewDefinitionOption>();
    for (const def of selection?.definitions ?? []) {
      const text = normalizeDefinitionText(def.text);
      if (!text) continue;
      const key = `${def.opredId?.toString() ?? "custom"}:${text}`;
      optionMap.set(key, {
        opredId: def.opredId ? String(def.opredId) : null,
        text,
      });
    }
    if (selectedDefinition.length > 0) {
      const selectedKey = `${selection?.opredId ? String(selection.opredId) : "custom"}:${selectedDefinition}`;
      optionMap.set(selectedKey, {
        opredId: selection?.opredId ? String(selection.opredId) : null,
        text: selectedDefinition,
      });
    }
    const options = [...optionMap.values()];
    options.sort((a, b) => a.text.localeCompare(b.text, "ru"));

    return {
      slotId: slot.id,
      r: slot.r,
      c: slot.c,
      dir: slotDirName(slot),
      len: slot.len,
      cells: slot.cells,
      word,
      wordId: selection ? String(selection.wordId) : null,
      opredId: selection?.opredId ? String(selection.opredId) : null,
      definition: selectedDefinition,
      definitionOptions: options,
      intersections: intersectionsBySlot.get(slot.id) ?? [],
      clueCell: clueBySlot.get(slot.id) ?? null,
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
  return {
    ...defaults,
    ...raw,
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
    const templateId = issue.filterTemplateId ?? issue.snapshotTemplateId;
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
    const usagePriorityByWord = new Map<string, number>();
    if (options.usageStats) {
      const mainLangId = await resolveLanguageId(template.language);
      if (mainLangId !== null) {
        const loadedPriority = await loadEditionUsagePriority(issue.editionId, issue.issueId);
        for (const [word, priority] of loadedPriority) {
          usagePriorityByWord.set(word, priority);
        }
        sortDictionaryByUsagePriority(dict, usagePriorityByWord);
      }
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

    const totalTemplates = templatesState.length;
    let completedTemplates = 0;
    let failedTemplates = templatesState.filter((t) => t.status === "error").length;
    const reviewTemplates: ReviewTemplate[] = [];
    const langIdCache = new Map<string, number | null>();

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

    const globalDict = options.unique
      ? new Map<number, string[]>([...dict].map(([l, a]) => [l, [...a]]))
      : dict;

    const nativeAvailable = isNativeDlxAvailable();
    if (options.requireNative && !nativeAvailable) {
      throw new Error("Native DLX solver is not available");
    }

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

      const dictForTemplate = options.unique
        ? globalDict
        : new Map<number, string[]>([...dict].map(([l, a]) => [l, [...a]]));

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

      let solved: string[] | null | undefined;
      if (nativeAvailable) {
        solved = await solveDlxNativeAsync(entry.grid.data, entry.slots, dictForTemplate, {
          shuffle: options.shuffle,
          lcv: options.lcv,
          restarts: options.restarts,
          parallelRestarts: options.parallelRestarts,
          maxNodes: options.maxNodes,
          maxMs: options.maxMs,
          nativeDlx: true,
          label: entry.name,
          wordPriority: options.usageStats ? usagePriorityByWord : undefined,
          onProgress,
          onFail,
        });
        if (solved === undefined) {
          solved = solve(entry.grid.data, entry.slots, dictForTemplate, {
            shuffle: options.shuffle,
            lcv: options.lcv,
            restarts: options.restarts,
            parallelRestarts: options.parallelRestarts,
            maxNodes: options.maxNodes,
            maxMs: options.maxMs,
            nativeDlx: false,
            label: entry.name,
            wordPriority: options.usageStats ? usagePriorityByWord : undefined,
            onProgress,
            onFail,
          });
        }
      } else {
        solved = solve(entry.grid.data, entry.slots, dictForTemplate, {
          shuffle: options.shuffle,
          lcv: options.lcv,
          restarts: options.restarts,
          parallelRestarts: options.parallelRestarts,
          maxNodes: options.maxNodes,
          maxMs: options.maxMs,
          nativeDlx: false,
          label: entry.name,
          wordPriority: options.usageStats ? usagePriorityByWord : undefined,
          onProgress,
          onFail,
        });
      }

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

      if (options.unique) {
        const usedHere = entry.slots.map((s) => s.cells.map(([r, c]) => solved![r][c]).join(""));
        for (const w of usedHere) {
          const len = w.length;
          const arr = globalDict.get(len);
          if (!arr) continue;
          const idx = arr.indexOf(w);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }

      const usedWordsList = entry.slots.map((s) => s.cells.map(([r, c]) => solved![r][c]).join(""));
      const langCode = template.language.toLowerCase();
      let langId = langIdCache.get(langCode);
      if (langId === undefined) {
        langId = await resolveLanguageId(langCode);
        langIdCache.set(langCode, langId);
      }
      const selectedWords =
        typeof langId === "number"
          ? await selectWordsAndDefinitionsForEdition(usedWordsList, {
              langId,
              editionId: issue.editionId,
              preferUsageStats: options.usageStats,
              definitionWhere,
            })
          : new Map<string, WordSelection>();
      const fallbackDefinitions = await loadDefinitions(usedWordsList, {
        langCode: template.language,
        definitionWhere,
      });
      reviewTemplates.push(
        buildReviewTemplate(entry, solved!, langCode, langId ?? null, selectedWords, fallbackDefinitions)
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
    errors.push(...validateTemplateDefinitions(template, states));
    errors.push(...validateDefinitionConsistency(template, states));

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
  return () => runtime.emitter.off("update", listener);
}
