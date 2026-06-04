import type { Cell, Grid } from "../src/types";
import { COREL_UNITS_PER_MM, formatCorelSizeMm } from "./svg-theme";
import { resolveCenteredTextStartX } from "./text-position";

const MM_PER_PT = 25.4 / 72;
const ANSWER_CELL_SIZE_MM = 10;
const ANSWER_STROKE_WIDTH_MM = 0.2;
const ANSWER_FONT_SIZE_PT = 20;
const ANSWER_CELL_SIZE =
  Math.round(ANSWER_CELL_SIZE_MM * COREL_UNITS_PER_MM * 1000) / 1000;
const ANSWER_STROKE_WIDTH =
  Math.round(ANSWER_STROKE_WIDTH_MM * COREL_UNITS_PER_MM * 1000) / 1000;
const ANSWER_FONT_SIZE =
  Math.round(ANSWER_FONT_SIZE_PT * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000;
const ANSWER_TEXT_PADDING = 1;
const ANSWER_LINE_HEIGHT_FACTOR = 1.0;
const ANSWER_MIN_LINE_HEIGHT_FACTOR = 0.85;
const ANSWER_MAX_LINES = 4;
const ANSWER_TEXT_ASCENT_RATIO = 0.8;
const ANSWER_LINE_COLOR = "#2B2A29";
const ANSWER_TEXT_COLOR = "#2B2A29";
const ANSWER_BLOCK_FILL = "#2B2A29";
const ANSWER_EMPTY_FILL = "#fff";
const ANSWER_FONT_FAMILY = "Arial";

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

function resolveAnswerTextBaselineY(cellTop: number): number {
  const innerHeight = ANSWER_CELL_SIZE - ANSWER_TEXT_PADDING * 2;
  const lineHeight = resolveLineHeight(ANSWER_FONT_SIZE, innerHeight);
  const textBlockHeight = lineHeight;
  const offsetY = Math.max(0, (innerHeight - textBlockHeight) / 2);
  const textTopY = cellTop + ANSWER_TEXT_PADDING + offsetY;
  const ascent = ANSWER_FONT_SIZE * ANSWER_TEXT_ASCENT_RATIO;
  return textTopY + ascent;
}

export function buildAnswersOnlySvg(grid: Grid, solved: string[]): string {
  const rows = grid.rows;
  const cols = grid.cols;
  const pad = ANSWER_STROKE_WIDTH / 2;
  const width = cols * ANSWER_CELL_SIZE + ANSWER_STROKE_WIDTH;
  const height = rows * ANSWER_CELL_SIZE + ANSWER_STROKE_WIDTH;
  const widthAttr = formatCorelSizeMm(width);
  const heightAttr = formatCorelSizeMm(height);

  const parts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${widthAttr}" height="${heightAttr}" viewBox="0 0 ${width} ${height}"${SVG_STYLE_ATTR} font-family="${ANSWER_FONT_FAMILY}" text-anchor="middle">`,
  ];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = pad + col * ANSWER_CELL_SIZE;
      const y = pad + row * ANSWER_CELL_SIZE;
      const ch = solved[row][col] as Cell;
      const code = grid.codes[row]?.[col];

      if (ch === "#") {
        const blockFill = code === 0x02 ? ANSWER_BLOCK_FILL : ANSWER_EMPTY_FILL;
        parts.push(
          `<rect x="${x}" y="${y}" width="${ANSWER_CELL_SIZE}" height="${ANSWER_CELL_SIZE}" fill="${blockFill}"/>`
        );
      } else {
        const textBaselineY = resolveAnswerTextBaselineY(y);
        const textX = resolveCenteredTextStartX(x, ANSWER_CELL_SIZE, ch, ANSWER_FONT_SIZE);
        parts.push(
          `<rect x="${x}" y="${y}" width="${ANSWER_CELL_SIZE}" height="${ANSWER_CELL_SIZE}" fill="${ANSWER_EMPTY_FILL}"/>`
        );
        parts.push(
          `<text x="${textX}" y="${textBaselineY}" font-size="${ANSWER_FONT_SIZE}" fill="${ANSWER_TEXT_COLOR}" text-anchor="start" dominant-baseline="alphabetic">${ch}</text>`
        );
      }

      parts.push(
        `<rect x="${x}" y="${y}" width="${ANSWER_CELL_SIZE}" height="${ANSWER_CELL_SIZE}" fill="none" stroke="${ANSWER_LINE_COLOR}" stroke-width="${ANSWER_STROKE_WIDTH}"/>`
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}
