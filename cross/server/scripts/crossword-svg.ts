import { buildClueLayouts } from "../src/utils/clues";
import type { Cell, Grid, Slot } from "../src/types";
import { arrowSvg } from "./arrow-utils";
import {
  CLUE_FONT_BASE_PT,
  CLUE_FONT_MIN_PT,
  CLUE_GLYPH_WIDTH_SCALE,
  CLUE_LINE_HEIGHT_SCALE,
  CLUE_PLAQUE_TEXT_INSET_MM,
  buildClueTextMap,
  convertCluePtToSvgUnits,
  renderClueText,
  resolveClueRenderLayout,
} from "./clue-svg";
import { resolveCenteredTextStartX } from "./text-position";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  COREL_CELL_SIZE_MM,
  COREL_CELL_SIZE_UNITS,
  COREL_MIN_SVG_HEIGHT_UNITS,
  COREL_MIN_SVG_WIDTH_UNITS,
  COREL_STROKE_WIDTH_UNITS,
  COREL_UNITS_PER_MM,
  formatCorelSizeMm,
  WORD_TEXT_FILL,
} from "./svg-theme";

const MM_PER_PT = 25.4 / 72;
const PX_PER_MM = 96 / 25.4;
const DEFAULT_CELL = 30;
const DEFAULT_TYPE0_CELL_MM = 8.5;
const DEFAULT_TYPE0_NUMBER_FONT_PT = 10;
const DEFAULT_KEYWORD_MARKER_FONT_PT = 10;
const DEFAULT_TYPE0_OUTER_STROKE_MM = 2;
const DEFAULT_KEYWORD_STROKE_MM = 0.75;
const DEFAULT_TYPE0_OUTER_STROKE_COLOR = "#B2B3B3";
const DEFAULT_TYPE0_BLOCK_FILL = "#B2B3B3";
const DEFAULT_TYPE0_NUMBER_TEXT_FILL = "#2B2A29";
const DEFAULT_DEBUG_CLUSTER_COLOR = "#FFB3B3";

export type CrosswordSvgStyle = "default" | "corel";

export type CrosswordSvgTypography = {
  clueFontBasePt?: number | null;
  clueFontMinPt?: number | null;
  clueGlyphWidthScale?: number;
  clueLineHeightScale?: number;
  fontFaceCss?: string | null;
};

export type BuildCrosswordSvgOptions = {
  style: CrosswordSvgStyle;
  arrowMode: "export" | "batch";
  arrowScale: number;
  fontFamily?: string;
  debugClusterFill?: boolean;
  debugClusterColor?: string;
  svgTypography?: CrosswordSvgTypography | null;
  photoClues?: Array<{
    clueKey: string;
    href: string;
  }>;
  type0Features?: boolean;
  type0CellMm?: number;
  type0NumberFontPt?: number;
  type0OuterStrokeMm?: number;
  type0OuterStrokeColor?: string;
  type0BlockFill?: string;
  type0NumberTextFill?: string;
  cellStrokeColor?: string;
  keyword?: {
    text: string;
    cells: Array<{ row: number; col: number; index: number }>;
  } | null;
};

function buildAreaBounds(areaCells: Array<[number, number]>) {
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  for (const [row, col] of areaCells) {
    minRow = Math.min(minRow, row);
    minCol = Math.min(minCol, col);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }
  if (!Number.isFinite(minRow) || !Number.isFinite(minCol) || !Number.isFinite(maxRow) || !Number.isFinite(maxCol)) {
    return null;
  }
  return { minRow, minCol, maxRow, maxCol };
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function convertMmToSvgUnits(mm: number, useCorelStyle: boolean): number {
  return useCorelStyle
    ? Math.round(mm * COREL_UNITS_PER_MM * 1000) / 1000
    : Math.round(mm * PX_PER_MM * 1000) / 1000;
}

function buildStartNumberByCell(slots: Slot[]): Map<string, number> {
  const uniqueStarts = new Map<string, { r: number; c: number }>();
  for (const slot of slots) {
    const key = `${slot.r},${slot.c}`;
    if (!uniqueStarts.has(key)) uniqueStarts.set(key, { r: slot.r, c: slot.c });
  }
  const ordered = [...uniqueStarts.values()].sort((a, b) => a.r - b.r || a.c - b.c);
  const numbered = new Map<string, number>();
  ordered.forEach((item, idx) => {
    numbered.set(`${item.r},${item.c}`, idx + 1);
  });
  return numbered;
}

export function buildCrosswordSvg(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>,
  options: BuildCrosswordSvgOptions
): { svg: string; svgRaw: string; usedWords: string } {
  const useCorelStyle = options.style === "corel";
  const type0Features = options.type0Features !== false;
  const isType0Template = type0Features && grid.templateTypeCode === "0";
  const type0CellMm = options.type0CellMm ?? DEFAULT_TYPE0_CELL_MM;
  const type0NumberFontPt = options.type0NumberFontPt ?? DEFAULT_TYPE0_NUMBER_FONT_PT;
  const type0OuterStrokeMm = options.type0OuterStrokeMm ?? DEFAULT_TYPE0_OUTER_STROKE_MM;
  const type0OuterStrokeColor = options.type0OuterStrokeColor ?? DEFAULT_TYPE0_OUTER_STROKE_COLOR;
  const type0BlockFill = options.type0BlockFill ?? DEFAULT_TYPE0_BLOCK_FILL;
  const type0NumberTextFill = options.type0NumberTextFill ?? DEFAULT_TYPE0_NUMBER_TEXT_FILL;
  const cellStrokeColor = options.cellStrokeColor ?? CELL_STROKE_COLOR;
  const debugClusterFill = options.debugClusterFill === true;
  const debugClusterColor = options.debugClusterColor ?? DEFAULT_DEBUG_CLUSTER_COLOR;
  const typography = options.svgTypography ?? null;

  const baseCell = useCorelStyle ? COREL_CELL_SIZE_UNITS : DEFAULT_CELL;
  const cell = isType0Template && useCorelStyle
    ? Math.round(type0CellMm * COREL_UNITS_PER_MM * 1000) / 1000
    : baseCell;

  const strokeWidth = useCorelStyle ? COREL_STROKE_WIDTH_UNITS : CELL_STROKE_WIDTH;
  const svgPad = strokeWidth / 2;
  const gridPad = useCorelStyle ? 0 : svgPad;
  const gridOffsetX = (useCorelStyle ? -cell / 2 : 0) + gridPad;
  const gridOffsetY = (useCorelStyle ? -Math.round(cell * 0.034) : 0) + gridPad;
  const wordFontSize = useCorelStyle ? Math.round(cell * 0.565 * 1000) / 1000 : cell * 0.6;
  const wordTextY = useCorelStyle ? cell * 0.7 : cell / 2;
  const wordFontWeightAttr = useCorelStyle ? ' font-weight="bold"' : "";
  const wordBaselineAttr = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
  const wordTextAnchorAttr = useCorelStyle ? ' text-anchor="start"' : "";

  const outerStrokeWidth = isType0Template && useCorelStyle
    ? Math.round(type0OuterStrokeMm * COREL_UNITS_PER_MM * 1000) / 1000
    : 0;

  const showStartNumbers = isType0Template;
  const startNumberFontSize = showStartNumbers && useCorelStyle
    ? Math.round(type0NumberFontPt * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000
    : useCorelStyle
      ? Math.round(cell * 0.2 * 1000) / 1000
      : Math.max(8, Math.floor(cell * 0.2));
  const startNumberOffsetX = useCorelStyle ? cell * 0.11 : cell * 0.1;
  const startNumberOffsetY = useCorelStyle ? cell * 0.1 : cell * 0.08;
  const startNumberAscentRatio = 0.8;
  const startNumberBaselineAttr = ' dominant-baseline="alphabetic"';
  const startNumberByCell = showStartNumbers ? buildStartNumberByCell(slots) : new Map<string, number>();
  const keywordMarkerFontSize = useCorelStyle
    ? Math.round(DEFAULT_KEYWORD_MARKER_FONT_PT * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000
    : Math.max(10, Math.floor(cell * 0.18));
  const keywordMarkerOffsetX = cell * 0.11;
  const keywordMarkerOffsetY = cell * 0.14;
  const keywordMarkerAscentRatio = 0.8;
  const keywordStrokeWidth = useCorelStyle
    ? Math.round(DEFAULT_KEYWORD_STROKE_MM * COREL_UNITS_PER_MM * 1000) / 1000
    : Math.max(2, Math.round(cell * 0.05 * 1000) / 1000);
  const keywordMarkerByCell = new Map<string, number>(
    (options.keyword?.cells ?? []).map((cell) => [`${cell.row},${cell.col}`, cell.index + 1] as const)
  );

  const emptyCellFill = useCorelStyle ? "#FEFEFE" : "#fff";
  const svgWidthMin = useCorelStyle ? COREL_MIN_SVG_WIDTH_UNITS : 0;
  const svgHeightMin = useCorelStyle ? COREL_MIN_SVG_HEIGHT_UNITS : 0;
  const svgXmlSpace = useCorelStyle ? ' xml:space="preserve"' : "";
  const svgStyleAttr = useCorelStyle
    ? ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"'
    : "";
  const svgPreamble = useCorelStyle
    ? '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
    : "";
  const fontFamily = options.fontFamily ?? (useCorelStyle ? "Arial" : "monospace");
  const fontFamilyAttr = escapeXmlAttr(fontFamily);

  const usedWords = slots.map((slot) => slot.cells.map(([r, c]) => solved[r][c]).join("")).join("\n");
  const clueLayouts = buildClueLayouts(grid, slots, solved, definitions);
  const clueTextMap = buildClueTextMap(clueLayouts);
  const photoClueMap = new Map((options.photoClues ?? []).map((item) => [item.clueKey, item.href] as const));
  const debugClusterCells = new Set<string>();
  if (debugClusterFill) {
    for (const layout of clueLayouts) {
      const cells = layout.clusterCells?.length ? layout.clusterCells : layout.areaCells;
      if (cells.length <= 1) continue;
      for (const [row, col] of cells) debugClusterCells.add(`${row},${col}`);
    }
  }

  const { rows: rowCount, cols: colCount } = grid;
  const outer02Mask: boolean[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(false));
  if (isType0Template) {
    const is02Cell = (row: number, col: number): boolean => (grid.codes[row]?.[col] ?? 0) === 0x02;
    const queue: Array<[number, number]> = [];
    const enqueue = (row: number, col: number) => {
      if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return;
      if (outer02Mask[row][col]) return;
      if (!is02Cell(row, col)) return;
      outer02Mask[row][col] = true;
      queue.push([row, col]);
    };

    for (let col = 0; col < colCount; col += 1) {
      enqueue(0, col);
      enqueue(rowCount - 1, col);
    }
    for (let row = 0; row < rowCount; row += 1) {
      enqueue(row, 0);
      enqueue(row, colCount - 1);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const [row, col] = queue[head];
      enqueue(row - 1, col);
      enqueue(row + 1, col);
      enqueue(row, col - 1);
      enqueue(row, col + 1);
    }
  }

  const renderCellMask: boolean[][] = Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: colCount }, (_, col) => !outer02Mask[row][col])
  );
  const isRenderedCell = (row: number, col: number): boolean =>
    row >= 0 && row < rowCount && col >= 0 && col < colCount && renderCellMask[row][col];

  const gridWidth = colCount * cell;
  const gridHeight = rowCount * cell;
  const contentWidth = gridWidth + svgPad * 2;
  const contentHeight = gridHeight + svgPad * 2;
  const svgWidth = useCorelStyle ? Math.max(svgWidthMin, contentWidth) : contentWidth;
  const svgHeight = useCorelStyle ? Math.max(svgHeightMin, contentHeight) : contentHeight;
  const svgWidthAttr = useCorelStyle ? formatCorelSizeMm(svgWidth) : String(svgWidth);
  const svgHeightAttr = useCorelStyle ? formatCorelSizeMm(svgHeight) : String(svgHeight);
  const svgViewBox = useCorelStyle
    ? ` viewBox="${gridOffsetX - svgPad} ${gridOffsetY - svgPad} ${svgWidth} ${svgHeight}"`
    : "";

  const svgParts: string[] = [
    `${svgPreamble}<svg xmlns="http://www.w3.org/2000/svg"${svgXmlSpace} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${svgStyleAttr} font-family="${fontFamilyAttr}" text-anchor="middle" dominant-baseline="central">`,
  ];
  const svgRawParts: string[] = [
    `${svgPreamble}<svg xmlns="http://www.w3.org/2000/svg"${svgXmlSpace} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${svgStyleAttr} font-family="${fontFamilyAttr}" text-anchor="middle" dominant-baseline="central">`,
  ];
  const svgDefs: string[] = [];
  const clueDefs: string[] = [];
  const photoLayer: string[] = [];
  const photoRawLayer: string[] = [];
  const clueLayer: string[] = [];
  const clueRawLayer: string[] = [];
  const borderLayer: string[] = [];
  const borderRawLayer: string[] = [];
  const outerContourLayer: string[] = [];

  const clueMode = useCorelStyle ? "corel" : "default";
  const clueFontBasePt = Number.isFinite(typography?.clueFontBasePt)
    ? Number(typography?.clueFontBasePt)
    : CLUE_FONT_BASE_PT;
  const clueFontMinPt = Number.isFinite(typography?.clueFontMinPt)
    ? Number(typography?.clueFontMinPt)
    : CLUE_FONT_MIN_PT;
  const clueFont = convertCluePtToSvgUnits(clueFontBasePt, clueMode);
  const clueMinFontSize = Math.min(convertCluePtToSvgUnits(clueFontMinPt, clueMode), clueFont);
  const clueGlyphWidthScale =
    Number.isFinite(typography?.clueGlyphWidthScale) && Number(typography?.clueGlyphWidthScale) > 0
      ? Number(typography?.clueGlyphWidthScale)
      : CLUE_GLYPH_WIDTH_SCALE;
  const clueLineHeightScale =
    Number.isFinite(typography?.clueLineHeightScale) && Number(typography?.clueLineHeightScale) > 0
      ? Number(typography?.clueLineHeightScale)
      : CLUE_LINE_HEIGHT_SCALE;
  const cluePlaqueTextInset = convertMmToSvgUnits(CLUE_PLAQUE_TEXT_INSET_MM, useCorelStyle);
  const clusterDefinitionPadding = useCorelStyle
    ? Math.round(COREL_UNITS_PER_MM * 1000) / 1000
    : cell / COREL_CELL_SIZE_MM;

  if (typography?.fontFaceCss) {
    svgDefs.push(`<style type="text/css"><![CDATA[${typography.fontFaceCss}]]></style>`);
  }

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      if (!renderCellMask[row][col]) continue;
      const x = gridOffsetX + col * cell;
      const y = gridOffsetY + row * cell;
      const ch = solved[row][col] as Cell;
      const orig = grid.data[row][col] as Cell;
      const code = grid.codes[row][col];
      const clueKey = `${row},${col}`;
      const clueLayout = clueTextMap.get(clueKey);

      if (ch === "#") {
        const blockFill = debugClusterCells.has(clueKey)
          ? debugClusterColor
          : isType0Template && code === 0x02
            ? type0BlockFill
            : BLOCK_CELL_FILL;
        const rect = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${blockFill}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);

        if (clueLayout?.text) {
          const { definitionAreaCells, isExpandedDefinition, isClusterDefinition } =
            resolveClueRenderLayout(clueLayout);
          const photoHref = photoClueMap.get(clueKey);
          if (photoHref) {
            const bounds = buildAreaBounds(definitionAreaCells);
            if (bounds) {
              const imageX = gridOffsetX + bounds.minCol * cell + strokeWidth;
              const imageY = gridOffsetY + bounds.minRow * cell + strokeWidth;
              const imageWidth = (bounds.maxCol - bounds.minCol + 1) * cell - strokeWidth * 2;
              const imageHeight = (bounds.maxRow - bounds.minRow + 1) * cell - strokeWidth * 2;
              const imageTag = `<image href="${escapeXmlAttr(photoHref)}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice"/>`;
              photoLayer.push(imageTag);
              photoRawLayer.push(imageTag);
            }
          }
          const clipId = `clue-${row}-${col}`;
          const clueSvg = renderClueText(x, y, cell, clueFont, clueLayout.text, clipId, CLUE_TEXT_FILL, {
            mode: clueMode,
            areaCells: definitionAreaCells,
            anchorCell: [row, col],
            textAlign: photoHref ? "center" : isExpandedDefinition ? "bottom-left" : "center",
            background: photoHref || isExpandedDefinition ? "text-block" : "none",
            backgroundInset: photoHref || isExpandedDefinition ? strokeWidth : 0,
            backgroundAnchor: photoHref ? "bottom-left" : "auto",
            plaqueTextInset: photoHref ? cluePlaqueTextInset : 0,
            frame: photoHref ? "rect" : "none",
            frameWidth: photoHref ? strokeWidth : 0,
            clusterFrame: !photoHref && isClusterDefinition ? "top-right" : "none",
            clusterPadding: !photoHref && isClusterDefinition ? clusterDefinitionPadding : 0,
            clusterBorderWidth: !photoHref && isClusterDefinition ? strokeWidth : 0,
            minFontSize: clueMinFontSize,
            glyphWidthScale: clueGlyphWidthScale,
            lineHeightScale: clueLineHeightScale,
          });
          if (clueSvg.defs) clueDefs.push(clueSvg.defs);
          clueLayer.push(clueSvg.text);
          clueRawLayer.push(clueSvg.text);
        }

        const border = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${cellStrokeColor}" stroke-width="${strokeWidth}"/>`;
        borderLayer.push(border);
        borderRawLayer.push(border);
        continue;
      }

      const rect = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${emptyCellFill}"/>`;
      svgParts.push(rect);
      svgRawParts.push(rect);

      const arrow = arrowSvg(options.arrowMode, code, orig, x, y, cell, cell * options.arrowScale);
      if (arrow) {
        svgParts.push(arrow);
        svgRawParts.push(arrow);
      }

      const startNumber = startNumberByCell.get(clueKey);
      if (startNumber !== undefined) {
        const startNumberBaselineY = y + startNumberOffsetY + startNumberFontSize * startNumberAscentRatio;
        const numberText = `<text x="${x + startNumberOffsetX}" y="${startNumberBaselineY}" font-size="${startNumberFontSize}" fill="${type0NumberTextFill}" text-anchor="start"${startNumberBaselineAttr}>${startNumber}</text>`;
        svgParts.push(numberText);
        svgRawParts.push(numberText);
      }

      const keywordMarker = keywordMarkerByCell.get(clueKey);
      if (keywordMarker !== undefined) {
        const keywordFrame = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${cellStrokeColor}" stroke-width="${keywordStrokeWidth}"/>`;
        borderLayer.push(keywordFrame);
        borderRawLayer.push(keywordFrame);
        const keywordMarkerBaselineY = y + keywordMarkerOffsetY + keywordMarkerFontSize * keywordMarkerAscentRatio;
        const markerText = `<text x="${x + keywordMarkerOffsetX}" y="${keywordMarkerBaselineY}" font-size="${keywordMarkerFontSize}" font-weight="bold" fill="${type0NumberTextFill}" text-anchor="start"${startNumberBaselineAttr}>${keywordMarker}</text>`;
        svgParts.push(markerText);
        svgRawParts.push(markerText);
      }

      const wordTextX = useCorelStyle ? resolveCenteredTextStartX(x, cell, ch, wordFontSize) : x + cell / 2;
      svgParts.push(
        `<text x="${wordTextX}" y="${y + wordTextY}" font-size="${wordFontSize}" fill="${WORD_TEXT_FILL}"${wordTextAnchorAttr}${wordFontWeightAttr}${wordBaselineAttr}>${ch}</text>`
      );
      const border = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${cellStrokeColor}" stroke-width="${strokeWidth}"/>`;
      borderLayer.push(border);
      borderRawLayer.push(border);
    }
  }

  if (isType0Template && outerStrokeWidth > 0) {
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        if (!isRenderedCell(row, col)) continue;
        const x = gridOffsetX + col * cell;
        const y = gridOffsetY + row * cell;
        if (!isRenderedCell(row - 1, col)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y}" x2="${x + cell}" y2="${y}" stroke="${type0OuterStrokeColor}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row + 1, col)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y + cell}" x2="${x + cell}" y2="${y + cell}" stroke="${type0OuterStrokeColor}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row, col - 1)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + cell}" stroke="${type0OuterStrokeColor}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row, col + 1)) {
          outerContourLayer.push(
            `<line x1="${x + cell}" y1="${y}" x2="${x + cell}" y2="${y + cell}" stroke="${type0OuterStrokeColor}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
      }
    }
  }

  svgParts.push(...borderLayer, ...photoLayer, ...clueLayer);
  svgRawParts.push(...borderRawLayer, ...photoRawLayer, ...clueRawLayer);
  if (outerContourLayer.length) {
    svgParts.splice(1, 0, ...outerContourLayer);
    svgRawParts.splice(1, 0, ...outerContourLayer);
  }
  const defsContent = [...svgDefs, ...clueDefs];
  if (defsContent.length) {
    svgParts.splice(1, 0, `<defs>${defsContent.join("")}</defs>`);
    svgRawParts.splice(1, 0, `<defs>${defsContent.join("")}</defs>`);
  }
  svgParts.push("</svg>");
  svgRawParts.push("</svg>");

  return {
    svg: svgParts.join(""),
    svgRaw: svgRawParts.join(""),
    usedWords,
  };
}
