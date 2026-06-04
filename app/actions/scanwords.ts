"use server";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { authOptions } from "@/auth";
import {
  normalizeTemplateSetupPayload,
  type TemplateSetupPreviewArrow,
  type TemplateSetupPreviewCell,
  type TemplateSetupPreviewPayload,
  type TemplateSetupPreviewSlot,
  type TemplateSetupPreviewTemplate,
} from "@/components/scanwords/workspace/model";
import { actionError } from "@/lib/action-error";
import { Permissions, requirePermissionAsync } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { buildPhotoAreaBoundsBySlotId } from "@/lib/scanwordPhotoClues";
import { scanSlotsDetailed, validate } from "@/utils/cross/grid";
import { parseFshBytes } from "@/utils/cross/parseFsh";
import type { GridCell } from "@/utils/cross/types";

const editionSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

const issueSchema = z.object({
  editionId: z.number().int().positive(),
  label: z.string().trim().min(1).max(64),
});

const issueTemplateSchema = z.object({
  issueId: z.string().min(1),
  templateId: z.number().int().positive().nullable(),
});

const editionVisibilitySchema = z.object({
  id: z.number().int().positive(),
  hidden: z.boolean(),
});

const issueVisibilitySchema = z.object({
  id: z.string().min(1),
  hidden: z.boolean(),
});

const editionDeleteSchema = z.object({
  id: z.number().int().positive(),
});

const issueDeleteSchema = z.object({
  id: z.string().min(1),
});

const uploadSnapshotSchema = z.object({
  issueId: z.string().min(1),
  templateId: z.number().int().positive().nullable().optional(),
  templateName: z.string().trim().max(120).nullable().optional(),
  fileCount: z.number().int().min(0),
  neededStats: z.record(z.string(), z.number()).nullable().optional(),
  templateSetup: z.unknown().nullable().optional(),
  files: z.array(
    z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      size: z.number().int().min(0),
    }),
  ),
  errors: z.array(
    z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

const uploadSnapshotLoadSchema = z.object({
  issueId: z.string().min(1),
});

const templateSetupSaveSchema = z.object({
  issueId: z.string().min(1),
  templateSetup: z.unknown().nullable(),
});

const fillArchivesLoadSchema = z.object({
  issueId: z.string().min(1),
});

const fillSettingsLoadSchema = z.object({
  issueId: z.string().min(1),
});

const issueSvgSettingsLoadSchema = z.object({
  issueId: z.string().min(1),
});

const SVG_FONT_PT_MIN = 1;
const SVG_FONT_PT_MAX = 72;
const SVG_TYPOGRAPHY_PERCENT_MIN = 40;
const SVG_TYPOGRAPHY_PERCENT_MAX = 200;
const DEFAULT_SVG_TYPOGRAPHY_PERCENT = 80;
const DEFAULT_SVG_CLUE_FONT_BASE_PT = 9;
const DEFAULT_SVG_CLUE_FONT_MIN_PT = 7.6;
const DEFAULT_SVG_SYSTEM_FONT_FAMILY = "Arial";

type PreviewArrowAsset = {
  body: string;
  width: number;
  height: number;
};

const PREVIEW_ARROW_FILES: Record<number, string> = {
  1: "01.svg",
  2: "02.svg",
  3: "03.svg",
  4: "04.svg",
  5: "05.svg",
  6: "06.svg",
  8: "08.svg",
  16: "10.svg",
  24: "18.svg",
  32: "20.svg",
  40: "28.svg",
  48: "30.svg",
  56: "38.svg",
};

const PREVIEW_CLUE_MAP: Record<number, Array<{ cluePos: number; dirKey: number }>> = {
  1: [{ cluePos: 2, dirKey: 8 }],
  2: [{ cluePos: 1, dirKey: 8 }],
  3: [{ cluePos: 4, dirKey: 8 }],
  4: [{ cluePos: 7, dirKey: 8 }],
  5: [{ cluePos: 9, dirKey: 8 }],
  6: [{ cluePos: 6, dirKey: 8 }],
  7: [{ cluePos: 3, dirKey: 8 }],
  8: [{ cluePos: 2, dirKey: 6 }],
  10: [
    { cluePos: 1, dirKey: 8 },
    { cluePos: 2, dirKey: 6 },
  ],
  11: [
    { cluePos: 2, dirKey: 6 },
    { cluePos: 4, dirKey: 8 },
  ],
  13: [
    { cluePos: 2, dirKey: 6 },
    { cluePos: 9, dirKey: 8 },
  ],
  16: [{ cluePos: 1, dirKey: 6 }],
  17: [
    { cluePos: 2, dirKey: 8 },
    { cluePos: 1, dirKey: 6 },
  ],
  19: [
    { cluePos: 1, dirKey: 6 },
    { cluePos: 4, dirKey: 8 },
  ],
  21: [
    { cluePos: 1, dirKey: 6 },
    { cluePos: 9, dirKey: 8 },
  ],
  24: [{ cluePos: 4, dirKey: 6 }],
  25: [
    { cluePos: 2, dirKey: 8 },
    { cluePos: 4, dirKey: 6 },
  ],
  26: [
    { cluePos: 1, dirKey: 8 },
    { cluePos: 4, dirKey: 6 },
  ],
  28: [
    { cluePos: 4, dirKey: 6 },
    { cluePos: 7, dirKey: 8 },
  ],
  29: [
    { cluePos: 4, dirKey: 6 },
    { cluePos: 9, dirKey: 8 },
  ],
  32: [{ cluePos: 7, dirKey: 6 }],
  33: [
    { cluePos: 2, dirKey: 8 },
    { cluePos: 7, dirKey: 6 },
  ],
  35: [
    { cluePos: 4, dirKey: 8 },
    { cluePos: 7, dirKey: 6 },
  ],
  40: [{ cluePos: 9, dirKey: 6 }],
  41: [
    { cluePos: 2, dirKey: 8 },
    { cluePos: 9, dirKey: 6 },
  ],
  42: [
    { cluePos: 3, dirKey: 2 },
    { cluePos: 7, dirKey: 6 },
  ],
  43: [
    { cluePos: 4, dirKey: 8 },
    { cluePos: 9, dirKey: 6 },
  ],
  44: [
    { cluePos: 7, dirKey: 8 },
    { cluePos: 9, dirKey: 6 },
  ],
  48: [{ cluePos: 8, dirKey: 6 }],
  56: [{ cluePos: 3, dirKey: 6 }],
  57: [
    { cluePos: 2, dirKey: 8 },
    { cluePos: 3, dirKey: 6 },
  ],
  61: [
    { cluePos: 3, dirKey: 6 },
    { cluePos: 9, dirKey: 8 },
  ],
};

const PREVIEW_CLUE_POS_FACTORS: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0.5, 0],
  3: [1, 0],
  4: [0, 0.5],
  5: [0.5, 0.5],
  6: [1, 0.5],
  7: [0, 1],
  8: [0.5, 1],
  9: [1, 1],
};

const PREVIEW_SIMPLE_ARROW_CLUE_POS: Record<number, number> = Object.fromEntries(
  Object.entries(PREVIEW_CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(
      ([code, entries]) => Number.isFinite(code) && entries.length === 1 && PREVIEW_ARROW_FILES[code] !== undefined,
    )
    .flatMap(([code, entries]) => {
      const entry = entries[0];
      return entry ? [[code, entry.cluePos] as const] : [];
    }),
) as Record<number, number>;

const PREVIEW_SIMPLE_ARROW_BY_CLUE: Record<string, number> = Object.fromEntries(
  Object.entries(PREVIEW_CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(
      ([code, entries]) => Number.isFinite(code) && entries.length === 1 && PREVIEW_ARROW_FILES[code] !== undefined,
    )
    .flatMap(([code, entries]) => {
      const entry = entries[0];
      return entry ? [[`${entry.cluePos}:${entry.dirKey}`, code] as const] : [];
    }),
) as Record<string, number>;

const PREVIEW_DOUBLE_ARROW_COMPONENTS: Record<number, number[]> = Object.fromEntries(
  Object.entries(PREVIEW_CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(([code, entries]) => {
      return (
        Number.isFinite(code) &&
        entries.length === 2 &&
        entries.every((entry) => PREVIEW_SIMPLE_ARROW_BY_CLUE[`${entry.cluePos}:${entry.dirKey}`] !== undefined)
      );
    })
    .flatMap(([code, entries]) => {
      const componentCodes = entries
        .map((entry) => PREVIEW_SIMPLE_ARROW_BY_CLUE[`${entry.cluePos}:${entry.dirKey}`])
        .filter((value): value is number => value !== undefined);
      return componentCodes.length === entries.length ? [[code, componentCodes] as const] : [];
    }),
) as Record<number, number[]>;

let previewArrowAssetsPromise: Promise<Record<number, PreviewArrowAsset>> | null = null;

type FillJobStatus = "queued" | "running" | "review" | "done" | "error";

const fillJobStatuses = new Set<FillJobStatus>(["queued", "running", "review", "done", "error"]);

const snapshotFilesSchema = z.array(
  z.object({
    key: z.string(),
    name: z.string(),
    size: z.number(),
  }),
);

const snapshotErrorsSchema = z.array(
  z.object({
    key: z.string(),
    name: z.string(),
    reason: z.string(),
  }),
);

const snapshotNeededStatsSchema = z.record(z.string(), z.number());

const fillSettingsSchema = z
  .object({
    issueId: z.string().min(1),
    speedPreset: z.enum(["fast", "medium", "slow"]),
    definitionMaxPerCell: z.number().int().min(1).max(1024),
    definitionMaxPerHalfCell: z.number().int().min(1).max(1024),
  })
  .superRefine((value, ctx) => {
    if (value.definitionMaxPerHalfCell > value.definitionMaxPerCell) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["definitionMaxPerHalfCell"],
        message: "definitionMaxPerHalfCell must be <= definitionMaxPerCell",
      });
    }
  });

const issueSvgSettingsSchema = z
  .object({
    issueId: z.string().min(1),
    clueFontBasePt: z.number().min(SVG_FONT_PT_MIN).max(SVG_FONT_PT_MAX),
    clueFontMinPt: z.number().min(SVG_FONT_PT_MIN).max(SVG_FONT_PT_MAX),
    clueGlyphWidthPct: z.number().int().min(SVG_TYPOGRAPHY_PERCENT_MIN).max(SVG_TYPOGRAPHY_PERCENT_MAX),
    clueLineHeightPct: z.number().int().min(SVG_TYPOGRAPHY_PERCENT_MIN).max(SVG_TYPOGRAPHY_PERCENT_MAX),
    fontId: z.string().min(1).nullable().optional(),
    systemFontFamily: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.clueFontMinPt > value.clueFontBasePt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clueFontMinPt"],
        message: "clueFontMinPt must be <= clueFontBasePt",
      });
    }
  });

async function ensureScanwordsAccess() {
  const session = await getServerSession(authOptions);
  await requirePermissionAsync(session?.user ?? null, Permissions.AdminAccess);
  return session;
}

function isScanwordFillSettingsCompoundKeyValidationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientValidationError)) {
    return false;
  }
  const message = typeof error.message === "string" ? error.message : "";
  return message.includes("Unknown argument `userId_issueId`");
}

function normalizeName(value: string) {
  return value.trim();
}

function slugifyCodeBase(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
  return cleaned || "EDITION";
}

function buildCandidateCode(base: string, suffix: number | null) {
  const trimmedBase = base.slice(0, 32);
  if (!suffix) return trimmedBase;
  const suffixText = `_${suffix}`;
  const available = 32 - suffixText.length;
  return `${trimmedBase.slice(0, Math.max(1, available))}${suffixText}`;
}

function snapshotCutoffDate() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function samplesBaseDir() {
  const configured = process.env.CROSS_SAMPLES_DIR?.trim();
  if (!configured) {
    throw new Error("CROSS_SAMPLES_DIR is not configured");
  }
  return configured;
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

async function resolveIssueSamplesDir(issueId: bigint): Promise<string | null> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      edition: { select: { code: true } },
      issueNumber: { select: { label: true } },
    },
  });
  if (!issue) return null;
  return path.join(samplesBaseDir(), sanitizeName(issue.edition.code), sanitizeName(issue.issueNumber.label));
}

function buildPreviewCells(slots: TemplateSetupPreviewSlot[]): TemplateSetupPreviewCell[] {
  const byKey = new Map<string, TemplateSetupPreviewCell>();
  for (const slot of slots) {
    for (const [row, col] of slot.cells) {
      const key = `${row},${col}`;
      const current = byKey.get(key) ?? {
        row,
        col,
        isIntersection: false,
        slotIds: [],
      };
      if (!current.slotIds.includes(slot.slotId)) {
        current.slotIds.push(slot.slotId);
      }
      current.isIntersection = current.slotIds.length > 1;
      byKey.set(key, current);
    }
  }
  return [...byKey.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

function parsePreviewArrowPoints(pointsRaw: string): [number, number][] {
  const nums = pointsRaw
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
  const points: [number, number][] = [];
  for (let index = 0; index < nums.length - 1; index += 2) {
    const x = nums[index];
    const y = nums[index + 1];
    if (x === undefined || y === undefined) continue;
    points.push([x, y]);
  }
  return points;
}

function parsePreviewArrowClassStyles(source: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of source.matchAll(styleRegex)) {
    const css = match[1]?.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "") ?? "";
    const ruleRegex = /\.([_a-zA-Z][-\w]*)\s*\{([^}]*)\}/g;
    for (const rule of css.matchAll(ruleRegex)) {
      const className = rule[1];
      if (!className) continue;
      const declarations = rule[2] ?? "";
      const styleMap = result[className] ?? {};
      for (const declaration of declarations.split(";")) {
        const [rawProp, rawValue] = declaration.split(":");
        const prop = (rawProp ?? "").trim().toLowerCase();
        const value = (rawValue ?? "").trim();
        if (!prop || !value) continue;
        styleMap[prop] = value;
      }
      result[className] = styleMap;
    }
  }
  return result;
}

function inlinePreviewArrowClassStyles(bodyRaw: string, classStyles: Record<string, Record<string, string>>): string {
  return bodyRaw.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/g, (full, tagName, attrs) => {
    if (full.startsWith("</")) return full;
    const classMatch = attrs.match(/\sclass\s*=\s*"([^"]+)"/i);
    if (!classMatch) return full;
    const classNames = classMatch[1];
    if (!classNames) return full;
    const classes = classNames.trim().split(/\s+/).filter(Boolean);
    if (!classes.length) return full;
    const merged: Record<string, string> = {};
    for (const className of classes) {
      const styleMap = classStyles[className];
      if (!styleMap) continue;
      for (const [prop, value] of Object.entries(styleMap)) merged[prop] = value;
    }
    if (!Object.keys(merged).length) return full;

    let tag = `<${tagName}${attrs}>`.replace(/\sclass\s*=\s*"[^"]*"/i, "");
    for (const prop of [
      "fill",
      "fill-rule",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "opacity",
    ]) {
      const value = merged[prop];
      if (!value) continue;
      const close = tag.endsWith("/>") ? "/>" : ">";
      tag = `${tag.slice(0, -close.length)} ${prop}="${value}"${close}`;
    }
    return tag;
  });
}

function readPreviewArrowNumericAttr(tag: string, name: string): number | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*"([^"]+)"`, "i"));
  if (!match) return null;
  const rawValue = match[1];
  if (!rawValue) return null;
  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) ? value : null;
}

function extractPreviewArrowBounds(body: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const update = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const match of body.matchAll(/<(?:polyline|polygon)\b[^>]*\bpoints\s*=\s*"([^"]+)"[^>]*>/gi)) {
    const pointsRaw = match[1];
    if (!pointsRaw) continue;
    for (const [x, y] of parsePreviewArrowPoints(pointsRaw)) update(x, y);
  }
  for (const match of body.matchAll(/<line\b[^>]*>/gi)) {
    const tag = match[0];
    const x1 = readPreviewArrowNumericAttr(tag, "x1");
    const y1 = readPreviewArrowNumericAttr(tag, "y1");
    const x2 = readPreviewArrowNumericAttr(tag, "x2");
    const y2 = readPreviewArrowNumericAttr(tag, "y2");
    if (x1 !== null && y1 !== null) update(x1, y1);
    if (x2 !== null && y2 !== null) update(x2, y2);
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) return null;
  return bounds;
}

async function loadPreviewArrowAssets(): Promise<Record<number, PreviewArrowAsset>> {
  if (previewArrowAssetsPromise) return previewArrowAssetsPromise;
  previewArrowAssetsPromise = (async () => {
    const baseDir = path.join(process.cwd(), "..", "cross", "server", "src", "arrows");
    const entries = await Promise.all(
      Object.entries(PREVIEW_ARROW_FILES).map(async ([rawCode, fileName]) => {
        const code = Number(rawCode);
        const raw = await readFile(path.join(baseDir, fileName), "utf8");
        const svgMatch = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        const bodyRaw = svgMatch?.[1] ?? raw;
        const bodyStyled = inlinePreviewArrowClassStyles(bodyRaw, parsePreviewArrowClassStyles(raw))
          .replace(/<defs[\s\S]*?<\/defs>/gi, "")
          .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, "")
          .replace(/<metadata\b[^>]*\/>/gi, "")
          .replace(/\s+id="[^"]*"/g, "")
          .trim();

        let width = 100;
        let height = 100;
        const viewBoxMatch = raw.match(/viewBox="([^"]+)"/i);
        if (viewBoxMatch) {
          const viewBoxValue = viewBoxMatch[1];
          const parts = viewBoxValue
            ?.trim()
            .split(/[\s,]+/)
            .map((value) => Number.parseFloat(value));
          if (parts?.length === 4 && parts.every((value) => Number.isFinite(value))) {
            width = parts[2] ?? width;
            height = parts[3] ?? height;
          }
        }

        const bounds = extractPreviewArrowBounds(bodyStyled);
        if (!bounds) {
          return [code, { body: bodyStyled, width, height }] as const;
        }

        const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
        const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
        const oversizedCanvas = width / boundsWidth > 3 || height / boundsHeight > 3;
        if (!oversizedCanvas) {
          return [code, { body: bodyStyled, width, height }] as const;
        }

        const tx = Math.round(-bounds.minX * 1000) / 1000;
        const ty = Math.round(-bounds.minY * 1000) / 1000;
        return [
          code,
          {
            body: `<g transform="translate(${tx} ${ty})">${bodyStyled}</g>`,
            width: boundsWidth,
            height: boundsHeight,
          },
        ] as const;
      }),
    );
    return Object.fromEntries(entries);
  })();
  return previewArrowAssetsPromise;
}

function buildPreviewArrowMarkupForCell(
  assets: Record<number, PreviewArrowAsset>,
  code: number,
  orig: GridCell,
): string | null {
  if ([0x01, 0x02, 0x03, 0x04, 0x05, 0x06].includes(code) && orig !== "↓") {
    return null;
  }
  const componentCodes = PREVIEW_DOUBLE_ARROW_COMPONENTS[code] ?? (PREVIEW_SIMPLE_ARROW_CLUE_POS[code] ? [code] : []);
  if (!componentCodes.length) return null;
  const cell = 100;
  const baseSize = 68;
  const parts = componentCodes
    .map((arrowCode) => {
      const asset = assets[arrowCode];
      if (!asset) return "";
      const cluePos = PREVIEW_SIMPLE_ARROW_CLUE_POS[arrowCode] ?? 5;
      const [fx, fy] = PREVIEW_CLUE_POS_FACTORS[cluePos] ?? [0.5, 0.5];
      const scaleBoost = arrowCode === 0x01 || arrowCode === 0x18 ? 0.52 : 0.9;
      const size = baseSize * scaleBoost;
      const ax = cell * fx - size * fx;
      const ay = cell * fy - size * fy;
      const scale = Math.min(size / (asset.width || size), size / (asset.height || size));
      const dx = ax + (size - asset.width * scale) * fx;
      const dy = ay + (size - asset.height * scale) * fy;
      const tx = Math.round(dx * 1_000_000) / 1_000_000;
      const ty = Math.round(dy * 1_000_000) / 1_000_000;
      const sc = Math.round(scale * 1_000_000) / 1_000_000;
      return `<g transform="matrix(${sc} 0 0 ${sc} ${tx} ${ty})">${asset.body}</g>`;
    })
    .filter(Boolean);
  return parts.length ? parts.join("") : null;
}

async function buildPreviewArrows(grid: {
  rows: number;
  cols: number;
  data: string[];
  codes: number[][];
}): Promise<TemplateSetupPreviewArrow[]> {
  const assets = await loadPreviewArrowAssets();
  const arrows: TemplateSetupPreviewArrow[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const code = grid.codes[row]?.[col] ?? 0;
      const orig = (grid.data[row]?.[col] ?? "*") as GridCell;
      const markup = buildPreviewArrowMarkupForCell(assets, code, orig);
      if (!markup) continue;
      arrows.push({ row, col, markup });
    }
  }
  return arrows;
}

function toIntOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function normalizeSystemFontFamily(value: string | null | undefined): string {
  if (typeof value !== "string") return DEFAULT_SVG_SYSTEM_FONT_FAMILY;
  const normalized = value
    .replace(/[\r\n\t]/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return normalized.length > 0 ? normalized.slice(0, 120) : DEFAULT_SVG_SYSTEM_FONT_FAMILY;
}

function defaultIssueSvgSettings() {
  return {
    clueFontBasePt: DEFAULT_SVG_CLUE_FONT_BASE_PT,
    clueFontMinPt: DEFAULT_SVG_CLUE_FONT_MIN_PT,
    clueGlyphWidthPct: DEFAULT_SVG_TYPOGRAPHY_PERCENT,
    clueLineHeightPct: DEFAULT_SVG_TYPOGRAPHY_PERCENT,
    fontId: null as string | null,
    systemFontFamily: DEFAULT_SVG_SYSTEM_FONT_FAMILY,
  };
}

function isMissingTableError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === "P2021") return true;
  if (err.code !== "P2010") return false;

  const meta = err.meta as
    | {
        code?: unknown;
        message?: unknown;
        driverAdapterError?: { code?: unknown; message?: unknown; name?: unknown; cause?: unknown } | unknown;
      }
    | undefined;
  const driverAdapterError =
    meta?.driverAdapterError && typeof meta.driverAdapterError === "object" && !Array.isArray(meta.driverAdapterError)
      ? (meta.driverAdapterError as { code?: unknown; message?: unknown; name?: unknown; cause?: unknown })
      : null;
  const cause =
    driverAdapterError?.cause &&
    typeof driverAdapterError.cause === "object" &&
    !Array.isArray(driverAdapterError.cause)
      ? (driverAdapterError.cause as { code?: unknown; message?: unknown; name?: unknown })
      : null;

  const pgCodeCandidates = [meta?.code, driverAdapterError?.code, cause?.code];
  if (pgCodeCandidates.some((value) => typeof value === "string" && value.trim() === "42P01")) {
    return true;
  }

  const text = [
    err.message,
    typeof meta?.message === "string" ? meta.message : "",
    typeof driverAdapterError?.message === "string" ? driverAdapterError.message : "",
    typeof driverAdapterError?.name === "string" ? driverAdapterError.name : "",
    typeof cause?.message === "string" ? cause.message : "",
    typeof cause?.name === "string" ? cause.name : "",
  ]
    .join(" ")
    .toLowerCase();
  return (text.includes("relation") && text.includes("does not exist")) || text.includes("tabledoesnotexist");
}

function isMissingColumnError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === "P2022") return true;
  if (err.code !== "P2010") return false;

  const meta = err.meta as
    | {
        code?: unknown;
        message?: unknown;
        driverAdapterError?: { code?: unknown; message?: unknown; name?: unknown; cause?: unknown } | unknown;
      }
    | undefined;
  const driverAdapterError =
    meta?.driverAdapterError && typeof meta.driverAdapterError === "object" && !Array.isArray(meta.driverAdapterError)
      ? (meta.driverAdapterError as { code?: unknown; message?: unknown; name?: unknown; cause?: unknown })
      : null;
  const cause =
    driverAdapterError?.cause &&
    typeof driverAdapterError.cause === "object" &&
    !Array.isArray(driverAdapterError.cause)
      ? (driverAdapterError.cause as { code?: unknown; message?: unknown; name?: unknown })
      : null;

  const pgCodeCandidates = [meta?.code, driverAdapterError?.code, cause?.code];
  if (pgCodeCandidates.some((value) => typeof value === "string" && value.trim() === "42703")) {
    return true;
  }

  const text = [
    err.message,
    typeof meta?.message === "string" ? meta.message : "",
    typeof driverAdapterError?.message === "string" ? driverAdapterError.message : "",
    typeof driverAdapterError?.name === "string" ? driverAdapterError.name : "",
    typeof cause?.message === "string" ? cause.message : "",
    typeof cause?.name === "string" ? cause.name : "",
  ]
    .join(" ")
    .toLowerCase();
  return (text.includes("column") && text.includes("does not exist")) || text.includes("columndoesnotexist");
}

function normalizeFillArchiveStatus(statusRaw: string | null | undefined): FillJobStatus {
  const normalized = statusRaw ?? "done";
  return fillJobStatuses.has(normalized as FillJobStatus) ? (normalized as FillJobStatus) : "done";
}

function isArchiveVersionFileName(fileName: string, jobId: string): boolean {
  if (fileName === `scanwords_${jobId}.zip`) return true;
  return new RegExp(`^scanwords_${jobId}__\\d{10,}\\.zip$`).test(fileName);
}

async function readArchiveVersionFiles(
  jobId: string,
  outputPath: string,
): Promise<Array<{ fileName: string; updatedAt: Date | null }>> {
  const directory = path.dirname(outputPath);
  let files: string[] = [];
  try {
    files = await readdir(directory);
  } catch {
    return [];
  }

  const matched = files.filter((fileName) => isArchiveVersionFileName(fileName, jobId));
  if (!matched.length) return [];
  const withStats = await Promise.all(
    matched.map(async (fileName) => {
      const filePath = path.join(directory, fileName);
      try {
        const fileStats = await stat(filePath);
        return {
          fileName,
          updatedAt: fileStats.mtime,
        };
      } catch {
        return {
          fileName,
          updatedAt: null,
        };
      }
    }),
  );
  withStats.sort((a, b) => {
    const left = a.updatedAt?.getTime() ?? 0;
    const right = b.updatedAt?.getTime() ?? 0;
    return right - left;
  });
  return withStats;
}

async function getExistingEditionByName(name: string) {
  return prisma.edition.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, deletedAt: true, hidden: true },
  });
}

async function generateUniqueEditionCode(base: string) {
  const existing = await prisma.edition.findMany({
    where: { code: { startsWith: base } },
    select: { code: true },
  });
  const used = new Set(existing.map((row) => row.code));
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = buildCandidateCode(base, i);
    if (!used.has(candidate)) return candidate;
  }
  return buildCandidateCode(base, Date.now() % 1000);
}

export async function createEditionAction(input: z.infer<typeof editionSchema>) {
  await ensureScanwordsAccess();
  const data = editionSchema.parse(input);
  const name = normalizeName(data.name);
  const existing = await getExistingEditionByName(name);
  if (existing) {
    if (existing.deletedAt || existing.hidden) {
      await prisma.edition.update({
        where: { id: existing.id },
        data: { deletedAt: null, hidden: false },
        select: { id: true },
      });
      const locale = await getLocale();
      revalidatePath(`/${locale}/scanwords`);
    }
    return { id: existing.id, created: false };
  }

  const base = slugifyCodeBase(name);
  let code = await generateUniqueEditionCode(base);
  let createdId: number | null = null;

  try {
    const created = await prisma.edition.create({ data: { code, name }, select: { id: true } });
    createdId = created.id;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const retryExisting = await getExistingEditionByName(name);
      if (retryExisting) {
        return { id: retryExisting.id, created: false };
      }
      const fallback = await generateUniqueEditionCode(base);
      if (fallback !== code) {
        code = fallback;
        const created = await prisma.edition.create({ data: { code, name }, select: { id: true } });
        createdId = created.id;
      } else {
        throw actionError("DUPLICATE_EDITION", 409);
      }
    } else {
      throw e;
    }
  }
  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
  if (createdId == null) {
    throw actionError("EDITION_CREATION_FAILED", 500);
  }
  return { id: createdId, created: true };
}

export async function createIssueAction(input: z.infer<typeof issueSchema>) {
  await ensureScanwordsAccess();
  const data = issueSchema.parse(input);

  const issueNumber = await prisma.issueNumber.upsert({
    where: { label: data.label },
    update: {},
    create: {
      label: data.label,
      year: null,
      seq: null,
      series: null,
    },
    select: { id: true },
  });

  const existingIssue = await prisma.issue.findUnique({
    where: {
      editionId_issueNumberId: {
        editionId: data.editionId,
        issueNumberId: issueNumber.id,
      },
    },
    select: { id: true, deletedAt: true, hidden: true },
  });

  if (existingIssue) {
    if (existingIssue.deletedAt || existingIssue.hidden) {
      await prisma.issue.update({
        where: { id: existingIssue.id },
        data: { deletedAt: null, hidden: false },
        select: { id: true },
      });
      const locale = await getLocale();
      revalidatePath(`/${locale}/scanwords`);
    }
    return { id: String(existingIssue.id) };
  }

  try {
    const created = await prisma.issue.create({
      data: {
        editionId: data.editionId,
        issueNumberId: issueNumber.id,
      },
      select: { id: true },
    });
    const locale = await getLocale();
    revalidatePath(`/${locale}/scanwords`);
    return { id: String(created.id) };
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const retry = await prisma.issue.findUnique({
        where: {
          editionId_issueNumberId: {
            editionId: data.editionId,
            issueNumberId: issueNumber.id,
          },
        },
        select: { id: true, deletedAt: true, hidden: true },
      });
      if (retry) {
        if (retry.deletedAt || retry.hidden) {
          await prisma.issue.update({
            where: { id: retry.id },
            data: { deletedAt: null, hidden: false },
            select: { id: true },
          });
        }
        const locale = await getLocale();
        revalidatePath(`/${locale}/scanwords`);
        return { id: String(retry.id) };
      }
      throw actionError("DUPLICATE_ISSUE", 409);
    }
    throw e;
  }
}

export async function updateIssueTemplateAction(input: z.infer<typeof issueTemplateSchema>) {
  await ensureScanwordsAccess();
  const data = issueTemplateSchema.parse(input);
  const issueId = BigInt(data.issueId);

  await prisma.issue.update({
    where: { id: issueId },
    data: { filterTemplateId: data.templateId },
    select: { id: true },
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
}

export async function updateEditionHiddenAction(input: z.infer<typeof editionVisibilitySchema>) {
  await ensureScanwordsAccess();
  const data = editionVisibilitySchema.parse(input);
  await prisma.edition.update({
    where: { id: data.id },
    data: { hidden: data.hidden },
    select: { id: true },
  });
  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
}

export async function updateIssueHiddenAction(input: z.infer<typeof issueVisibilitySchema>) {
  await ensureScanwordsAccess();
  const data = issueVisibilitySchema.parse(input);
  const issueId = BigInt(data.id);
  await prisma.issue.update({
    where: { id: issueId },
    data: { hidden: data.hidden },
    select: { id: true },
  });
  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
}

export async function deleteEditionAction(input: z.infer<typeof editionDeleteSchema>) {
  await ensureScanwordsAccess();
  const data = editionDeleteSchema.parse(input);
  await prisma.edition.update({
    where: { id: data.id },
    data: { deletedAt: new Date(), hidden: true },
    select: { id: true },
  });
  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
}

export async function deleteIssueAction(input: z.infer<typeof issueDeleteSchema>) {
  await ensureScanwordsAccess();
  const data = issueDeleteSchema.parse(input);
  const issueId = BigInt(data.id);
  await prisma.issue.update({
    where: { id: issueId },
    data: { deletedAt: new Date(), hidden: true },
    select: { id: true },
  });
  const locale = await getLocale();
  revalidatePath(`/${locale}/scanwords`);
}

export async function saveScanwordUploadSnapshotAction(input: z.infer<typeof uploadSnapshotSchema>) {
  await ensureScanwordsAccess();
  const data = uploadSnapshotSchema.parse(input);
  const issueId = BigInt(data.issueId);
  const cutoff = snapshotCutoffDate();
  const templateSetup = normalizeTemplateSetupPayload(data.templateSetup);
  await prisma.scanwordUploadSnapshot.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });

  try {
    await prisma.scanwordUploadSnapshot.upsert({
      where: { issueId },
      update: {
        templateId: data.templateId ?? null,
        templateName: data.templateName ?? null,
        fileCount: data.fileCount,
        errorCount: data.errors.length,
        neededStats: data.neededStats ?? Prisma.JsonNull,
        templateSetup: templateSetup ?? Prisma.JsonNull,
        files: data.files,
        errors: data.errors,
      },
      create: {
        issueId,
        templateId: data.templateId ?? null,
        templateName: data.templateName ?? null,
        fileCount: data.fileCount,
        errorCount: data.errors.length,
        neededStats: data.neededStats ?? Prisma.JsonNull,
        templateSetup: templateSetup ?? Prisma.JsonNull,
        files: data.files,
        errors: data.errors,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    await prisma.scanwordUploadSnapshot.upsert({
      where: { issueId },
      update: {
        templateId: data.templateId ?? null,
        templateName: data.templateName ?? null,
        fileCount: data.fileCount,
        errorCount: data.errors.length,
        neededStats: data.neededStats ?? Prisma.JsonNull,
        files: data.files,
        errors: data.errors,
      },
      create: {
        issueId,
        templateId: data.templateId ?? null,
        templateName: data.templateName ?? null,
        fileCount: data.fileCount,
        errorCount: data.errors.length,
        neededStats: data.neededStats ?? Prisma.JsonNull,
        files: data.files,
        errors: data.errors,
      },
      select: { id: true },
    });
  }
}

export async function getScanwordUploadSnapshotAction(input: z.infer<typeof uploadSnapshotLoadSchema>) {
  await ensureScanwordsAccess();
  const data = uploadSnapshotLoadSchema.parse(input);
  const issueId = BigInt(data.issueId);
  const cutoff = snapshotCutoffDate();
  await prisma.scanwordUploadSnapshot.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });

  let snapshot:
    | {
        templateId: number | null;
        templateName: string | null;
        fileCount: number;
        errorCount: number;
        neededStats: Prisma.JsonValue | null;
        templateSetup: Prisma.JsonValue | null;
        files: Prisma.JsonValue;
        errors: Prisma.JsonValue;
        updatedAt: Date;
      }
    | {
        templateId: number | null;
        templateName: string | null;
        fileCount: number;
        errorCount: number;
        neededStats: Prisma.JsonValue | null;
        files: Prisma.JsonValue;
        errors: Prisma.JsonValue;
        updatedAt: Date;
      }
    | null = null;

  try {
    snapshot = await prisma.scanwordUploadSnapshot.findUnique({
      where: { issueId },
      select: {
        templateId: true,
        templateName: true,
        fileCount: true,
        errorCount: true,
        neededStats: true,
        templateSetup: true,
        files: true,
        errors: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    snapshot = await prisma.scanwordUploadSnapshot.findUnique({
      where: { issueId },
      select: {
        templateId: true,
        templateName: true,
        fileCount: true,
        errorCount: true,
        neededStats: true,
        files: true,
        errors: true,
        updatedAt: true,
      },
    });
  }

  if (!snapshot) return null;

  const files = snapshotFilesSchema.safeParse(snapshot.files);
  const errors = snapshotErrorsSchema.safeParse(snapshot.errors);
  const neededStats = snapshotNeededStatsSchema.safeParse(snapshot.neededStats ?? {});
  const templateSetup = normalizeTemplateSetupPayload("templateSetup" in snapshot ? snapshot.templateSetup : null);

  return {
    templateId: snapshot.templateId,
    templateName: snapshot.templateName,
    fileCount: snapshot.fileCount,
    errorCount: snapshot.errorCount,
    files: files.success ? files.data : [],
    errors: errors.success ? errors.data : [],
    neededStats: neededStats.success ? neededStats.data : null,
    templateSetup,
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export async function saveScanwordTemplateSetupAction(input: z.infer<typeof templateSetupSaveSchema>) {
  await ensureScanwordsAccess();
  const data = templateSetupSaveSchema.parse(input);
  const issueId = BigInt(data.issueId);
  const templateSetup = normalizeTemplateSetupPayload(data.templateSetup);
  try {
    await prisma.scanwordUploadSnapshot.upsert({
      where: { issueId },
      update: {
        templateSetup: templateSetup ?? Prisma.JsonNull,
      },
      create: {
        issueId,
        fileCount: 0,
        errorCount: 0,
        templateSetup: templateSetup ?? Prisma.JsonNull,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    await prisma.scanwordUploadSnapshot.upsert({
      where: { issueId },
      update: {},
      create: {
        issueId,
        fileCount: 0,
        errorCount: 0,
      },
      select: { id: true },
    });
  }
}

export async function getScanwordTemplateSetupPreviewAction(
  input: z.infer<typeof uploadSnapshotLoadSchema>,
): Promise<TemplateSetupPreviewPayload | null> {
  await ensureScanwordsAccess();
  const data = uploadSnapshotLoadSchema.parse(input);
  const issueId = BigInt(data.issueId);
  const snapshot = await getScanwordUploadSnapshotAction({ issueId: data.issueId });
  if (!snapshot?.files?.length) return null;

  const samplesDir = await resolveIssueSamplesDir(issueId);
  if (!samplesDir) return null;

  const setupByKey = new Map((snapshot.templateSetup?.templates ?? []).map((item) => [item.templateKey, item]));
  const templates: TemplateSetupPreviewTemplate[] = [];

  for (const [order, file] of snapshot.files.entries()) {
    const filePath = path.join(samplesDir, sanitizeName(file.name));
    const buffer = await readFile(filePath);
    const grid = parseFshBytes(buffer);
    validate(grid);
    const slotScan = scanSlotsDetailed(grid);
    const photoAreaBoundsBySlotId = buildPhotoAreaBoundsBySlotId(grid, slotScan.slots, grid.data, new Map());
    const slots: TemplateSetupPreviewSlot[] = slotScan.slots.map((slot) => ({
      slotId: slot.id,
      r: slot.r,
      c: slot.c,
      dir: slot.dir.dr === 0 ? "right" : "down",
      len: slot.len,
      cells: slot.cells,
      startNumber: slotScan.startNumberBySlotId.get(slot.id) ?? null,
      isPhotoDefinition: photoAreaBoundsBySlotId.has(slot.id),
      photoAreaBounds: photoAreaBoundsBySlotId.get(slot.id) ?? null,
    }));
    const arrows = await buildPreviewArrows(grid);
    const key = file.key;
    templates.push({
      key,
      name: path.basename(file.name, path.extname(file.name)) || file.name,
      sourceName: file.name,
      order,
      grid,
      slots,
      startPositions: slotScan.starts,
      cells: buildPreviewCells(slots),
      arrows,
      setup: setupByKey.get(key) ?? null,
    });
  }

  return {
    issueId: data.issueId,
    templates,
    templateSetup: normalizeTemplateSetupPayload({
      version: 1,
      templates: templates
        .map((template) => template.setup)
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    }),
    updatedAt: snapshot.updatedAt,
  };
}

export async function getScanwordFillArchivesAction(input: z.infer<typeof fillArchivesLoadSchema>) {
  await ensureScanwordsAccess();
  const data = fillArchivesLoadSchema.parse(input);
  const issueId = BigInt(data.issueId);
  try {
    const rows = await prisma.scanwordFillJob.findMany({
      where: {
        issueId,
        outputPath: { not: null },
      },
      orderBy: { id: "desc" },
      select: {
        id: true,
        status: true,
        completedTemplates: true,
        totalTemplates: true,
        outputPath: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const archives: Array<{
      id: string;
      archiveKey: string;
      archiveFileName: string | null;
      status: FillJobStatus;
      completedTemplates: number | null;
      totalTemplates: number | null;
      createdAt: string | null;
      updatedAt: string | null;
    }> = [];

    for (const row of rows) {
      const jobId = String(row.id);
      const status = normalizeFillArchiveStatus(row.status);
      const completedTemplates = toIntOrNull(row.completedTemplates);
      const totalTemplates = toIntOrNull(row.totalTemplates);
      const createdAt = row.createdAt.toISOString();
      const fallbackUpdatedAt = row.updatedAt.toISOString();
      const outputPath = row.outputPath;
      const fallbackArchiveFileName = outputPath ? path.basename(outputPath) : null;

      if (outputPath) {
        const versions = await readArchiveVersionFiles(jobId, outputPath);
        if (versions.length > 0) {
          for (const version of versions) {
            archives.push({
              id: jobId,
              archiveKey: `${jobId}:${version.fileName}`,
              archiveFileName: version.fileName,
              status,
              completedTemplates,
              totalTemplates,
              createdAt,
              updatedAt: version.updatedAt ? version.updatedAt.toISOString() : fallbackUpdatedAt,
            });
          }
          continue;
        }
      }

      archives.push({
        id: jobId,
        archiveKey: `${jobId}:${fallbackArchiveFileName ?? fallbackUpdatedAt}`,
        archiveFileName: fallbackArchiveFileName,
        status,
        completedTemplates,
        totalTemplates,
        createdAt,
        updatedAt: fallbackUpdatedAt,
      });
    }

    return archives;
  } catch (err: unknown) {
    if (isMissingTableError(err)) {
      return [];
    }
    if (isMissingColumnError(err)) {
      try {
        const rows = await prisma.scanwordFillJob.findMany({
          where: {
            issueId,
            outputPath: { not: null },
          },
          orderBy: { id: "desc" },
          select: {
            id: true,
            status: true,
            outputPath: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        const archives: Array<{
          id: string;
          archiveKey: string;
          archiveFileName: string | null;
          status: FillJobStatus;
          completedTemplates: null;
          totalTemplates: null;
          createdAt: string | null;
          updatedAt: string | null;
        }> = [];
        for (const row of rows) {
          const jobId = String(row.id);
          const status = normalizeFillArchiveStatus(row.status);
          const createdAt = row.createdAt.toISOString();
          const fallbackUpdatedAt = row.updatedAt.toISOString();
          const outputPath = row.outputPath;
          const fallbackArchiveFileName = outputPath ? path.basename(outputPath) : null;

          if (outputPath) {
            const versions = await readArchiveVersionFiles(jobId, outputPath);
            if (versions.length > 0) {
              for (const version of versions) {
                archives.push({
                  id: jobId,
                  archiveKey: `${jobId}:${version.fileName}`,
                  archiveFileName: version.fileName,
                  status,
                  completedTemplates: null,
                  totalTemplates: null,
                  createdAt,
                  updatedAt: version.updatedAt ? version.updatedAt.toISOString() : fallbackUpdatedAt,
                });
              }
              continue;
            }
          }

          archives.push({
            id: jobId,
            archiveKey: `${jobId}:${fallbackArchiveFileName ?? fallbackUpdatedAt}`,
            archiveFileName: fallbackArchiveFileName,
            status,
            completedTemplates: null,
            totalTemplates: null,
            createdAt,
            updatedAt: fallbackUpdatedAt,
          });
        }
        return archives;
      } catch (fallbackErr) {
        if (isMissingTableError(fallbackErr)) {
          return [];
        }
        if (isMissingColumnError(fallbackErr)) {
          // Older schema can lack recently-added columns. Return no archives instead of throwing.
          return [];
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export async function listScanwordSvgFontsAction() {
  await ensureScanwordsAccess();
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        displayName: string;
        familyName: string;
        format: string;
        mimeType: string;
        fileName: string;
        sha256: string;
        sizeBytes: bigint;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "displayName",
        "familyName",
        "format",
        "mimeType",
        "fileName",
        "sha256",
        "sizeBytes",
        "createdAt",
        "updatedAt"
      FROM "public"."scanword_svg_fonts"
      ORDER BY "displayName" ASC, "id" DESC
    `);
    return rows.map((row) => ({
      id: String(row.id),
      displayName: row.displayName,
      familyName: row.familyName,
      format: row.format,
      mimeType: row.mimeType,
      fileName: row.fileName,
      sha256: row.sha256,
      sizeBytes: Number(row.sizeBytes),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getScanwordIssueSvgSettingsAction(input: z.infer<typeof issueSvgSettingsLoadSchema>) {
  await ensureScanwordsAccess();
  const data = issueSvgSettingsLoadSchema.parse(input);
  const issueId = BigInt(data.issueId);
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        clueFontBasePt: number;
        clueFontMinPt: number;
        clueGlyphWidthPct: number | null;
        clueLineHeightPct: number | null;
        fontId: bigint | null;
        systemFontFamily: string | null;
      }>
    >(Prisma.sql`
      SELECT
        "clueFontBasePt",
        "clueFontMinPt",
        "clueGlyphWidthPct",
        "clueLineHeightPct",
        "fontId",
        "systemFontFamily"
      FROM "public"."scanword_issue_svg_settings"
      WHERE "issueId" = ${issueId}
      LIMIT 1
    `);
    const settings = rows[0] ?? null;
    if (!settings) return defaultIssueSvgSettings();
    return {
      clueFontBasePt: settings.clueFontBasePt,
      clueFontMinPt: Math.min(settings.clueFontMinPt, settings.clueFontBasePt),
      clueGlyphWidthPct: settings.clueGlyphWidthPct ?? DEFAULT_SVG_TYPOGRAPHY_PERCENT,
      clueLineHeightPct: settings.clueLineHeightPct ?? DEFAULT_SVG_TYPOGRAPHY_PERCENT,
      fontId: settings.fontId ? String(settings.fontId) : null,
      systemFontFamily: normalizeSystemFontFamily(settings.systemFontFamily),
    };
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
      return defaultIssueSvgSettings();
    }
    throw error;
  }
}

export async function saveScanwordIssueSvgSettingsAction(input: z.infer<typeof issueSvgSettingsSchema>) {
  await ensureScanwordsAccess();
  const data = issueSvgSettingsSchema.parse(input);
  const issueId = BigInt(data.issueId);
  const fontId = data.fontId ? BigInt(data.fontId) : null;
  const clueFontBasePt = Math.max(SVG_FONT_PT_MIN, Math.min(SVG_FONT_PT_MAX, data.clueFontBasePt));
  const clueFontMinPtRaw = Math.max(SVG_FONT_PT_MIN, Math.min(SVG_FONT_PT_MAX, data.clueFontMinPt));
  const clueFontMinPt = Math.min(clueFontMinPtRaw, clueFontBasePt);
  const clueGlyphWidthPct = Math.max(
    SVG_TYPOGRAPHY_PERCENT_MIN,
    Math.min(SVG_TYPOGRAPHY_PERCENT_MAX, Math.trunc(data.clueGlyphWidthPct)),
  );
  const clueLineHeightPct = Math.max(
    SVG_TYPOGRAPHY_PERCENT_MIN,
    Math.min(SVG_TYPOGRAPHY_PERCENT_MAX, Math.trunc(data.clueLineHeightPct)),
  );
  const systemFontFamily = normalizeSystemFontFamily(data.systemFontFamily ?? DEFAULT_SVG_SYSTEM_FONT_FAMILY);

  if (fontId != null) {
    const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
      SELECT "id"
      FROM "public"."scanword_svg_fonts"
      WHERE "id" = ${fontId}
      LIMIT 1
    `);
    const font = rows[0] ?? null;
    if (!font) {
      throw actionError("SVG_FONT_NOT_FOUND", 404);
    }
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "public"."scanword_issue_svg_settings"
      ("issueId", "clueFontBasePt", "clueFontMinPt", "clueGlyphWidthPct", "clueLineHeightPct", "fontId", "systemFontFamily", "updatedAt")
    VALUES
      (${issueId}, ${clueFontBasePt}, ${clueFontMinPt}, ${clueGlyphWidthPct}, ${clueLineHeightPct}, ${fontId}, ${systemFontFamily}, NOW())
    ON CONFLICT ("issueId")
    DO UPDATE SET
      "clueFontBasePt" = EXCLUDED."clueFontBasePt",
      "clueFontMinPt" = EXCLUDED."clueFontMinPt",
      "clueGlyphWidthPct" = EXCLUDED."clueGlyphWidthPct",
      "clueLineHeightPct" = EXCLUDED."clueLineHeightPct",
      "fontId" = EXCLUDED."fontId",
      "systemFontFamily" = EXCLUDED."systemFontFamily",
      "updatedAt" = NOW()
  `);

  const rows = await prisma.$queryRaw<
    Array<{
      clueFontBasePt: number;
      clueFontMinPt: number;
      clueGlyphWidthPct: number | null;
      clueLineHeightPct: number | null;
      fontId: bigint | null;
      systemFontFamily: string | null;
    }>
  >(Prisma.sql`
    SELECT
      "clueFontBasePt",
      "clueFontMinPt",
      "clueGlyphWidthPct",
      "clueLineHeightPct",
      "fontId",
      "systemFontFamily"
    FROM "public"."scanword_issue_svg_settings"
    WHERE "issueId" = ${issueId}
    LIMIT 1
  `);
  const settings = rows[0];
  if (!settings) {
    throw actionError("SVG_SETTINGS_SAVE_FAILED", 500);
  }

  return {
    clueFontBasePt: settings.clueFontBasePt,
    clueFontMinPt: settings.clueFontMinPt,
    clueGlyphWidthPct: settings.clueGlyphWidthPct ?? DEFAULT_SVG_TYPOGRAPHY_PERCENT,
    clueLineHeightPct: settings.clueLineHeightPct ?? DEFAULT_SVG_TYPOGRAPHY_PERCENT,
    fontId: settings.fontId ? String(settings.fontId) : null,
    systemFontFamily: normalizeSystemFontFamily(settings.systemFontFamily),
  };
}

export async function getScanwordFillSettingsAction(input: z.infer<typeof fillSettingsLoadSchema>) {
  const session = await ensureScanwordsAccess();
  const userIdRaw = (session?.user as { id?: string | null } | null)?.id ?? null;
  const userId = userIdRaw ? Number(userIdRaw) : NaN;
  if (!Number.isFinite(userId)) {
    throw actionError("UNAUTHORIZED", 401);
  }
  const data = fillSettingsLoadSchema.parse(input);
  const issueId = BigInt(data.issueId);
  try {
    const settings = await prisma.scanwordFillSettings.findUnique({
      where: { userId_issueId: { userId, issueId } },
      select: {
        speedPreset: true,
        definitionMaxPerCell: true,
        definitionMaxPerHalfCell: true,
      },
    });
    if (!settings) return null;
    return {
      speedPreset: settings.speedPreset,
      definitionMaxPerCell: settings.definitionMaxPerCell,
      definitionMaxPerHalfCell: settings.definitionMaxPerHalfCell,
    };
  } catch (error) {
    if (!isScanwordFillSettingsCompoundKeyValidationError(error)) {
      throw error;
    }
    const rows = await prisma.$queryRaw<
      Array<{
        speedPreset: string;
        definitionMaxPerCell: number | null;
        definitionMaxPerHalfCell: number | null;
      }>
    >`SELECT "speedPreset", "definitionMaxPerCell", "definitionMaxPerHalfCell"
      FROM "public"."scanword_fill_settings"
      WHERE "userId" = ${userId} AND "issueId" = ${issueId}
      ORDER BY "id" DESC
      LIMIT 1`;
    const fallbackSettings = rows[0];
    if (!fallbackSettings) return null;
    return {
      speedPreset: fallbackSettings.speedPreset,
      definitionMaxPerCell: fallbackSettings.definitionMaxPerCell ?? 30,
      definitionMaxPerHalfCell: fallbackSettings.definitionMaxPerHalfCell ?? 15,
    };
  }
}

export async function saveScanwordFillSettingsAction(input: z.infer<typeof fillSettingsSchema>) {
  const session = await ensureScanwordsAccess();
  const userIdRaw = (session?.user as { id?: string | null } | null)?.id ?? null;
  const userId = userIdRaw ? Number(userIdRaw) : NaN;
  if (!Number.isFinite(userId)) {
    throw actionError("UNAUTHORIZED", 401);
  }
  const data = fillSettingsSchema.parse(input);
  const issueId = BigInt(data.issueId);
  try {
    const settings = await prisma.scanwordFillSettings.upsert({
      where: { userId_issueId: { userId, issueId } },
      update: {
        speedPreset: data.speedPreset,
        definitionMaxPerCell: data.definitionMaxPerCell,
        definitionMaxPerHalfCell: data.definitionMaxPerHalfCell,
      },
      create: {
        userId,
        issueId,
        speedPreset: data.speedPreset,
        definitionMaxPerCell: data.definitionMaxPerCell,
        definitionMaxPerHalfCell: data.definitionMaxPerHalfCell,
      },
      select: {
        speedPreset: true,
        definitionMaxPerCell: true,
        definitionMaxPerHalfCell: true,
      },
    });
    return settings;
  } catch (error) {
    if (!isScanwordFillSettingsCompoundKeyValidationError(error)) {
      throw error;
    }
    const rows = await prisma.$queryRaw<
      Array<{
        speedPreset: string;
        definitionMaxPerCell: number | null;
        definitionMaxPerHalfCell: number | null;
      }>
    >`INSERT INTO "public"."scanword_fill_settings" (
        "userId",
        "issueId",
        "speedPreset",
        "definitionMaxPerCell",
        "definitionMaxPerHalfCell"
      )
      VALUES (
        ${userId},
        ${issueId},
        ${data.speedPreset},
        ${data.definitionMaxPerCell},
        ${data.definitionMaxPerHalfCell}
      )
      ON CONFLICT ("userId", "issueId")
      DO UPDATE SET
        "speedPreset" = EXCLUDED."speedPreset",
        "definitionMaxPerCell" = EXCLUDED."definitionMaxPerCell",
        "definitionMaxPerHalfCell" = EXCLUDED."definitionMaxPerHalfCell",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "speedPreset", "definitionMaxPerCell", "definitionMaxPerHalfCell"`;
    const fallbackSettings = rows[0];
    if (!fallbackSettings) {
      throw new Error("Failed to persist scanword fill settings");
    }
    return {
      speedPreset: fallbackSettings.speedPreset,
      definitionMaxPerCell: fallbackSettings.definitionMaxPerCell ?? data.definitionMaxPerCell,
      definitionMaxPerHalfCell: fallbackSettings.definitionMaxPerHalfCell ?? data.definitionMaxPerHalfCell,
    };
  }
}
