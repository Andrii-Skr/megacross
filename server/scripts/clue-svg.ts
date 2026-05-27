import ruHyphen from "hyphen/ru";
import type { ClueLayout } from "../src/utils/clues";
import { COREL_UNITS_PER_MM } from "./svg-theme";
import { estimateTextWidth } from "./text-position";

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
export const CLUE_EDGE_INSET_MM = 0.1;
export const CLUE_TEXT_ASCENT_RATIO = 0.64;
export const CLUE_TEXT_DESCENT_RATIO = 0.16;
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

function estimateScaledLineWidth(line: string, fontSize: number, glyphWidthScale: number): number {
  return Math.round(Math.max(1, estimateTextWidth(line, fontSize) * glyphWidthScale) * 1000) / 1000;
}

function fitsLineWidth(line: string, availableWidth: number, fontSize: number, glyphWidthScale: number): boolean {
  return estimateScaledLineWidth(line, fontSize, glyphWidthScale) <= availableWidth + 0.0001;
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
const QUOTE_NORMALIZATION_MAP: Record<string, string> = {
  "«": '"',
  "»": '"',
  "“": '"',
  "”": '"',
  "„": '"',
};

function normalizeDisplayPunctuation(text: string): string {
  return text
    .replace(/[«»“”„]/g, (ch) => QUOTE_NORMALIZATION_MAP[ch] ?? ch)
    .replace(/[‐‑‒–—−]/g, "-");
}

function startsWithDisallowedLineBreakChar(text: string): boolean {
  return /^[ЬьЪъЫы]/u.test(text);
}

function splitLongWord(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number
): string[] {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale)) return [word];
  if (maxChars < 2) return [...word];
  const parts: string[] = [];
  let i = 0;
  while (
    word.length - i > maxChars ||
    !fitsLineWidth(word.slice(i), availableWidth, fontSize, glyphWidthScale)
  ) {
    let take = Math.max(1, maxChars - 1);
    const remaining = word.length - (i + take);
    if (remaining > 0 && remaining < 2 && take > 2) {
      take -= 2 - remaining;
    }
    while (take > 2 && startsWithDisallowedLineBreakChar(word.slice(i + take))) {
      take -= 1;
    }
    while (take > 1 && !fitsLineWidth(`${word.slice(i, i + take)}-`, availableWidth, fontSize, glyphWidthScale)) {
      take -= 1;
    }
    parts.push(`${word.slice(i, i + take)}-`);
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
  glyphWidthScale: number
): WordSplitResult {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale)) {
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
    !fitsLineWidth(word.slice(start), availableWidth, fontSize, glyphWidthScale)
  ) {
    const limit = maxChars - 1;
    let breakPos = -1;
    for (const pos of breaks) {
      const tailLetters = countLetters(word.slice(pos));
      if (
        pos > start &&
        pos - start <= limit &&
        tailLetters >= 2 &&
        fitsLineWidth(`${word.slice(start, pos)}-`, availableWidth, fontSize, glyphWidthScale)
      ) {
        breakPos = pos;
      }
    }
    if (breakPos === -1) {
      return { lines: [word], isValid: false };
    }
    lines.push(`${word.slice(start, breakPos)}-`);
    start = breakPos;
  }
  if (start < word.length) {
    const tail = word.slice(start);
    if (!fitsLineWidth(tail, availableWidth, fontSize, glyphWidthScale)) {
      return { lines: [word], isValid: false };
    }
    lines.push(tail);
  }
  return { lines, isValid: true };
}

function splitWordByExistingHyphen(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number
): WordSplitResult {
  if (!word.includes("-")) return { lines: [word], isValid: true };
  const parts = word.split("-");
  if (parts.length <= 1) return { lines: [word], isValid: true };

  const lines: string[] = [];
  let current = parts[0] ?? "";
  let isValid = true;

  for (let idx = 1; idx < parts.length; idx += 1) {
    const part = parts[idx] ?? "";
    const combined = current ? `${current}-${part}` : part;
    if (fitsLineWidth(combined, availableWidth, fontSize, glyphWidthScale)) {
      current = combined;
      continue;
    }

    if (current.length > maxChars || !fitsLineWidth(current, availableWidth, fontSize, glyphWidthScale)) {
      const splitCurrent = splitWordWithHyphenation(current, maxChars, availableWidth, fontSize, glyphWidthScale);
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
      lines.push(`${current}-`);
    }
    current = part;

    if (current.length > maxChars || !fitsLineWidth(current, availableWidth, fontSize, glyphWidthScale)) {
      const split = splitWordWithHyphenation(current, maxChars, availableWidth, fontSize, glyphWidthScale);
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
  return { lines, isValid: isValid && lines.every((line) => fitsLineWidth(line, availableWidth, fontSize, glyphWidthScale)) };
}

function splitWord(
  word: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  breakWords: boolean
): WordSplitResult {
  if (word.length <= maxChars && fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale)) {
    return { lines: [word], isValid: true };
  }
  if (!breakWords) return { lines: [word], isValid: false };
  if (word.includes("-")) return splitWordByExistingHyphen(word, maxChars, availableWidth, fontSize, glyphWidthScale);
  if (!/\p{L}/u.test(word)) {
    return {
      lines: splitLongWord(word, maxChars, availableWidth, fontSize, glyphWidthScale),
      isValid: true,
    };
  }
  return splitWordWithHyphenation(word, maxChars, availableWidth, fontSize, glyphWidthScale);
}

function wrapText(
  text: string,
  maxChars: number,
  availableWidth: number,
  fontSize: number,
  glyphWidthScale: number,
  breakWords: boolean
): WrapResult {
  const clean = normalizeDisplayPunctuation(text).replace(/\s+/g, " ").trim();
  if (!clean) return { lines: [], isValid: true };
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  let isValid = true;

  const appendSplitWord = (word: string): void => {
    const splitLines = splitWord(word, maxChars, availableWidth, fontSize, glyphWidthScale, breakWords);
    if (!splitLines.isValid) isValid = false;
    if (!splitLines.lines.length) return;
    lines.push(...splitLines.lines.slice(0, -1));
    line = splitLines.lines[splitLines.lines.length - 1] ?? "";
  };

  for (const word of words) {
    if (!line) {
      if (!fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale)) {
        appendSplitWord(word);
        continue;
      }
      line = word;
      continue;
    }

    const joinedLine = `${line} ${word}`;
    if (fitsLineWidth(joinedLine, availableWidth, fontSize, glyphWidthScale)) {
      line = joinedLine;
      continue;
    }

    lines.push(line);
    if (!fitsLineWidth(word, availableWidth, fontSize, glyphWidthScale)) {
      appendSplitWord(word);
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
    clusterFrame?: "none" | "top-right";
    clusterPadding?: number;
    clusterBorderWidth?: number;
    minFontSize?: number;
    glyphWidthScale?: number;
    lineHeightScale?: number;
  } = {}
): { defs: string; text: string } {
  const mode = options.mode ?? "default";
  const textAlign = options.textAlign ?? "center";
  const background = options.background ?? "none";
  const clusterFrame = options.clusterFrame ?? "none";
  const clusterPadding = Math.max(0, options.clusterPadding ?? 0);
  const clusterBorderWidth = Math.max(0, options.clusterBorderWidth ?? 0);
  const glyphWidthScale = normalizeScale(options.glyphWidthScale, CLUE_GLYPH_WIDTH_SCALE);
  const lineHeightScale = normalizeScale(options.lineHeightScale, CLUE_LINE_HEIGHT_SCALE);
  const alignBottomLeft = textAlign === "bottom-left";
  const areaRects = resolveAreaRects(x, y, cell, options.areaCells, options.anchorCell);
  const isMultiCellArea = areaRects.length > 1;
  const minX = Math.min(...areaRects.map((rect) => rect.x));
  const minY = Math.min(...areaRects.map((rect) => rect.y));
  const maxX = Math.max(...areaRects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...areaRects.map((rect) => rect.y + rect.height));
  const layoutWidth = Math.max(1, maxX - minX);
  const layoutHeight = Math.max(1, maxY - minY);
  const edgeInset = convertMmToSvgUnits(CLUE_EDGE_INSET_MM, mode);
  const padding = 1 + edgeInset;
  const normalized = text.replace(/\s+/g, " ").trim();
  const minFontSizeOverride = Number.isFinite(options.minFontSize)
    ? Math.max(1, Number(options.minFontSize))
    : null;
  const minFontSize = Math.min(minFontSizeOverride ?? resolveMinClueFontSize(mode), fontSize);
  const layoutRect: LayoutRect = { x: minX, y: minY, width: layoutWidth, height: layoutHeight };
  const safeRect = insetRect(layoutRect, padding);
  const textSafeRect =
    clusterFrame === "top-right" ? insetRect(safeRect, clusterPadding) : safeRect;
  const availableWidth = Math.max(1, textSafeRect.width);
  const availableHeight = Math.max(1, textSafeRect.height);
  let currentSize = Math.max(fontSize, minFontSize);
  let lineHeight = resolveLineHeight(currentSize, lineHeightScale);
  let maxChars = Math.max(1, Math.floor(availableWidth / Math.max(1, currentSize * 0.3 * glyphWidthScale)));
  let maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
  let maxLines = isMultiCellArea ? maxLinesByHeight : Math.min(CLUE_MAX_LINES, maxLinesByHeight);
  let wrapResult = wrapText(normalized, maxChars, availableWidth, currentSize, glyphWidthScale, false);
  let lines = wrapResult.lines;
  let lineWidths = lines.map((line) => estimateScaledLineWidth(line, currentSize, glyphWidthScale));

  const buildCandidate = (breakWords: boolean): LayoutCandidate => {
    const candidateWrap = wrapText(normalized, maxChars, availableWidth, currentSize, glyphWidthScale, breakWords);
    const candidateLines = candidateWrap.lines;
    const candidateWidths = candidateLines.map((line) =>
      estimateScaledLineWidth(line, currentSize, glyphWidthScale)
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
    candidate.lineWidths.every((width) => width <= availableWidth + 0.0001);

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
    maxChars = Math.max(1, Math.floor(availableWidth / Math.max(1, currentSize * 0.3 * glyphWidthScale)));
    maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
    maxLines = isMultiCellArea ? maxLinesByHeight : Math.min(CLUE_MAX_LINES, maxLinesByHeight);
    const chosen = chooseCandidate();
    wrapResult = chosen.wrapResult;
    lines = chosen.lines;
    lineWidths = chosen.lineWidths;
  };

  const linesFitBounds = () =>
    wrapResult.isValid &&
    lines.length <= maxLines &&
    lineWidths.every((width) => width <= availableWidth + 0.0001);

  const shrinkUntil = (targetSize: number) => {
    while (!linesFitBounds() && currentSize > targetSize) {
      currentSize = Math.max(targetSize, currentSize - 1);
      recalcLayout();
    }
  };
  recalcLayout();
  if (!linesFitBounds()) shrinkUntil(minFontSize);

  const textBlockHeight = lineHeight * Math.max(1, lines.length);
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

    if (clusterFrame === "top-right") {
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
    const scaleTransform = buildUniformScaleTransform(textX, glyphWidthScale);
    const textLines = lines
      .map((line, idx) => {
        const lineY = Math.round((baseY + idx * lineHeight) * 10) / 10;
        return `<text x="${textX}" y="${lineY}" font-size="${currentSize}" text-anchor="${textAnchor}" dominant-baseline="alphabetic" fill="${fill}">${escapeXml(line)}</text>`;
      })
      .join("");
    const textSvg = useClip
      ? `<g clip-path="url(#${clipId})">${backgroundRect}${clusterFrameSvg}<g${scaleTransform}>${textLines}</g></g>`
      : `<g>${backgroundRect}${clusterFrameSvg}<g${scaleTransform}>${textLines}</g></g>`;
    return { defs, text: textSvg };
  }

  const tspan = lines
    .map((line, idx) => {
      const dy = idx === 0 ? 0 : lineHeight;
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const textNode = `<text x="${textX}" y="${textY}" font-size="${currentSize}" text-anchor="${textAnchor}" dominant-baseline="hanging" fill="${fill}"${buildUniformScaleTransform(textX, glyphWidthScale)}>${tspan}</text>`;
  const textSvg = useClip
    ? `<g clip-path="url(#${clipId})">${backgroundRect}${clusterFrameSvg}${textNode}</g>`
    : `<g>${backgroundRect}${clusterFrameSvg}${textNode}</g>`;

  return { defs, text: textSvg };
}
