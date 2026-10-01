import type { Cell, Grid, Slot } from "../src/types";
import { buildClueLayouts, findAnchorlessEdgeClusterCells } from "../src/utils/clues";
import { convertMmToCorelUnits, COREL_UNITS_PER_MM, formatCorelSizeMm } from "./svg-theme";
import { resolveCenteredTextStartX } from "./text-position";

const MM_PER_PT = 25.4 / 72;
const ANSWER_STROKE_WIDTH_MM = 0.2;
const ANSWER_FONT_SIZE_PT = 20;
const ANSWER_STROKE_WIDTH =
  Math.round(ANSWER_STROKE_WIDTH_MM * COREL_UNITS_PER_MM * 1000) / 1000;
const ANSWER_FONT_SIZE =
  Math.round(ANSWER_FONT_SIZE_PT * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000;
const ANSWER_TEXT_PADDING = 1;
const ANSWER_LINE_HEIGHT_FACTOR = 1.0;
const ANSWER_MIN_LINE_HEIGHT_FACTOR = 0.85;
const ANSWER_MAX_LINES = 4;
const ANSWER_TEXT_ASCENT_RATIO = 0.8;
const ANSWER_LINE_COLOR = "#000000";
const ANSWER_TEXT_COLOR = "#000000";
const ANSWER_BLOCK_FILL = "#000000";
const ANSWER_EMPTY_FILL = "#fff";
const ANSWER_FONT_FAMILY = "Arial";

type AnswerSvgFont = {
  familyName?: string | null;
  fontFaceCss?: string | null;
};

type AnswerSvgLayoutContext = {
  slots: Slot[];
  definitions: Map<string, string>;
};

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SVG_XML_SPACE = ' xml:space="preserve"';
const SVG_STYLE_ATTR =
  ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"';
const SVG_PREAMBLE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n';

function resolveLineHeight(fontSize: number, innerHeight: number): number {
  const rawLineHeight = fontSize * ANSWER_LINE_HEIGHT_FACTOR;
  const targetLineHeightForMaxLines = innerHeight / ANSWER_MAX_LINES;
  const minLineHeight = fontSize * ANSWER_MIN_LINE_HEIGHT_FACTOR;
  return Math.max(minLineHeight, Math.min(rawLineHeight, targetLineHeightForMaxLines));
}

function resolveAnswerTextBaselineY(cellTop: number, cellSize: number): number {
  const innerHeight = cellSize - ANSWER_TEXT_PADDING * 2;
  const lineHeight = resolveLineHeight(ANSWER_FONT_SIZE, innerHeight);
  const textBlockHeight = lineHeight;
  const offsetY = Math.max(0, (innerHeight - textBlockHeight) / 2);
  const textTopY = cellTop + ANSWER_TEXT_PADDING + offsetY;
  const ascent = ANSWER_FONT_SIZE * ANSWER_TEXT_ASCENT_RATIO;
  return textTopY + ascent;
}

export function buildAnswersOnlySvg(
  grid: Grid,
  solved: string[],
  cellSizeMm: number,
  font?: AnswerSvgFont,
  layoutContext?: AnswerSvgLayoutContext,
): string {
  const transparentCells = new Set<string>();
  if (layoutContext) {
    const layouts = buildClueLayouts(grid, layoutContext.slots, solved, layoutContext.definitions);
    for (const layout of layouts) {
      if (layout.areaKind === "paired") continue;
      const cells = layout.clusterCells?.length ? layout.clusterCells : layout.areaCells;
      if (cells.length <= 1) continue;
      for (const [row, col] of cells) transparentCells.add(`${row},${col}`);
    }
    for (const [row, col] of findAnchorlessEdgeClusterCells(grid, layouts)) {
      transparentCells.add(`${row},${col}`);
    }
  }
  const rows = grid.rows;
  const cols = grid.cols;
  const cellSize = convertMmToCorelUnits(cellSizeMm);
  const pad = ANSWER_STROKE_WIDTH / 2;
  const width = cols * cellSize + ANSWER_STROKE_WIDTH;
  const height = rows * cellSize + ANSWER_STROKE_WIDTH;
  const widthAttr = formatCorelSizeMm(width);
  const heightAttr = formatCorelSizeMm(height);
  const fontFamily = escapeXmlAttr(font?.familyName ?? ANSWER_FONT_FAMILY);

  const parts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${widthAttr}" height="${heightAttr}" viewBox="0 0 ${width} ${height}"${SVG_STYLE_ATTR} font-family="${fontFamily}" text-anchor="middle">`,
  ];
  if (font?.fontFaceCss) {
    parts.push(`<defs><style type="text/css"><![CDATA[${font.fontFaceCss}]]></style></defs>`);
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (grid.data[row][col] === "%" || transparentCells.has(`${row},${col}`)) continue;
      const x = pad + col * cellSize;
      const y = pad + row * cellSize;
      const ch = solved[row][col] as Cell;
      const code = grid.codes[row]?.[col];

      if (ch === "#") {
        const blockFill = code === 0x02 ? ANSWER_BLOCK_FILL : ANSWER_EMPTY_FILL;
        parts.push(
          `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${blockFill}"/>`
        );
      } else {
        const textBaselineY = resolveAnswerTextBaselineY(y, cellSize);
        const textX = resolveCenteredTextStartX(x, cellSize, ch, ANSWER_FONT_SIZE);
        parts.push(
          `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${ANSWER_EMPTY_FILL}"/>`
        );
        parts.push(
          `<text x="${textX}" y="${textBaselineY}" font-size="${ANSWER_FONT_SIZE}" fill="${ANSWER_TEXT_COLOR}" text-anchor="start" dominant-baseline="alphabetic">${ch}</text>`
        );
      }

      parts.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none" stroke="${ANSWER_LINE_COLOR}" stroke-width="${ANSWER_STROKE_WIDTH}"/>`
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}
