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
import { buildClueTextMap, renderClueText, resolveMinClueFontSize } from "./clue-svg";
import { resolveCenteredTextStartX } from "./text-position";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  COREL_CELL_SIZE_UNITS,
  COREL_MIN_SVG_HEIGHT_UNITS,
  COREL_MIN_SVG_WIDTH_UNITS,
  COREL_STROKE_WIDTH_UNITS,
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
const GRID_OFFSET_X = (useCorelStyle ? -CELL / 2 : 0) + GRID_PAD;
const GRID_OFFSET_Y = (useCorelStyle ? -Math.round(CELL * 0.034) : 0) + GRID_PAD;
const WORD_FONT_SIZE = useCorelStyle
  ? Math.round(CELL * 0.565 * 1000) / 1000
  : CELL * 0.6;
const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
const WORD_TEXT_ANCHOR_ATTR = useCorelStyle ? ' text-anchor="start"' : "";
const WORD_TEXT_Y = useCorelStyle ? CELL * 0.7 : CELL / 2;
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

if (!inFile) {
  console.error("Usage: pnpm run fill-export -- --file <path.fsh> [--shuffle] [--crw] [--dict <path>] [--template <path>] [--style corel] [--no-defs|--no-clues]");
  process.exit(1);
}

(async () => {
  const startedAt = Date.now();
  /* 1. parse + validate */
  const grid: Grid = parseFsh(inFile);   // { rows, cols, marker, data[] }
  validate(grid);

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
  const gridWidth = COLS * CELL;
  const gridHeight = ROWS * CELL;
  const contentWidth = gridWidth + SVG_PAD * 2;
  const contentHeight = gridHeight + SVG_PAD * 2;
  const svgWidth = useCorelStyle ? Math.max(SVG_WIDTH, contentWidth) : contentWidth;
  const svgHeight = useCorelStyle ? Math.max(SVG_HEIGHT, contentHeight) : contentHeight;
  const svgWidthAttr = useCorelStyle ? formatCorelSizeMm(svgWidth) : String(svgWidth);
  const svgHeightAttr = useCorelStyle ? formatCorelSizeMm(svgHeight) : String(svgHeight);
  const svgViewBox = useCorelStyle
    ? ` viewBox="${GRID_OFFSET_X - SVG_PAD} ${GRID_OFFSET_Y - SVG_PAD} ${svgWidth} ${svgHeight}"`
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
  const clueMode = useCorelStyle ? "corel" : "default";
  const clueFont = Math.max(resolveMinClueFontSize(clueMode), Math.floor(CELL * 0.22));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_OFFSET_X + c * CELL, y = GRID_OFFSET_Y + r * CELL;
      const ch = solved[r][c] as Cell;
      const orig = grid.data[r][c] as Cell;
      const code = grid.codes[r][c];
      const clueKey = `${r},${c}`;
      const clueLayout = clueTextMap.get(clueKey);
      if (ch === "#") {
        const blockFill = debugClusterCells.has(clueKey) ? DEBUG_CLUSTER_COLOR : BLOCK_CELL_FILL;
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${blockFill}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        if (clueLayout?.text) {
          const clipId = `clue-${r}-${c}`;
          const clueSvg = renderClueText(
            x,
            y,
            CELL,
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
            }
          );
          if (clueSvg.defs) {
            clueDefs.push(clueSvg.defs);
          }
          clueLayer.push(clueSvg.text);
          clueRawLayer.push(clueSvg.text);
        }
        const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        borderLayer.push(border);
        borderRawLayer.push(border);
      } else {
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${EMPTY_CELL_FILL}"/>`;
        svgParts.push(rect);
        svgRawParts.push(rect);
        const arrow = arrowSvg("export", code, orig, x, y, CELL, CELL * 0.8);
        if (arrow) {
          svgParts.push(arrow);
          svgRawParts.push(arrow);
        }
        const wordTextX = useCorelStyle
          ? resolveCenteredTextStartX(x, CELL, ch, WORD_FONT_SIZE)
          : x + CELL / 2;
        svgParts.push(
          `<text x="${wordTextX}" y="${y + WORD_TEXT_Y}" font-size="${WORD_FONT_SIZE}" fill="${WORD_TEXT_FILL}"${WORD_TEXT_ANCHOR_ATTR}${WORD_FONT_WEIGHT_ATTR}${WORD_BASELINE_ATTR}>${ch}</text>`
        );
        const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
        borderLayer.push(border);
        borderRawLayer.push(border);
      }
    }
  }
  svgParts.push(...borderLayer, ...clueLayer);
  svgRawParts.push(...borderRawLayer, ...clueRawLayer);
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
