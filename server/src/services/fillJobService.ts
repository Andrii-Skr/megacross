import archiver from "archiver";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildClueEntries } from "../utils/clues";
import { parseFsh } from "../utils/parseFsh";
import { validate, scanSlots } from "../utils/grid";
import { solve, type SolveFailInfo, type SolveProgress } from "../utils/solver";
import { consumeLastNativeFail, isNativeDlxAvailable, solveDlxNativeAsync } from "../utils/nativeDlx";
import { buildCrw } from "../utils/writeCrw";
import type { Cell, Grid, Slot } from "../types";
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

type FillJobStatus = "queued" | "running" | "done" | "error";

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
};

type IssueContext = {
  issueId: bigint;
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
      ADD COLUMN IF NOT EXISTS templates JSONB;
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
  outputPath?: string | null;
  outputSize?: number | null;
}) {
  const templatesJson = data.templates ? JSON.stringify(data.templates) : null;
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

    const outputRoot = getOutputDir();
    const issueRoot = path.join(
      outputRoot,
      sanitizeName(issue.editionCode),
      sanitizeName(issue.issueLabel)
    );
    const issueDir = path.join(issueRoot, `job-${jobIdStr}`);
    mkdirSync(issueDir, { recursive: true });

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
      const definitions = await loadDefinitions(usedWordsList, { langCode: template.language });

      const { svg, svgRaw, usedWords } = buildSvg(entry.grid, entry.slots, solved!, definitions, {
        style: options.style,
      });

      const templateDir = path.join(issueDir, sanitizeName(entry.name));
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(path.join(templateDir, "crossword.svg"), svg);
      writeFileSync(path.join(templateDir, "crossword-no-text.svg"), svgRaw);
      writeFileSync(path.join(templateDir, "used-words.txt"), usedWords);

      if (options.writeCrw) {
        const crw = buildCrw(entry.grid, entry.slots, solved!, {
          templatePath: entry.path,
          lowerCaseWords: true,
        });
        writeFileSync(path.join(templateDir, `${entry.name}.crw`), crw);
      }

      if (idx !== undefined) {
        templatesState[idx] = {
          ...templatesState[idx],
          status: "done",
        };
      }
      completedTemplates += 1;
      await pushTemplateUpdate({ currentTemplate: entry.name });
    }

    const archivePath = path.join(issueRoot, `scanwords_${jobIdStr}.zip`);
    const size = await zipDirectory(issueDir, archivePath);
    if (failedTemplates > 0) {
      const failures = templatesState.filter((t) => t.status === "error");
      writeFileSync(
        path.join(issueDir, "failures.json"),
        JSON.stringify(failures, null, 2)
      );
    }
    await updateJob(jobId, {
      status: "done",
      progress: 100,
      outputPath: archivePath,
      outputSize: size,
      currentTemplate: null,
      templates: templatesState,
      completedTemplates,
      totalTemplates,
    });
    updateLocal({
      status: "done",
      progress: 100,
      currentTemplate: null,
      templates: templatesState,
      completedTemplates,
      totalTemplates,
      archiveReady: true,
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

export function subscribeFillJob(jobId: string, listener: (update: FillJobUpdate) => void): () => void {
  const runtime = jobRuntimes.get(jobId);
  if (!runtime) return () => {};
  runtime.emitter.on("update", listener);
  if (runtime.lastUpdate) listener(runtime.lastUpdate);
  return () => runtime.emitter.off("update", listener);
}
