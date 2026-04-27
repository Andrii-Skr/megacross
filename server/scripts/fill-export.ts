#!/usr/bin/env tsx
//------------------------------------------------------------------
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join }           from "node:path";
import { parseArgs }                from "node:util";
import { parseFsh }                 from "../src/utils/parseFsh";
import { validate, scanSlots }      from "../src/utils/grid";
import { solve }                    from "../src/utils/solver";
import { loadDictionary, loadDefinitions } from "../src/services/dictionary";
import { buildCrw }                 from "../src/utils/writeCrw";
import { buildClueEntries, buildClueLayouts } from "../src/utils/clues";
import { Cell, Grid }               from "../src/types";
import { arrowSvg }                 from "./arrow-utils";
import { buildAnswersOnlySvg }      from "./answer-only-svg";
import {
  CLUE_FONT_BASE_PT,
  CLUE_FONT_MIN_PT,
  CLUE_GLYPH_WIDTH_SCALE,
  CLUE_LINE_HEIGHT_SCALE,
  buildClueTextMap,
  convertCluePtToSvgUnits,
  renderClueText,
} from "./clue-svg";
import { resolveCenteredTextStartX } from "./text-position";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  COREL_CELL_SIZE_UNITS,
  COREL_MIN_SVG_HEIGHT_UNITS,
  COREL_MIN_SVG_WIDTH_UNITS,
  COREL_STROKE_WIDTH_UNITS,
  COREL_UNITS_PER_MM,
  formatCorelSizeMm,
  WORD_TEXT_FILL,
} from "./svg-theme";

const DEFAULT_CELL = 30;                         // px

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file:    { type: "string",  short: "f" },
    shuffle: { type: "boolean", short: "s" },
    crw:     { type: "boolean", short: "c" },
    dict:    { type: "string",  short: "d" },
    template:{ type: "string",  short: "t" },
    style:   { type: "string" },
    "no-defs": { type: "boolean" },
    "no-clues": { type: "boolean" },
  },
  allowPositionals: true,
});
const inFile    = values.file ?? positionals[0];
const doShuffle = values.shuffle === true;
const doCrw     = values.crw === true;
const writeDefsJson = !values["no-defs"] && !values["no-clues"];
const dictPath  = values.dict ?? "";
const templatePath = values.template ?? inFile;
const styleName = (values.style ?? "default").toLowerCase();
const useCorelStyle = styleName === "corel";
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}
const CELL = useCorelStyle ? COREL_CELL_SIZE_UNITS : DEFAULT_CELL;
const EMPTY_CELL_FILL = useCorelStyle ? "#FEFEFE" : "#fff";
const STROKE_WIDTH = useCorelStyle ? COREL_STROKE_WIDTH_UNITS : CELL_STROKE_WIDTH;
const SVG_PAD = STROKE_WIDTH / 2;
const GRID_PAD = useCorelStyle ? 0 : SVG_PAD;
const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
const WORD_TEXT_ANCHOR_ATTR = useCorelStyle ? ' text-anchor="start"' : "";
const SVG_WIDTH = useCorelStyle ? COREL_MIN_SVG_WIDTH_UNITS : 0;
const SVG_HEIGHT = useCorelStyle ? COREL_MIN_SVG_HEIGHT_UNITS : 0;
const SVG_XML_SPACE = useCorelStyle ? ' xml:space="preserve"' : "";
const SVG_STYLE_ATTR = useCorelStyle
  ? ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"'
  : "";
const SVG_PREAMBLE = useCorelStyle
  ? '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
  : "";
const FONT_FAMILY = useCorelStyle ? "Arial" : "monospace";
const DEBUG_CLUSTER_FILL = true;
const DEBUG_CLUSTER_COLOR = "#FFB3B3";

function buildStartNumberByCell(slots: Array<{ r: number; c: number }>): Map<string, number> {
  const uniqueStarts = new Map<string, { r: number; c: number }>();
  for (const slot of slots) {
    const key = `${slot.r},${slot.c}`;
    if (!uniqueStarts.has(key)) {
      uniqueStarts.set(key, { r: slot.r, c: slot.c });
    }
  }
  const ordered = [...uniqueStarts.values()].sort((a, b) => a.r - b.r || a.c - b.c);
  const numbered = new Map<string, number>();
  ordered.forEach((item, idx) => {
    numbered.set(`${item.r},${item.c}`, idx + 1);
  });
  return numbered;
}

if (!inFile) {
  console.error("Usage: pnpm run fill-export -- --file <path.fsh> [--shuffle] [--crw] [--dict <path>] [--template <path>] [--style corel] [--no-defs|--no-clues]");
  process.exit(1);
}

(async () => {
  const startedAt = Date.now();
  /* 1. parse + validate */
  const grid: Grid = parseFsh(inFile);   // { rows, cols, marker, data[] }
  validate(grid);
  const MM_PER_PT = 25.4 / 72;
  const TYPE0_CELL_MM = 8.5;
  const TYPE0_NUMBER_FONT_PT = 10;
  const TYPE0_OUTER_STROKE_MM = 2;
  const TYPE0_OUTER_STROKE_COLOR = "#B2B3B3";
  const TYPE0_BLOCK_FILL = "#B2B3B3";
  const TYPE0_NUMBER_TEXT_FILL = "#2B2A29";
  const CELL_BORDER_COLOR = "#2B2A29";
  const isType0Template = grid.templateTypeCode === "0";
  const cellSize = isType0Template && useCorelStyle
    ? Math.round(TYPE0_CELL_MM * COREL_UNITS_PER_MM * 1000) / 1000
    : CELL;
  const gridOffsetX = (useCorelStyle ? -cellSize / 2 : 0) + GRID_PAD;
  const gridOffsetY = (useCorelStyle ? -Math.round(cellSize * 0.034) : 0) + GRID_PAD;
  const wordFontSize = useCorelStyle
    ? Math.round(cellSize * 0.565 * 1000) / 1000
    : cellSize * 0.6;
  const wordTextY = useCorelStyle ? cellSize * 0.7 : cellSize / 2;
  const outerStrokeWidth = isType0Template && useCorelStyle
    ? Math.round(TYPE0_OUTER_STROKE_MM * COREL_UNITS_PER_MM * 1000) / 1000
    : 0;

  /* 2. slots + dictionary */
  const slots = scanSlots(grid);
  const lengths = [...new Set(slots.map((s) => s.len))];
  const dict  = await loadDictionary({ langCode: "ru", lengths });

  /* 3. solve */
  const solveStartedAt = Date.now();
  const solved = solve(grid.data, slots, dict, doShuffle);
  const solveMs = Date.now() - solveStartedAt;
  if (!solved) {
    console.error("Не удалось заполнить: словаря недостаточно.");
    process.exit(1);
  }

  /* 4. SVG */
  const usedWords = slots.map((s) =>
    s.cells.map(([r, c]) => solved[r][c]).join("")
  );
  const used = usedWords.join("\n");

  const definitions = await loadDefinitions(usedWords, { langCode: "ru" });
  const clues = buildClueEntries(grid, slots, solved, definitions);
  const clueLayouts = buildClueLayouts(grid, slots, solved, definitions);
  const clueTextMap = buildClueTextMap(clueLayouts);
  const debugClusterCells = new Set<string>();
  if (DEBUG_CLUSTER_FILL) {
    for (const layout of clueLayouts) {
      const cells = layout.clusterCells?.length ? layout.clusterCells : layout.areaCells;
      if (cells.length <= 1) continue;
      for (const [row, col] of cells) {
        debugClusterCells.add(`${row},${col}`);
      }
    }
  }

  const { rows: ROWS, cols: COLS } = grid;
  const outer02Mask: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  if (isType0Template) {
    const is02Cell = (row: number, col: number): boolean => (grid.codes[row]?.[col] ?? 0) === 0x02;
    const queue: Array<[number, number]> = [];
    const enqueue = (row: number, col: number) => {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      if (outer02Mask[row][col]) return;
      if (!is02Cell(row, col)) return;
      outer02Mask[row][col] = true;
      queue.push([row, col]);
    };

    for (let col = 0; col < COLS; col += 1) {
      enqueue(0, col);
      enqueue(ROWS - 1, col);
    }
    for (let row = 0; row < ROWS; row += 1) {
      enqueue(row, 0);
      enqueue(row, COLS - 1);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const [row, col] = queue[head];
      enqueue(row - 1, col);
      enqueue(row + 1, col);
      enqueue(row, col - 1);
      enqueue(row, col + 1);
    }
  }

  const renderCellMask: boolean[][] = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => !outer02Mask[row][col])
  );
  const isRenderedCell = (row: number, col: number): boolean =>
    row >= 0 && row < ROWS && col >= 0 && col < COLS && renderCellMask[row][col];

  const gridWidth = COLS * cellSize;
  const gridHeight = ROWS * cellSize;
  const contentWidth = gridWidth + SVG_PAD * 2;
  const contentHeight = gridHeight + SVG_PAD * 2;
  const svgWidth = useCorelStyle ? Math.max(SVG_WIDTH, contentWidth) : contentWidth;
  const svgHeight = useCorelStyle ? Math.max(SVG_HEIGHT, contentHeight) : contentHeight;
  const svgWidthAttr = useCorelStyle ? formatCorelSizeMm(svgWidth) : String(svgWidth);
  const svgHeightAttr = useCorelStyle ? formatCorelSizeMm(svgHeight) : String(svgHeight);
  const svgViewBox = useCorelStyle
    ? ` viewBox="${gridOffsetX - SVG_PAD} ${gridOffsetY - SVG_PAD} ${svgWidth} ${svgHeight}"`
    : "";
  const svgParts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
  ];
  const svgRawParts: string[] = [
    `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidthAttr}" height="${svgHeightAttr}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
  ];
  const clueDefs: string[] = [];
  const clueLayer: string[] = [];
  const clueRawLayer: string[] = [];
  const borderLayer: string[] = [];
  const borderRawLayer: string[] = [];
  const outerContourLayer: string[] = [];
  const showStartNumbers = isType0Template;
  const startNumberFontSize = showStartNumbers && useCorelStyle
    ? Math.round(TYPE0_NUMBER_FONT_PT * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000
    : useCorelStyle
      ? Math.round(cellSize * 0.2 * 1000) / 1000
      : Math.max(8, Math.floor(cellSize * 0.2));
  const startNumberOffsetX = useCorelStyle ? cellSize * 0.11 : cellSize * 0.1;
  const startNumberOffsetY = useCorelStyle ? cellSize * 0.1 : cellSize * 0.08;
  const startNumberAscentRatio = 0.8;
  const startNumberBaselineAttr = ' dominant-baseline="alphabetic"';
  const startNumberByCell = showStartNumbers ? buildStartNumberByCell(slots) : new Map<string, number>();
  const clueMode = useCorelStyle ? "corel" : "default";
  const clueFont = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, clueMode);
  const clueMinFontSize = Math.min(convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, clueMode), clueFont);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!renderCellMask[r][c]) continue;
      const x = gridOffsetX + c * cellSize;
      const y = gridOffsetY + r * cellSize;
      const ch = solved[r][c] as Cell;
      const orig = grid.data[r][c] as Cell;
      const code = grid.codes[r][c];
      const clueKey = `${r},${c}`;
      const clueLayout = clueTextMap.get(clueKey);
      if (ch === "#") {
        const blockFill = debugClusterCells.has(clueKey)
          ? DEBUG_CLUSTER_COLOR
          : isType0Template && code === 0x02
            ? TYPE0_BLOCK_FILL
            : BLOCK_CELL_FILL;
        const rect = `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${blockFill}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        if (clueLayout?.text) {
          const clipId = `clue-${r}-${c}`;
          const clueSvg = renderClueText(
            x,
            y,
            cellSize,
            clueFont,
            clueLayout.text,
            clipId,
            CLUE_TEXT_FILL,
            {
              mode: clueMode,
              areaCells: clueLayout.areaCells,
              anchorCell: [r, c],
              textAlign: clueLayout.areaCells.length > 1 ? "bottom-left" : "center",
              background: clueLayout.areaCells.length > 1 ? "text-block" : "none",
              backgroundInset: clueLayout.areaCells.length > 1 ? STROKE_WIDTH : 0,
              minFontSize: clueMinFontSize,
              glyphWidthScale: CLUE_GLYPH_WIDTH_SCALE,
              lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
            }
          );
          if (clueSvg.defs) {
            clueDefs.push(clueSvg.defs);
          }
          clueLayer.push(clueSvg.text);
          clueRawLayer.push(clueSvg.text);
        }
        const border = `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none" stroke="${CELL_BORDER_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        borderLayer.push(border);
        borderRawLayer.push(border);
      } else {
        const rect = `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${EMPTY_CELL_FILL}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        const arrow = arrowSvg("export", code, orig, x, y, cellSize, cellSize * 0.8);
        if (arrow) {
          svgParts.push(arrow);
          svgRawParts.push(arrow);
        }
        const startNumber = startNumberByCell.get(clueKey);
        if (startNumber !== undefined) {
          const startNumberBaselineY = y + startNumberOffsetY + startNumberFontSize * startNumberAscentRatio;
          const numberText = `<text x="${x + startNumberOffsetX}" y="${startNumberBaselineY}" font-size="${startNumberFontSize}" fill="${TYPE0_NUMBER_TEXT_FILL}" text-anchor="start"${startNumberBaselineAttr}>${startNumber}</text>`;
          svgParts.push(numberText);
          svgRawParts.push(numberText);
        }
        const wordTextX = useCorelStyle
          ? resolveCenteredTextStartX(x, cellSize, ch, wordFontSize)
          : x + cellSize / 2;
        svgParts.push(
          `<text x="${wordTextX}" y="${y + wordTextY}" font-size="${wordFontSize}" fill="${WORD_TEXT_FILL}"${WORD_TEXT_ANCHOR_ATTR}${WORD_FONT_WEIGHT_ATTR}${WORD_BASELINE_ATTR}>${ch}</text>`
        );
        const border = `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none" stroke="${CELL_BORDER_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        borderLayer.push(border);
        borderRawLayer.push(border);
      }
    }
  }

  if (isType0Template && outerStrokeWidth > 0) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!isRenderedCell(row, col)) continue;
        const x = gridOffsetX + col * cellSize;
        const y = gridOffsetY + row * cellSize;
        if (!isRenderedCell(row - 1, col)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y}" x2="${x + cellSize}" y2="${y}" stroke="${TYPE0_OUTER_STROKE_COLOR}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row + 1, col)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y + cellSize}" x2="${x + cellSize}" y2="${y + cellSize}" stroke="${TYPE0_OUTER_STROKE_COLOR}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row, col - 1)) {
          outerContourLayer.push(
            `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + cellSize}" stroke="${TYPE0_OUTER_STROKE_COLOR}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
        if (!isRenderedCell(row, col + 1)) {
          outerContourLayer.push(
            `<line x1="${x + cellSize}" y1="${y}" x2="${x + cellSize}" y2="${y + cellSize}" stroke="${TYPE0_OUTER_STROKE_COLOR}" stroke-width="${outerStrokeWidth}" stroke-linecap="square"/>`
          );
        }
      }
    }
  }

  svgParts.push(...borderLayer, ...clueLayer);
  svgRawParts.push(...borderRawLayer, ...clueRawLayer);
  if (outerContourLayer.length) {
    svgParts.splice(1, 0, ...outerContourLayer);
    svgRawParts.splice(1, 0, ...outerContourLayer);
  }
  if (clueDefs.length) {
    svgParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
    svgRawParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
  }
  svgParts.push("</svg>");
  svgRawParts.push("</svg>");

  const svg = svgParts.join("");
  const svgRaw = svgRawParts.join("");
  const svgAnswers = buildAnswersOnlySvg(grid, solved);

  /* 6. вывод */
  mkdirSync("out", { recursive: true });
  writeFileSync("out/crossword.svg", svg);
  writeFileSync("out/crossword-no-text.svg", svgRaw);
  writeFileSync("out/crossword-answers.svg", svgAnswers);
  writeFileSync("out/used-words.txt", used);
  if (writeDefsJson) {
    writeFileSync("out/definitions-down.json", JSON.stringify(clues.down, null, 2));
    writeFileSync("out/definitions-right.json", JSON.stringify(clues.right, null, 2));
  }

  if (doCrw) {
    const crw = buildCrw(grid, slots, solved, {
      dictPath,
      templatePath,
      lowerCaseWords: true,
    });
    const crwOut = join("out", `${basename(inFile, ".fsh")}.crw`);
    writeFileSync(crwOut, crw);
    console.log(`✔ CRW  → ${crwOut}`);
  }

  const solveSec = (solveMs / 1000).toFixed(2);
  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log("✔ SVG  → out/crossword.svg");
  console.log("✔ SVG  → out/crossword-answers.svg");
  console.log("✔ words→ out/used-words.txt");
  console.log(`✔ timing → time=${totalSec}s solve=${solveSec}s`);
})();
