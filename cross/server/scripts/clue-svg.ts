import ruHyphen from "hyphen/ru";
import type { ClueLayout } from "../src/utils/clues";
import { COREL_UNITS_PER_MM } from "./svg-theme";
import { estimateTextWidth } from "./text-position";
import type { TextWidthMeasure } from "./svg-font-metrics";

type ClueRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const CLUE_FONT_BASE_PT = 9;
export const CLUE_FONT_MIN_PT = 8;
export const CLUE_GLYPH_WIDTH_SCALE = 0.8;
export const CLUE_LINE_HEIGHT_SCALE = 0.8;
export const CLUE_EDGE_INSET_MM = 0.35;
export const CLUE_TEXT_ASCENT_RATIO = 0.9;
export const CLUE_TEXT_DESCENT_RATIO = 0.2;
export const CLUE_PLAQUE_TEXT_INSET_MM = 1;
export const PHOTO_CLUE_PLAQUE_HEIGHT_MM = 3.5;
export const CLUE_TEXT_WIDTH_SAFETY_FACTOR = 1.07;
export const CLUE_DISPLAY_DASH = "-";
export const CLUE_LETTER_SPACING_MIN_PX = -0.9;
const CLUE_GLYPH_WIDTH_FALLBACK_RATIO = 0.65;
const CLUE_GLYPH_WIDTH_FALLBACK_MIN_SCALE = 0.63;
const MM_PER_PT = 25.4 / 72;
const PX_PER_MM = 96 / 25.4;
export const MIN_CLUE_FONT_SIZE = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
const MIN_COREL_CLUE_FONT_SIZE = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "corel");
const CLUE_MAX_LINES = 4;

type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WordSplitResult = {
  lines: string[];
  isValid: boolean;
};

type WrapResult = {
  lines: string[];
  isValid: boolean;
};

type WrapToken = {
  text: string;
  separatorBefore: "" | " ";
  isProtected: boolean;
};

type LayoutCandidate = {
  breakWords: boolean;
  wrapResult: WrapResult;
  lines: string[];
  lineWidths: number[];
};

export function convertCluePtToSvgUnits(pt: number, mode: "default" | "corel"): number {
  if (mode === "corel") {
    return Math.round(pt * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000;
  }
  return Math.round((pt * 96) / 72 * 1000) / 1000;
}

export function resolveMinClueFontSize(mode: "default" | "corel"): number {
  return mode === "corel" ? MIN_COREL_CLUE_FONT_SIZE : MIN_CLUE_FONT_SIZE;
}

function convertMmToSvgUnits(mm: number, mode: "default" | "corel"): number {
  if (mode === "corel") return Math.round(mm * COREL_UNITS_PER_MM * 1000) / 1000;
  return Math.round(mm * PX_PER_MM * 1000) / 1000;
}

function normalizeScale(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function estimateScaledLineWidth(
  line: string,
  fontSize: number,
  glyphWidthScale: number,
  measureTextWidth: TextWidthMeasure
): number {
  return Math.round(Math.max(1, measureTextWidth(line, fontSize) * glyphWidthScale) * 1000) / 1000;
}

function fitsLineWidth(
  line: string,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  measureTextWidth: TextWidthMeasure
): boolean {
  return estimateScaledLineWidth(line, fontSize, glyphWidthScale, measureTextWidth) <= availableWidth + 0.0001;
}

function resolveLineHeight(fontSize: number, lineHeightScale: number): number {
  return fontSize * lineHeightScale;
}

function insetRect(rect: LayoutRect, inset: number): LayoutRect {
  const clampedInset = Math.max(0, inset);
  const width = Math.max(1, rect.width - clampedInset * 2);
  const height = Math.max(1, rect.height - clampedInset * 2);
  return {
    x: rect.x + clampedInset,
    y: rect.y + clampedInset,
    width,
    height,
  };
}

function clampRectToBounds(rect: LayoutRect, bounds: LayoutRect): LayoutRect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    x: Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - width)),
    y: Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - height)),
    width,
    height,
  };
}

function buildUniformScaleTransform(anchorX: number, glyphWidthScale: number): string {
  const inverseAnchorX = Math.round(-anchorX * 1000) / 1000;
  return ` transform="translate(${anchorX} 0) scale(${glyphWidthScale} 1) translate(${inverseAnchorX} 0)"`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const HYPHENATION_SEPARATOR = "\u00AD";
const NON_BREAKING_SPACE = "\u00A0";
const PROTECTED_INLINE_PATTERN = /\.{3,}|№(?:\u00A0)?\d+/gu;
const PROTECTED_NUMBER_PATTERN = /^№(?:\u00A0)?\d+$/u;
const LOWER_EXTENDING_GLYPH_PATTERN = /[УуДдФфЦцЩщрgjpqyQ]/u;
const HIGH_GLYPH_PATTERN = /[А-ЯЁA-Z0-9№бйёdfhkl"]/u;
const ADAPTIVE_LINE_HEIGHT_SCALE = 1;
const ADAPTIVE_GLYPH_OVERLAP_DISTANCE = 0.18;
const QUOTE_NORMALIZATION_MAP: Record<string, string> = {
  "«": '"',
  "»": '"',
  "“": '"',
  "”": '"',
  "„": '"',
};
const COMPOUND_WORD_SEPARATOR_PATTERN = /[-‐‑‒–—−]/u;

function normalizeDisplayPunctuation(text: string): string {
  return text.replace(/[«»“”„]/g, (ch) => QUOTE_NORMALIZATION_MAP[ch] ?? ch);
}

function startsWithDisallowedLineBreakChar(text: string): boolean {
  return /^[ЬьЪъЫы]/u.test(text);
}

function normalizeWrapText(text: string): string {
  return normalizeDisplayPunctuation(text)
    .replace(/№[ \t\r\n\f\v]+(?=\d)/gu, `№${NON_BREAKING_SPACE}`)
    .replace(/[ \t\r\n\f\v]+/g, " ")
    .trim();
}

function isProtectedToken(text: string): boolean {
  return /^\.{3,}$/u.test(text) || PROTECTED_NUMBER_PATTERN.test(text);
}

function tokenizeWrapText(text: string): WrapToken[] {
  const clean = normalizeWrapText(text);
  if (!clean) return [];

  const tokens: WrapToken[] = [];
  const chunks = clean.split(" ");
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex] ?? "";
    if (!chunk) continue;
    let hasTokenInChunk = false;

    const appendToken = (value: string): void => {
      if (!value) return;
      tokens.push({
        text: value,
        separatorBefore: hasTokenInChunk ? "" : tokens.length > 0 && chunkIndex > 0 ? " " : "",
        isProtected: isProtectedToken(value),
      });
      hasTokenInChunk = true;
    };

    let offset = 0;
    for (const match of chunk.matchAll(PROTECTED_INLINE_PATTERN)) {
      const matchIndex = match.index ?? offset;
      appendToken(chunk.slice(offset, matchIndex));
      appendToken(match[0] ?? "");
      offset = matchIndex + (match[0]?.length ?? 0);
    }
    appendToken(chunk.slice(offset));
  }
  return tokens;
}

function needsAdaptiveLineSpacing(upperLine: string, lowerLine: string): boolean {
  const collectPositions = (line: string, pattern: RegExp): number[] => {
    const chars = [...line];
    if (!chars.length) return [];
    return chars.flatMap((char, idx) =>
      pattern.test(char) ? [(idx + 0.5) / chars.length] : []
    );
  };
  const lowerExtendingPositions = collectPositions(upperLine, LOWER_EXTENDING_GLYPH_PATTERN);
  const highGlyphPositions = collectPositions(lowerLine, HIGH_GLYPH_PATTERN);
  return lowerExtendingPositions.some((upperPosition) =>
    highGlyphPositions.some(
      (lowerPosition) => Math.abs(upperPosition - lowerPosition) <= ADAPTIVE_GLYPH_OVERLAP_DISTANCE
    )
  );
}

function resolveLineAdvances(lines: string[], fontSize: number, lineHeightScale: number): number[] {
  const baseLineHeight = resolveLineHeight(fontSize, lineHeightScale);
  const adaptiveLineHeight = fontSize * ADAPTIVE_LINE_HEIGHT_SCALE;
  const advances: number[] = [];
  for (let idx = 1; idx < lines.length; idx += 1) {
    advances.push(
      needsAdaptiveLineSpacing(lines[idx - 1] ?? "", lines[idx] ?? "")
        ? Math.max(baseLineHeight, adaptiveLineHeight)
        : baseLineHeight
    );
  }
  return advances;
}

function resolveTextBlockHeight(lines: string[], fontSize: number, lineHeightScale: number): number {
  const inkHeight = fontSize * (CLUE_TEXT_ASCENT_RATIO + CLUE_TEXT_DESCENT_RATIO);
  if (lines.length <= 1) return inkHeight;
  return inkHeight + resolveLineAdvances(lines, fontSize, lineHeightScale).reduce((sum, value) => sum + value, 0);
}

function splitLongWord(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  measureTextWidth: TextWidthMeasure
): string[] {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) return [word];
  if (maxChars < 2) return [...word];
  const parts: string[] = [];
  let i = 0;
  while (
    word.length - i > maxChars ||
    !fitsLineWidth(word.slice(i), availableWidth, fontSize, glyphWidthScale, measureTextWidth)
  ) {
    let take = Math.max(1, maxChars - 1);
    const remaining = word.length - (i + take);
    if (remaining > 0 && remaining < 2 && take > 2) {
      take -= 2 - remaining;
    }
    while (take > 2 && startsWithDisallowedLineBreakChar(word.slice(i + take))) {
      take -= 1;
    }
    while (
      take > 1 &&
      !fitsLineWidth(`${word.slice(i, i + take)}${CLUE_DISPLAY_DASH}`, availableWidth, fontSize, glyphWidthScale, measureTextWidth)
    ) {
      take -= 1;
    }
    parts.push(`${word.slice(i, i + take)}${CLUE_DISPLAY_DASH}`);
    i += take;
  }
  if (i < word.length) parts.push(word.slice(i));
  return parts;
}

function splitWordWithHyphenation(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  measureTextWidth: TextWidthMeasure
): WordSplitResult {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
    return { lines: [word], isValid: true };
  }
  if (maxChars < 2) return { lines: [word], isValid: false };
  const parts = ruHyphen
    .hyphenateSync(word, { hyphenChar: HYPHENATION_SEPARATOR })
    .split(HYPHENATION_SEPARATOR);
  if (parts.length <= 1) return { lines: [word], isValid: false };

  const breaks: number[] = [];
  let offset = 0;
  for (let i = 0; i < parts.length - 1; i += 1) {
    offset += parts[i]?.length ?? 0;
    if (offset > 0) breaks.push(offset);
  }

  const lines: string[] = [];
  let start = 0;
  const countLetters = (value: string): number => {
    let count = 0;
    for (const ch of value) {
      if (/\p{L}/u.test(ch)) count += 1;
    }
    return count;
  };
  while (
    word.length - start > maxChars ||
    !fitsLineWidth(word.slice(start), availableWidth, fontSize, glyphWidthScale, measureTextWidth)
  ) {
    const limit = maxChars - 1;
    let breakPos = -1;
    for (const pos of breaks) {
      const tailLetters = countLetters(word.slice(pos));
      if (
        pos > start &&
        pos - start <= limit &&
        tailLetters >= 2 &&
        fitsLineWidth(
          `${word.slice(start, pos)}${CLUE_DISPLAY_DASH}`,
          availableWidth,
          fontSize,
          glyphWidthScale,
          measureTextWidth
        )
      ) {
        breakPos = pos;
      }
    }
    if (breakPos === -1) {
      return { lines: [word], isValid: false };
    }
    lines.push(`${word.slice(start, breakPos)}${CLUE_DISPLAY_DASH}`);
    start = breakPos;
  }
  if (start < word.length) {
    const tail = word.slice(start);
    if (!fitsLineWidth(tail, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      return { lines: [word], isValid: false };
    }
    lines.push(tail);
  }
  return { lines, isValid: true };
}

function splitWordByExistingCompoundSeparator(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  measureTextWidth: TextWidthMeasure
): WordSplitResult {
  if (!COMPOUND_WORD_SEPARATOR_PATTERN.test(word)) return { lines: [word], isValid: true };
  const parts = word.split(/([-‐‑‒–—−])/u);
  if (parts.length <= 2) return { lines: [word], isValid: true };

  const lines: string[] = [];
  let current = parts[0] ?? "";
  let isValid = true;

  for (let idx = 1; idx < parts.length; idx += 2) {
    const separator = parts[idx] ?? "";
    const part = parts[idx + 1] ?? "";
    const combined = current ? `${current}${separator}${part}` : part;
    if (fitsLineWidth(combined, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      current = combined;
      continue;
    }

    if (current.length > maxChars || !fitsLineWidth(current, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      const splitCurrent = splitWordWithHyphenation(current, maxChars, availableWidth, fontSize, glyphWidthScale, measureTextWidth);
      if (!splitCurrent.isValid) {
        isValid = false;
        return { lines: [word], isValid };
      }
      if (splitCurrent.lines.length > 1) {
        lines.push(...splitCurrent.lines.slice(0, -1));
        current = splitCurrent.lines[splitCurrent.lines.length - 1] ?? "";
      } else {
        current = splitCurrent.lines[0] ?? current;
      }
    }

    if (current) {
      lines.push(`${current}${separator}`);
    }
    current = part;

    if (current.length > maxChars || !fitsLineWidth(current, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      const split = splitWordWithHyphenation(current, maxChars, availableWidth, fontSize, glyphWidthScale, measureTextWidth);
      if (!split.isValid) {
        isValid = false;
        return { lines: [word], isValid };
      }
      if (split.lines.length > 1) {
        lines.push(...split.lines.slice(0, -1));
        current = split.lines[split.lines.length - 1] ?? "";
      } else {
        current = split.lines[0] ?? current;
      }
    }
  }

  if (current) lines.push(current);
  return { lines, isValid: isValid && lines.every((line) => fitsLineWidth(line, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) };
}

function splitWord(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  breakWords: boolean,
  measureTextWidth: TextWidthMeasure
): WordSplitResult {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
    return { lines: [word], isValid: true };
  }
  if (!breakWords) return { lines: [word], isValid: false };
  if (COMPOUND_WORD_SEPARATOR_PATTERN.test(word)) {
    return splitWordByExistingCompoundSeparator(word, maxChars, availableWidth, fontSize, glyphWidthScale, measureTextWidth);
  }
  if (!/\p{L}/u.test(word)) {
    return {
      lines: splitLongWord(word, maxChars, availableWidth, fontSize, glyphWidthScale, measureTextWidth),
      isValid: true,
    };
  }
  return splitWordWithHyphenation(word, maxChars, availableWidth, fontSize, glyphWidthScale, measureTextWidth);
}

function wrapText(
  text: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  breakWords: boolean,
  measureTextWidth: TextWidthMeasure
): WrapResult {
  const tokens = tokenizeWrapText(text);
  if (!tokens.length) return { lines: [], isValid: true };
  const lines: string[] = [];
  let line = "";
  let isValid = true;

  const appendSplitWord = (word: string, isProtected: boolean): void => {
    if (isProtected) {
      line = word;
      isValid = false;
      return;
    }
    const splitLines = splitWord(word, maxChars, availableWidth, fontSize, glyphWidthScale, breakWords, measureTextWidth);
    if (!splitLines.isValid) isValid = false;
    if (!splitLines.lines.length) return;
    lines.push(...splitLines.lines.slice(0, -1));
    line = splitLines.lines[splitLines.lines.length - 1] ?? "";
  };

  for (const token of tokens) {
    const word = token.text;
    if (!line) {
      if (!fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
        appendSplitWord(word, token.isProtected);
        continue;
      }
      line = word;
      continue;
    }

    const joinedLine = `${line}${token.separatorBefore}${word}`;
    if (fitsLineWidth(joinedLine, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      line = joinedLine;
      continue;
    }

    lines.push(line);
    if (!fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale, measureTextWidth)) {
      appendSplitWord(word, token.isProtected);
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return { lines, isValid };
}

export function buildClueTextMap(
  layouts: ClueLayout[]
): Map<string, ClueLayout> {
  const out = new Map<string, ClueLayout>();
  for (const layout of layouts) {
    const text = layout.text.trim();
    if (!text) continue;
    out.set(layout.key, {
      ...layout,
      text,
      areaCells: [...layout.areaCells],
      slotIds: [...layout.slotIds],
    });
  }
  return out;
}

export function resolveClueRenderLayout(
  layout: Pick<ClueLayout, "areaCells" | "clusterCells">
): {
  definitionAreaCells: Array<[number, number]>;
  isExpandedDefinition: boolean;
  isClusterDefinition: boolean;
} {
  const definitionAreaCells = [...layout.areaCells];
  const isExpandedDefinition = definitionAreaCells.length > 1;
  const hasAttachedClusterCells =
    (layout.clusterCells?.length ?? 0) > 1 &&
    definitionAreaCells.some(([areaRow, areaCol]) =>
      (layout.clusterCells ?? []).some(([clusterRow, clusterCol]) => clusterRow === areaRow && clusterCol === areaCol)
    );
  return {
    definitionAreaCells,
    isExpandedDefinition,
    isClusterDefinition: isExpandedDefinition || (!isExpandedDefinition && hasAttachedClusterCells),
  };
}

function resolveAreaRects(
  x: number,
  y: number,
  cell: number,
  areaCells: Array<[number, number]> | undefined,
  anchorCell: [number, number] | undefined
): ClueRect[] {
  if (!areaCells?.length || !anchorCell) {
    return [{ x, y, width: cell, height: cell }];
  }

  const [anchorRow, anchorCol] = anchorCell;
  const byKey = new Map<string, ClueRect>();
  for (const [row, col] of areaCells) {
    const rectX = x + (col - anchorCol) * cell;
    const rectY = y + (row - anchorRow) * cell;
    const key = `${rectX},${rectY}`;
    if (byKey.has(key)) continue;
    byKey.set(key, { x: rectX, y: rectY, width: cell, height: cell });
  }

  const rects = [...byKey.values()];
  if (!rects.length) {
    return [{ x, y, width: cell, height: cell }];
  }
  return rects;
}

export function renderClueText(
  x: number,
  y: number,
  cell: number,
  fontSize: number,
  text: string,
  clipId: string,
  fill = "#000",
  options: {
    mode?: "default" | "corel";
    areaCells?: Array<[number, number]>;
    anchorCell?: [number, number];
    textAlign?: "center" | "bottom-left";
    background?: "none" | "text-block";
    backgroundInset?: number;
    backgroundAnchor?: "auto" | "bottom-left";
    plaqueTextInset?: number;
    plaqueHeight?: number;
    frame?: "none" | "rect";
    frameWidth?: number;
    clusterFrame?: "none" | "top-right";
    clusterPadding?: number;
    clusterBorderWidth?: number;
    minFontSize?: number;
    glyphWidthScale?: number;
    lineHeightScale?: number;
    measureTextWidth?: TextWidthMeasure;
  } = {}
): { defs: string; text: string } {
  const mode = options.mode ?? "default";
  const textAlign = options.textAlign ?? "center";
  const background = options.background ?? "none";
  const backgroundAnchor = options.backgroundAnchor ?? "auto";
  const plaqueTextInset = Math.max(0, options.plaqueTextInset ?? 0);
  const plaqueHeight = Math.max(0, options.plaqueHeight ?? 0);
  const frame = options.frame ?? "none";
  const frameWidth = Math.max(0, options.frameWidth ?? 0);
  const clusterFrame = options.clusterFrame ?? "none";
  const clusterPadding = Math.max(0, options.clusterPadding ?? 0);
  const clusterBorderWidth = Math.max(0, options.clusterBorderWidth ?? 0);
  const glyphWidthScale = normalizeScale(options.glyphWidthScale, CLUE_GLYPH_WIDTH_SCALE);
  const measureTextWidth = options.measureTextWidth ?? estimateTextWidth;
  let effectiveGlyphWidthScale = glyphWidthScale;
  const lineHeightScale = normalizeScale(options.lineHeightScale, CLUE_LINE_HEIGHT_SCALE);
  const alignBottomLeft = textAlign === "bottom-left";
  const areaRects = resolveAreaRects(x, y, cell, options.areaCells, options.anchorCell);
  const minX = Math.min(...areaRects.map((rect) => rect.x));
  const minY = Math.min(...areaRects.map((rect) => rect.y));
  const maxX = Math.max(...areaRects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...areaRects.map((rect) => rect.y + rect.height));
  const layoutWidth = Math.max(1, maxX - minX);
  const layoutHeight = Math.max(1, maxY - minY);
  const edgeInset = convertMmToSvgUnits(CLUE_EDGE_INSET_MM, mode);
  const padding = 1 + edgeInset;
  const normalized = normalizeWrapText(text);
  const minFontSizeOverride = Number.isFinite(options.minFontSize)
    ? Math.max(1, Number(options.minFontSize))
    : null;
  const minFontSize = Math.min(minFontSizeOverride ?? resolveMinClueFontSize(mode), fontSize);
  const layoutRect: LayoutRect = { x: minX, y: minY, width: layoutWidth, height: layoutHeight };
  const safeRect = insetRect(layoutRect, padding);
  const textSafeRect =
    plaqueHeight > 0 && backgroundAnchor === "bottom-left"
      ? {
          ...safeRect,
          y: layoutRect.y + layoutRect.height - Math.min(layoutRect.height, plaqueHeight),
          height: Math.min(layoutRect.height, plaqueHeight),
        }
      : clusterFrame === "top-right" ? insetRect(safeRect, clusterPadding) : safeRect;
  const availableWidth = Math.max(1, textSafeRect.width);
  const safeAvailableWidth = availableWidth / CLUE_TEXT_WIDTH_SAFETY_FACTOR;
  const wrappingWidth = safeAvailableWidth;
  const availableHeight = Math.max(1, textSafeRect.height);
  let currentSize = Math.max(fontSize, minFontSize);
  const fontShrinkStep = Math.max(0.01, convertCluePtToSvgUnits(0.1, mode));
  let lineHeight = resolveLineHeight(currentSize, lineHeightScale);
  let maxChars = Math.max(1, Math.floor(wrappingWidth / Math.max(1, currentSize * 0.3 * effectiveGlyphWidthScale)));
  let maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
  let maxLines = Math.min(CLUE_MAX_LINES, maxLinesByHeight);
  let wrapResult = wrapText(
    normalized,
    maxChars,
    wrappingWidth,
    currentSize,
    effectiveGlyphWidthScale,
    false,
    measureTextWidth
  );
  let lines = wrapResult.lines;
  let lineWidths = lines.map((line) =>
    estimateScaledLineWidth(line, currentSize, effectiveGlyphWidthScale, measureTextWidth)
  );

  const buildCandidate = (breakWords: boolean): LayoutCandidate => {
    const candidateWrap = wrapText(
      normalized,
      maxChars,
      wrappingWidth,
      currentSize,
      effectiveGlyphWidthScale,
      breakWords,
      measureTextWidth
    );
    const candidateLines = candidateWrap.lines;
    const candidateWidths = candidateLines.map((line) =>
      estimateScaledLineWidth(line, currentSize, effectiveGlyphWidthScale, measureTextWidth)
    );
    return {
      breakWords,
      wrapResult: candidateWrap,
      lines: candidateLines,
      lineWidths: candidateWidths,
    };
  };

  const isCandidateValid = (candidate: LayoutCandidate): boolean =>
    candidate.wrapResult.isValid &&
    candidate.lines.length <= maxLines &&
    resolveTextBlockHeight(candidate.lines, currentSize, lineHeightScale) <= availableHeight + 0.0001 &&
    candidate.lineWidths.every((width) => width <= safeAvailableWidth + 0.0001);

  const chooseCandidate = (): LayoutCandidate => {
    const plain = buildCandidate(false);
    const hyphenated = buildCandidate(true);
    const plainValid = isCandidateValid(plain);
    const hyphenatedValid = isCandidateValid(hyphenated);
    if (plainValid) return plain;
    if (hyphenatedValid) return hyphenated;
    return hyphenated.wrapResult.isValid ? hyphenated : plain;
  };

  const recalcLayout = () => {
    lineHeight = resolveLineHeight(currentSize, lineHeightScale);
    maxChars = Math.max(
      1,
      Math.floor(wrappingWidth / Math.max(1, currentSize * 0.3 * effectiveGlyphWidthScale))
    );
    maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
    maxLines = Math.min(CLUE_MAX_LINES, maxLinesByHeight);
    const chosen = chooseCandidate();
    wrapResult = chosen.wrapResult;
    lines = chosen.lines;
    lineWidths = chosen.lineWidths;
  };

  const linesFitBounds = () =>
    wrapResult.isValid &&
    lines.length <= maxLines &&
    resolveTextBlockHeight(lines, currentSize, lineHeightScale) <= availableHeight + 0.0001 &&
    lineWidths.every((width) => width <= safeAvailableWidth + 0.0001);

  const shrinkUntil = (targetSize: number) => {
    while (!linesFitBounds() && currentSize > targetSize) {
      currentSize = Math.max(
        targetSize,
        Math.round((currentSize - fontShrinkStep) * 1000) / 1000
      );
      recalcLayout();
    }
  };
  const fallbackMinGlyphWidthScale = Math.min(
    glyphWidthScale,
    Math.max(CLUE_GLYPH_WIDTH_FALLBACK_MIN_SCALE, glyphWidthScale * CLUE_GLYPH_WIDTH_FALLBACK_RATIO)
  );
  const fitCurrentFontSize = (): boolean => {
    effectiveGlyphWidthScale = glyphWidthScale;
    recalcLayout();
    while (!linesFitBounds() && effectiveGlyphWidthScale > fallbackMinGlyphWidthScale) {
      effectiveGlyphWidthScale = Math.max(
        fallbackMinGlyphWidthScale,
        Math.round((effectiveGlyphWidthScale - 0.01) * 1000) / 1000
      );
      recalcLayout();
    }
    return linesFitBounds();
  };

  let foundPreferredFit = fitCurrentFontSize();
  while (!foundPreferredFit && currentSize > minFontSize) {
    currentSize = Math.max(
      minFontSize,
      Math.round((currentSize - fontShrinkStep) * 1000) / 1000
    );
    foundPreferredFit = fitCurrentFontSize();
  }

  if (!linesFitBounds()) {
    const protectedTokens = tokenizeWrapText(normalized).filter((token) => token.isProtected);
    const widestProtectedToken = protectedTokens.reduce(
      (widest, token) => Math.max(widest, measureTextWidth(token.text, currentSize)),
      0
    );
    if (widestProtectedToken > 0) {
      const requiredScale = Math.min(
        effectiveGlyphWidthScale,
        Math.max(0.01, (safeAvailableWidth - 0.001) / widestProtectedToken)
      );
      if (requiredScale < effectiveGlyphWidthScale) {
        effectiveGlyphWidthScale = requiredScale;
        recalcLayout();
      }
    }
  }

  if (!linesFitBounds()) shrinkUntil(1);

  const resolveLetterSpacingEm = (candidateGlyphWidthScale: number): number | null => {
    const minimumLetterSpacingSvgUnits =
      mode === "corel"
        ? (CLUE_LETTER_SPACING_MIN_PX / PX_PER_MM) * COREL_UNITS_PER_MM
        : CLUE_LETTER_SPACING_MIN_PX;
    const minimumLetterSpacingEm =
      minimumLetterSpacingSvgUnits / (currentSize * Math.sqrt(candidateGlyphWidthScale));
    let requiredSpacingEm = 0;
    for (const line of lines) {
      const baseWidth = measureTextWidth(line, currentSize);
      if (baseWidth * candidateGlyphWidthScale <= safeAvailableWidth + 0.0001) continue;
      const gaps = Math.max(0, [...line].length - 1);
      if (gaps === 0) return null;
      requiredSpacingEm = Math.min(
        requiredSpacingEm,
        (safeAvailableWidth / candidateGlyphWidthScale - baseWidth) / (gaps * currentSize)
      );
    }
    return requiredSpacingEm >= minimumLetterSpacingEm - 0.0001
      ? Math.max(minimumLetterSpacingEm, requiredSpacingEm)
      : null;
  };

  let displayGlyphWidthScale = glyphWidthScale;
  let letterSpacingEm = resolveLetterSpacingEm(displayGlyphWidthScale);
  while (letterSpacingEm === null && displayGlyphWidthScale > effectiveGlyphWidthScale) {
    displayGlyphWidthScale = Math.max(
      effectiveGlyphWidthScale,
      Math.round((displayGlyphWidthScale - 0.01) * 1000) / 1000
    );
    letterSpacingEm = resolveLetterSpacingEm(displayGlyphWidthScale);
  }
  if (letterSpacingEm === null) letterSpacingEm = 0;
  effectiveGlyphWidthScale = displayGlyphWidthScale;
  const letterSpacing = Math.round(currentSize * letterSpacingEm * 1000) / 1000;
  lineWidths = lines.map((line) => {
    const gaps = Math.max(0, [...line].length - 1);
    return Math.max(1, (measureTextWidth(line, currentSize) + gaps * letterSpacing) * effectiveGlyphWidthScale);
  });
  const letterSpacingAttribute = letterSpacing < -0.0001 ? ` letter-spacing="${letterSpacing}"` : "";

  const lineAdvances = resolveLineAdvances(lines, currentSize, lineHeightScale);
  const textBlockHeight = resolveTextBlockHeight(lines, currentSize, lineHeightScale);
  const offsetY = Math.max(0, (availableHeight - textBlockHeight) / 2);
  const textTopY = textSafeRect.y + offsetY;
  const textBlockWidth = Math.max(1, ...lineWidths);
  let textX = alignBottomLeft ? textSafeRect.x : textSafeRect.x + textSafeRect.width / 2;
  let textY = textTopY;
  let textAnchor: "start" | "middle" = alignBottomLeft ? "start" : "middle";
  const backgroundPadX = Math.max(1, Math.round(currentSize * 0.14));
  const backgroundPadY = Math.max(1, Math.round(currentSize * 0.08));
  const textBlockLeftX = alignBottomLeft ? textX : textX - textBlockWidth / 2;
  let backgroundX = textBlockLeftX - backgroundPadX;
  let backgroundY = textTopY - backgroundPadY;
  let backgroundWidth = textBlockWidth + backgroundPadX * 2;
  let backgroundHeight = textBlockHeight + backgroundPadY * 2;

  if (background === "text-block") {
    const boundaryInset = Math.max(padding, Math.max(0, options.backgroundInset ?? 0));
    const backgroundBounds = insetRect(layoutRect, boundaryInset);
    const clampedBackground = clampRectToBounds(
      { x: backgroundX, y: backgroundY, width: backgroundWidth, height: backgroundHeight },
      backgroundBounds
    );
    backgroundX = clampedBackground.x;
    backgroundY = clampedBackground.y;
    backgroundWidth = clampedBackground.width;
    backgroundHeight = clampedBackground.height;

    if (backgroundAnchor === "bottom-left") {
      backgroundWidth = Math.min(layoutRect.width, textBlockWidth + plaqueTextInset * 2);
      backgroundHeight = Math.min(
        layoutRect.height,
        plaqueHeight > 0 ? plaqueHeight : textBlockHeight + plaqueTextInset * 2
      );
      backgroundX = layoutRect.x;
      backgroundY = layoutRect.y + layoutRect.height - backgroundHeight;
      textX = backgroundX + backgroundWidth / 2;
      textY = backgroundY + Math.max(0, (backgroundHeight - textBlockHeight) / 2);
      if (plaqueHeight > 0) textY -= currentSize * 0.07;
      textAnchor = "middle";
    } else if (clusterFrame === "top-right") {
      backgroundWidth = Math.min(layoutRect.width, textBlockWidth + clusterPadding * 2);
      backgroundHeight = Math.min(layoutRect.height, textBlockHeight + clusterPadding * 2);
      backgroundX = layoutRect.x;
      backgroundY = layoutRect.y + layoutRect.height - backgroundHeight;
      textX = backgroundX + clusterPadding;
      textY = backgroundY + Math.max(0, backgroundHeight - textBlockHeight - clusterPadding);
      textAnchor = "start";
    }
  }

  const backgroundRect =
    background === "text-block"
      ? `<rect x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" fill="#fff"/>`
      : "";
  const frameLeft = backgroundX + (plaqueHeight > 0 ? 0 : frameWidth / 2);
  const frameTop = backgroundY + frameWidth / 2;
  const frameRightEdge = backgroundX + backgroundWidth - frameWidth / 2;
  const frameBottomEdge = backgroundY + backgroundHeight - (plaqueHeight > 0 ? 0 : frameWidth / 2);
  const frameRect =
    frame === "rect" && frameWidth > 0
      ? `<rect x="${frameLeft}" y="${frameTop}" width="${Math.max(0, frameRightEdge - frameLeft)}" height="${Math.max(0, frameBottomEdge - frameTop)}" fill="none" stroke="${fill}" stroke-width="${frameWidth}"/>`
      : "";
  const frameRight = backgroundX + backgroundWidth;
  const frameBottom = backgroundY + backgroundHeight;
  const frameInset = clusterBorderWidth / 2;
  const frameTopY = backgroundY + frameInset;
  const frameLeftX = backgroundX + frameInset;
  const frameRightX = frameRight - frameInset;
  const frameBottomY = frameBottom - frameInset;
  const clusterFrameSvg =
    clusterFrame === "top-right" && clusterBorderWidth > 0
      ? `<line x1="${frameLeftX}" y1="${frameTopY}" x2="${frameRightX}" y2="${frameTopY}" stroke="${fill}" stroke-width="${clusterBorderWidth}" stroke-linecap="square"/><line x1="${frameRightX}" y1="${frameTopY}" x2="${frameRightX}" y2="${frameBottomY}" stroke="${fill}" stroke-width="${clusterBorderWidth}" stroke-linecap="square"/><line x1="${frameLeftX}" y1="${frameBottomY}" x2="${frameRightX}" y2="${frameBottomY}" stroke="${fill}" stroke-width="${clusterBorderWidth}" stroke-linecap="square"/><line x1="${frameLeftX}" y1="${frameTopY}" x2="${frameLeftX}" y2="${frameBottomY}" stroke="${fill}" stroke-width="${clusterBorderWidth}" stroke-linecap="square"/>`
      : "";

  const useClip = mode !== "corel";
  const defs = useClip
    ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${areaRects
        .map((rect) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"/>`)
        .join("")}</clipPath>`
    : "";

  if (mode === "corel") {
    const ascent = currentSize * CLUE_TEXT_ASCENT_RATIO;
    const descent = currentSize * CLUE_TEXT_DESCENT_RATIO;
    const visualHeight = ascent + descent;
    const lineTopOffset = Math.max(0, (lineHeight - visualHeight) / 2);
    const baseY = Math.round((textY + lineTopOffset + ascent) * 10) / 10;
    const scaleTransform = buildUniformScaleTransform(textX, effectiveGlyphWidthScale);
    let cumulativeLineAdvance = 0;
    const textLines = lines
      .map((line, idx) => {
        if (idx > 0) cumulativeLineAdvance += lineAdvances[idx - 1] ?? lineHeight;
        const lineY = Math.round((baseY + cumulativeLineAdvance) * 10) / 10;
        return `<text x="${textX}" y="${lineY}" font-size="${currentSize}"${letterSpacingAttribute} text-anchor="${textAnchor}" dominant-baseline="alphabetic" fill="${fill}">${escapeXml(line)}</text>`;
      })
      .join("");
    const textSvg = useClip
      ? `<g clip-path="url(#${clipId})">${backgroundRect}${frameRect}${clusterFrameSvg}<g${scaleTransform}>${textLines}</g></g>`
      : `<g>${backgroundRect}${frameRect}${clusterFrameSvg}<g${scaleTransform}>${textLines}</g></g>`;
    return { defs, text: textSvg };
  }

  const tspan = lines
    .map((line, idx) => {
      const dy = idx === 0 ? 0 : (lineAdvances[idx - 1] ?? lineHeight);
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const textNode = `<text x="${textX}" y="${textY}" font-size="${currentSize}"${letterSpacingAttribute} text-anchor="${textAnchor}" dominant-baseline="hanging" fill="${fill}"${buildUniformScaleTransform(textX, effectiveGlyphWidthScale)}>${tspan}</text>`;
  const textSvg = useClip
    ? `<g clip-path="url(#${clipId})">${backgroundRect}${frameRect}${clusterFrameSvg}${textNode}</g>`
    : `<g>${backgroundRect}${frameRect}${clusterFrameSvg}${textNode}</g>`;

  return { defs, text: textSvg };
}
