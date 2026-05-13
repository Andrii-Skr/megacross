import type { DictionaryTemplateItem, FilterStats } from "@/types/dictionary-templates";
import type { Edition, Issue } from "../types";

export type WorkspaceTab = "dictionary" | "upload" | "conflicts" | "templateSetup" | "generation";

export type FillJobStatus = "queued" | "running" | "review" | "done" | "error";

export type FillTemplateStatus = {
  key?: string | null;
  name: string;
  status: "pending" | "running" | "done" | "error";
  error?: string | null;
  order?: number | null;
  sourceName?: string | null;
};

export type FillArchiveItem = {
  id: string;
  archiveKey: string;
  archiveFileName: string | null;
  status: FillJobStatus;
  completedTemplates: number | null;
  totalTemplates: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FillJobState = {
  id: string;
  status: FillJobStatus;
  progress: number;
  currentTemplate?: string | null;
  completedTemplates?: number | null;
  totalTemplates?: number | null;
  error?: string | null;
  templates?: FillTemplateStatus[] | null;
  archiveReady?: boolean | null;
};

export type FillReviewDefinitionOption = {
  opredId: string | null;
  text: string;
  difficulty: number | null;
};

export type FillReviewIntersection = {
  slotId: number;
  index: number;
  otherIndex: number;
  row: number;
  col: number;
  letter: string;
};

export type FillReviewSlot = {
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
  definitionOptions: FillReviewDefinitionOption[];
  isPhotoDefinition?: boolean | null;
  intersections: FillReviewIntersection[];
  clueCell: { key: string; row: number; col: number } | null;
  startNumber?: number | null;
};

export type FillReviewStartPosition = {
  number: number;
  r: number;
  c: number;
  dir: "down" | "right";
  slotId: number;
};

export type FillReviewTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  path: string;
  language: string;
  langId: number | null;
  grid: {
    rows: number;
    cols: number;
    data: string[];
    marker: string;
    codes: number[][];
  };
  slots: FillReviewSlot[];
  clueGroups: Array<{
    key: string;
    row: number;
    col: number;
    slotIds: number[];
    areaCellCount?: number;
  }>;
  startPositions?: FillReviewStartPosition[];
  keyword?: FillTemplateKeyword | null;
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
  templates: FillReviewTemplate[];
};

export type TemplateSetupFixedSlot = {
  slotId: number;
  wordId: string;
  word: string;
};

export type TemplateSetupTemplate = {
  templateKey: string;
  keyword: string | null;
  fixedSlots: TemplateSetupFixedSlot[];
};

export type TemplateSetupPayload = {
  version: 1;
  templates: TemplateSetupTemplate[];
};

export type TemplateSetupPreviewCell = {
  row: number;
  col: number;
  isIntersection: boolean;
  slotIds: number[];
};

export type TemplateSetupPreviewArrow = {
  row: number;
  col: number;
  markup: string;
};

export type TemplateSetupPreviewSlot = {
  slotId: number;
  r: number;
  c: number;
  dir: "down" | "right";
  len: number;
  cells: [number, number][];
  startNumber: number | null;
};

export type TemplateSetupPreviewTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  grid: {
    rows: number;
    cols: number;
    data: string[];
    marker: string;
    codes: number[][];
  };
  slots: TemplateSetupPreviewSlot[];
  startPositions: FillReviewStartPosition[];
  cells: TemplateSetupPreviewCell[];
  arrows: TemplateSetupPreviewArrow[];
  setup: TemplateSetupTemplate | null;
};

export type TemplateSetupPreviewPayload = {
  issueId: string;
  templates: TemplateSetupPreviewTemplate[];
  templateSetup: TemplateSetupPayload | null;
  updatedAt: string | null;
};

export type FillTemplateKeywordCell = {
  row: number;
  col: number;
  index: number;
};

export type FillTemplateKeyword = {
  text: string;
  cells: FillTemplateKeywordCell[];
};

export type FillMaskCandidate = {
  wordId: string;
  word: string;
  definitions: FillReviewDefinitionOption[];
};

export type FillFinalizePayload = {
  templates: Array<{
    key: string;
    slots: Array<{
      slotId: number;
      word: string;
      definition: string;
      wordId: string | null;
      opredId: string | null;
    }>;
  }>;
  definitionLimits?: FillDefinitionLimits;
  svgTypography?: FillSvgTypography;
};

export type FillSpeedPreset = "fast" | "medium" | "slow";

export type FillDefinitionLimits = {
  maxPerCell: number;
  maxPerHalfCell: number;
};

export type FillSvgTypography = {
  clueFontBasePt: number;
  clueFontMinPt: number;
  clueGlyphWidthPct: number;
  clueLineHeightPct: number;
  fontId: string | null;
  systemFontFamily: string;
};

export type SvgFontItem = {
  id: string;
  displayName: string;
  familyName: string;
  format: string;
  mimeType: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type FillSettings = {
  speedPreset: FillSpeedPreset;
  definitionMaxPerCell: number;
  definitionMaxPerHalfCell: number;
  clueFontBasePt: number;
  clueFontMinPt: number;
  clueGlyphWidthPct: number;
  clueLineHeightPct: number;
  svgFontId: string | null;
  svgSystemFontFamily: string;
};

export type FillSettingsInput = {
  speedPreset?: string | null;
  definitionMaxPerCell?: number | string | null;
  definitionMaxPerHalfCell?: number | string | null;
  clueFontBasePt?: number | string | null;
  clueFontMinPt?: number | string | null;
  clueGlyphWidthPct?: number | string | null;
  clueLineHeightPct?: number | string | null;
  fontId?: string | null;
  svgFontId?: string | null;
  systemFontFamily?: string | null;
  svgSystemFontFamily?: string | null;
} | null;

export type FillSpeedOption = {
  value: FillSpeedPreset;
  label: string;
  maxNodes: number;
};

export type ConflictRow = {
  length: number;
  needed: number;
  available: number;
};

export type FillOverrides = {
  maxNodes: number;
  shuffle: boolean;
  unique: boolean;
  lcv: boolean;
  style: "default" | "corel";
  explainFail: boolean;
  noDefs: boolean;
  requireNative: boolean;
  filterTemplateId?: number;
};

function normalizeTemplateSetupWord(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeTemplateKeyword(value: string | null | undefined): string | null {
  const normalized = normalizeTemplateSetupWord(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeTemplateFixedSlot(value: unknown): TemplateSetupFixedSlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { slotId?: unknown; wordId?: unknown; word?: unknown };
  const slotId = typeof raw.slotId === "number" ? raw.slotId : Number(raw.slotId);
  const wordId = typeof raw.wordId === "string" ? raw.wordId.trim() : "";
  const word = typeof raw.word === "string" ? normalizeTemplateSetupWord(raw.word) : "";
  if (!Number.isFinite(slotId) || slotId < 0 || !wordId || !word) return null;
  return {
    slotId: Math.trunc(slotId),
    wordId,
    word,
  };
}

function normalizeTemplateSetupTemplate(value: unknown): TemplateSetupTemplate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { templateKey?: unknown; keyword?: unknown; fixedSlots?: unknown };
  const templateKey = typeof raw.templateKey === "string" ? raw.templateKey.trim() : "";
  if (!templateKey) return null;
  const bySlotId = new Map<number, TemplateSetupFixedSlot>();
  if (Array.isArray(raw.fixedSlots)) {
    for (const item of raw.fixedSlots) {
      const fixedSlot = normalizeTemplateFixedSlot(item);
      if (!fixedSlot) continue;
      bySlotId.set(fixedSlot.slotId, fixedSlot);
    }
  }
  return {
    templateKey,
    keyword: normalizeTemplateKeyword(typeof raw.keyword === "string" ? raw.keyword : null),
    fixedSlots: [...bySlotId.values()].sort((a, b) => a.slotId - b.slotId),
  };
}

export function normalizeTemplateSetupPayload(value: unknown): TemplateSetupPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { version?: unknown; templates?: unknown };
  const version = raw.version === 1 ? 1 : null;
  if (version !== 1 || !Array.isArray(raw.templates)) return null;
  const byKey = new Map<string, TemplateSetupTemplate>();
  for (const item of raw.templates) {
    const template = normalizeTemplateSetupTemplate(item);
    if (!template) continue;
    if (!template.keyword && template.fixedSlots.length === 0) continue;
    byKey.set(template.templateKey, template);
  }
  return {
    version: 1,
    templates: [...byKey.values()].sort((a, b) => a.templateKey.localeCompare(b.templateKey)),
  };
}

export function mapTemplateSetupByKey(
  payload: TemplateSetupPayload | null | undefined,
): Map<string, TemplateSetupTemplate> {
  const map = new Map<string, TemplateSetupTemplate>();
  for (const template of payload?.templates ?? []) {
    map.set(template.templateKey, template);
  }
  return map;
}

export function buildTemplateSetupPayload(templates: TemplateSetupTemplate[]): TemplateSetupPayload | null {
  return normalizeTemplateSetupPayload({
    version: 1,
    templates,
  });
}

export type ScanwordsWorkspaceProps = {
  selectedEdition: Edition | null;
  selectedIssue: Issue | null;
  templates: DictionaryTemplateItem[];
  selectedTemplateId: number | null;
  templatesLoading: boolean;
  templatesError: boolean;
  stats: FilterStats | null;
  statsLoading: boolean;
  statsError: boolean;
  dictionaryStats: FilterStats | null;
  dictionaryStatsLoading: boolean;
  dictionaryStatsError: boolean;
  onTemplateSelect: (templateId: number) => void;
};

export const SPEED_PRESETS: Record<FillSpeedPreset, { maxNodes: number }> = {
  fast: { maxNodes: 200_000 },
  medium: { maxNodes: 400_000 },
  slow: { maxNodes: 800_000 },
};

export const DEFAULT_DEFINITION_MAX_PER_CELL = 30;
export const DEFAULT_DEFINITION_MAX_PER_HALF_CELL = 15;
export const DEFAULT_SVG_CLUE_FONT_BASE_PT = 9;
export const DEFAULT_SVG_CLUE_FONT_MIN_PT = 7.6;
export const DEFAULT_SVG_TYPOGRAPHY_PERCENT = 80;
export const DEFAULT_SVG_SYSTEM_FONT_FAMILY = "Arial";

export const DEFAULT_FILL_SETTINGS: FillSettings = {
  speedPreset: "fast",
  definitionMaxPerCell: DEFAULT_DEFINITION_MAX_PER_CELL,
  definitionMaxPerHalfCell: DEFAULT_DEFINITION_MAX_PER_HALF_CELL,
  clueFontBasePt: DEFAULT_SVG_CLUE_FONT_BASE_PT,
  clueFontMinPt: DEFAULT_SVG_CLUE_FONT_MIN_PT,
  clueGlyphWidthPct: DEFAULT_SVG_TYPOGRAPHY_PERCENT,
  clueLineHeightPct: DEFAULT_SVG_TYPOGRAPHY_PERCENT,
  svgFontId: null,
  svgSystemFontFamily: DEFAULT_SVG_SYSTEM_FONT_FAMILY,
};

function normalizePositiveInt(
  value: number | string | null | undefined,
  fallback: number,
  min = 1,
  max = 1024,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function normalizePositiveNumber(
  value: number | string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.round(parsed * 1000) / 1000;
}

export function normalizeFillSettings(input?: FillSettingsInput): FillSettings {
  const speed = input?.speedPreset;
  const speedPreset: FillSpeedPreset =
    speed === "fast" || speed === "medium" || speed === "slow" ? speed : DEFAULT_FILL_SETTINGS.speedPreset;
  const definitionMaxPerCell = normalizePositiveInt(
    input?.definitionMaxPerCell,
    DEFAULT_FILL_SETTINGS.definitionMaxPerCell,
  );
  const definitionMaxPerHalfCell = normalizePositiveInt(
    input?.definitionMaxPerHalfCell,
    DEFAULT_FILL_SETTINGS.definitionMaxPerHalfCell,
  );
  const clueFontBasePt = normalizePositiveNumber(input?.clueFontBasePt, DEFAULT_FILL_SETTINGS.clueFontBasePt, 1, 72);
  const clueFontMinPtRaw = normalizePositiveNumber(input?.clueFontMinPt, DEFAULT_FILL_SETTINGS.clueFontMinPt, 1, 72);
  const clueGlyphWidthPct = normalizePositiveInt(
    input?.clueGlyphWidthPct,
    DEFAULT_FILL_SETTINGS.clueGlyphWidthPct,
    40,
    200,
  );
  const clueLineHeightPct = normalizePositiveInt(
    input?.clueLineHeightPct,
    DEFAULT_FILL_SETTINGS.clueLineHeightPct,
    40,
    200,
  );
  const svgFontIdRaw = typeof input?.svgFontId === "string" ? input.svgFontId : input?.fontId;
  const svgFontId = typeof svgFontIdRaw === "string" && svgFontIdRaw.trim().length > 0 ? svgFontIdRaw.trim() : null;
  const svgSystemFontFamilyRaw =
    typeof input?.svgSystemFontFamily === "string" ? input.svgSystemFontFamily : input?.systemFontFamily;
  const svgSystemFontFamily =
    typeof svgSystemFontFamilyRaw === "string" && svgSystemFontFamilyRaw.trim().length > 0
      ? svgSystemFontFamilyRaw.trim().slice(0, 120)
      : DEFAULT_FILL_SETTINGS.svgSystemFontFamily;
  return {
    speedPreset,
    definitionMaxPerCell,
    definitionMaxPerHalfCell: Math.min(definitionMaxPerHalfCell, definitionMaxPerCell),
    clueFontBasePt,
    clueFontMinPt: Math.min(clueFontMinPtRaw, clueFontBasePt),
    clueGlyphWidthPct,
    clueLineHeightPct,
    svgFontId,
    svgSystemFontFamily,
  };
}
