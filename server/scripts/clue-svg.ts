import ruHyphen from "hyphen/ru";
import type { ClueLayout } from "../src/utils/clues";
import { COREL_UNITS_PER_MM } from "./svg-theme";

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
const MM_PER_PT = 25.4 / 72;
export const MIN_CLUE_FONT_SIZE = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
const MIN_COREL_CLUE_FONT_SIZE = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "corel");
const CLUE_MAX_LINES = 4;
const CLUE_CHAR_WIDTH_FACTOR = 0.56;

export function convertCluePtToSvgUnits(pt: number, mode: "default" | "corel"): number {
  if (mode === "corel") {
    return Math.round(pt * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000;
  }
  return Math.round((pt * 96) / 72 * 1000) / 1000;
}

export function resolveMinClueFontSize(mode: "default" | "corel"): number {
  return mode === "corel" ? MIN_COREL_CLUE_FONT_SIZE : MIN_CLUE_FONT_SIZE;
}

function normalizeScale(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function estimateScaledLineWidth(line: string, fontSize: number, glyphWidthScale: number): number {
  return (
    Math.round(Math.max(1, line.length * fontSize * CLUE_CHAR_WIDTH_FACTOR * glyphWidthScale) * 1000) / 1000
  );
}

function resolveLineHeight(fontSize: number, lineHeightScale: number): number {
  return fontSize * lineHeightScale;
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

function splitLongWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const parts: string[] = [];
  let i = 0;
  while (word.length - i > maxChars) {
    let take = maxChars;
    const remaining = word.length - (i + take);
    if (remaining > 0 && remaining < 3 && take > 3) {
      take -= 3 - remaining;
    }
    parts.push(word.slice(i, i + take));
    i += take;
  }
  if (i < word.length) parts.push(word.slice(i));
  return parts;
}

function splitWordWithHyphenation(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  if (maxChars < 2) return splitLongWord(word, maxChars);
  const parts = ruHyphen
    .hyphenateSync(word, { hyphenChar: HYPHENATION_SEPARATOR })
    .split(HYPHENATION_SEPARATOR);
  if (parts.length <= 1) return splitLongWord(word, maxChars);

  const breaks: number[] = [];
  let offset = 0;
  for (let i = 0; i < parts.length - 1; i += 1) {
    offset += parts[i]?.length ?? 0;
    if (offset > 0) breaks.push(offset);
  }

  const lines: string[] = [];
  let start = 0;
  while (word.length - start > maxChars) {
    const limit = maxChars - 1;
    let breakPos = -1;
    for (const pos of breaks) {
      if (pos > start && pos - start <= limit) {
        breakPos = pos;
      }
    }
    if (breakPos === -1) {
      lines.push(...splitLongWord(word.slice(start), maxChars));
      return lines;
    }
    lines.push(`${word.slice(start, breakPos)}-`);
    start = breakPos;
  }
  if (start < word.length) lines.push(word.slice(start));
  return lines;
}

function splitWord(word: string, maxChars: number, breakWords: boolean): string[] {
  if (word.length <= maxChars) return [word];
  if (!breakWords) return [word];
  return splitWordWithHyphenation(word, maxChars);
}

function wrapText(text: string, maxChars: number, breakWords: boolean): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";

  const appendSplitWord = (word: string): void => {
    const splitLines = splitWord(word, maxChars, breakWords);
    if (!splitLines.length) return;
    lines.push(...splitLines.slice(0, -1));
    line = splitLines[splitLines.length - 1] ?? "";
  };

  for (const word of words) {
    if (!line) {
      if (word.length > maxChars) {
        appendSplitWord(word);
        continue;
      }
      line = word;
      continue;
    }

    if (line.length + 1 + word.length <= maxChars) {
      line = `${line} ${word}`;
      continue;
    }

    lines.push(line);
    if (word.length > maxChars) {
      appendSplitWord(word);
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
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
  return {
    definitionAreaCells,
    isExpandedDefinition,
    isClusterDefinition: isExpandedDefinition,
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
  const padding = 1;
  const normalized = text.replace(/\s+/g, " ").trim();
  const minFontSizeOverride = Number.isFinite(options.minFontSize)
    ? Math.max(1, Number(options.minFontSize))
    : null;
  const minFontSize = Math.min(minFontSizeOverride ?? resolveMinClueFontSize(mode), fontSize);
  const innerHeight = layoutHeight - padding * 2;
  const clusterInset = clusterFrame === "top-right" ? clusterPadding * 2 : 0;
  const availableWidth = Math.max(1, layoutWidth - padding * 2 - clusterInset);
  const availableHeight = Math.max(1, innerHeight - clusterInset);
  let currentSize = Math.max(fontSize, minFontSize);
  let lineHeight = resolveLineHeight(currentSize, lineHeightScale);
  let maxChars = Math.max(
    1,
    Math.floor(availableWidth / (currentSize * CLUE_CHAR_WIDTH_FACTOR * glyphWidthScale))
  );
  let maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
  let maxLines = isMultiCellArea ? maxLinesByHeight : Math.min(CLUE_MAX_LINES, maxLinesByHeight);
  const words = normalized ? normalized.split(" ") : [];
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  let breakWords = false;
  let lines = wrapText(normalized, maxChars, breakWords);

  const recalcLayout = () => {
    lineHeight = resolveLineHeight(currentSize, lineHeightScale);
    maxChars = Math.max(
      1,
      Math.floor(availableWidth / (currentSize * CLUE_CHAR_WIDTH_FACTOR * glyphWidthScale))
    );
    maxLinesByHeight = Math.max(1, Math.floor((availableHeight + 0.0001) / lineHeight));
    maxLines = isMultiCellArea ? maxLinesByHeight : Math.min(CLUE_MAX_LINES, maxLinesByHeight);
    lines = wrapText(normalized, maxChars, breakWords);
  };

  const shrinkUntil = (targetSize: number) => {
    while (
      (lines.length > maxLines || (!breakWords && longestWord > maxChars)) &&
      currentSize > targetSize
    ) {
      currentSize = Math.max(targetSize, currentSize - 1);
      recalcLayout();
    }
  };

  shrinkUntil(minFontSize);

  if (!breakWords && longestWord > maxChars) {
    breakWords = true;
    recalcLayout();
    shrinkUntil(minFontSize);
  }

  if (lines.length > maxLines) {
    shrinkUntil(minFontSize);
  }

  if (!breakWords && longestWord > maxChars && currentSize > minFontSize) {
    breakWords = true;
    recalcLayout();
    shrinkUntil(minFontSize);
  }

  if (lines.length > maxLines && breakWords) {
    shrinkUntil(minFontSize);
  }

  const textBlockHeight = lineHeight * Math.max(1, lines.length);
  const offsetY = Math.max(0, (availableHeight - textBlockHeight) / 2);
  let textX = alignBottomLeft ? minX + padding + 1 : minX + layoutWidth / 2;
  let textY = alignBottomLeft
    ? Math.max(minY + padding, maxY - padding - textBlockHeight)
    : minY + padding + offsetY;
  let textAnchor: "start" | "middle" = alignBottomLeft ? "start" : "middle";

  const lineWidths = lines.map((line) =>
    Math.min(availableWidth, estimateScaledLineWidth(line, currentSize, glyphWidthScale))
  );
  const textBlockWidth = Math.max(1, ...lineWidths);
  const backgroundPadX = Math.max(1, Math.round(currentSize * 0.14));
  const backgroundPadY = Math.max(1, Math.round(currentSize * 0.08));
  let backgroundX = alignBottomLeft
    ? textX - backgroundPadX
    : textX - textBlockWidth / 2 - backgroundPadX;
  let backgroundY = textY - backgroundPadY;
  let backgroundWidth = textBlockWidth + backgroundPadX * 2;
  let backgroundHeight = textBlockHeight + backgroundPadY * 2;

  if (background === "text-block" && isMultiCellArea) {
    const boundaryInset = Math.max(0, options.backgroundInset ?? 0);
    if (boundaryInset > 0) {
      const safeMinX = minX + boundaryInset;
      const safeMaxX = maxX - boundaryInset;
      const safeMinY = minY + boundaryInset;
      const safeMaxY = maxY - boundaryInset;
      const safeWidth = Math.max(0, safeMaxX - safeMinX);
      const safeHeight = Math.max(0, safeMaxY - safeMinY);

      if (backgroundWidth > safeWidth) {
        backgroundWidth = safeWidth;
        backgroundX = safeMinX;
      } else {
        backgroundX = Math.max(safeMinX, Math.min(backgroundX, safeMaxX - backgroundWidth));
      }

      if (backgroundHeight > safeHeight) {
        backgroundHeight = safeHeight;
        backgroundY = safeMinY;
      } else {
        backgroundY = Math.max(safeMinY, Math.min(backgroundY, safeMaxY - backgroundHeight));
      }
    }
  }

  if (background === "text-block" && clusterFrame === "top-right") {
    backgroundX = minX;
    backgroundWidth = Math.min(layoutWidth, textBlockWidth + clusterPadding * 2);
    backgroundHeight = Math.min(layoutHeight, textBlockHeight + clusterPadding * 2);
    backgroundY = maxY - backgroundHeight;
    textX = backgroundX + backgroundWidth / 2;
    textY = backgroundY + Math.max(0, (backgroundHeight - textBlockHeight) / 2);
    textAnchor = "middle";
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
    const ascent = Math.round(currentSize * 0.8 * 10) / 10;
    const baseY = Math.round((textY + ascent) * 10) / 10;
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
