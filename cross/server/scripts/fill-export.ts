#!/usr/bin/env tsx
//------------------------------------------------------------------
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { loadDefinitions, loadDictionary } from "../src/services/dictionary";
import type { Grid } from "../src/types";
import { validate, scanSlots } from "../src/utils/grid";
import { parseFsh } from "../src/utils/parseFsh";
import { solve } from "../src/utils/solver";
import { buildClueEntries } from "../src/utils/clues";
import { buildCrosswordTextFiles } from "../src/utils/crosswordTextExport";
import { buildCrw } from "../src/utils/writeCrw";
import { buildAnswersOnlySvg } from "./answer-only-svg";
import { buildCrosswordSvg } from "./crossword-svg";
import {
  DEFAULT_ANSWER_CELL_SIZE_MM,
  DEFAULT_TEMPLATE_CELL_SIZE_MM,
  DEFAULT_TYPE0_CELL_SIZE_MM,
} from "./svg-theme";
import { exportSvgFilesToEps } from "../src/utils/epsExport";

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file: { type: "string", short: "f" },
    shuffle: { type: "boolean", short: "s" },
    crw: { type: "boolean", short: "c" },
    dict: { type: "string", short: "d" },
    template: { type: "string", short: "t" },
    style: { type: "string" },
    eps: { type: "boolean" },
    "no-defs": { type: "boolean" },
    "no-clues": { type: "boolean" },
    "template-cell-mm": { type: "string" },
    "answer-cell-mm": { type: "string" },
    "type0-cell-mm": { type: "string" },
  },
  allowPositionals: true,
});
const inFile = values.file ?? positionals[0];
const doShuffle = values.shuffle === true;
const doCrw = values.crw === true;
const writeDefsJson = !values["no-defs"] && !values["no-clues"];
const dictPath = values.dict ?? "";
const templatePath = values.template ?? inFile;
const styleName = (values.style ?? "default").toLowerCase();
const useCorelStyle = styleName === "corel";
const writeEps = values.eps === true;
const templateCellSizeMm = parseCellSizeMm(values["template-cell-mm"], DEFAULT_TEMPLATE_CELL_SIZE_MM, "--template-cell-mm");
const answerCellSizeMm = parseCellSizeMm(values["answer-cell-mm"], DEFAULT_ANSWER_CELL_SIZE_MM, "--answer-cell-mm");
const type0CellSizeMm = parseCellSizeMm(values["type0-cell-mm"], DEFAULT_TYPE0_CELL_SIZE_MM, "--type0-cell-mm");
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}

function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
}

function parseCellSizeMm(value: string | undefined, fallback: number, optionName: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName}: "${value}". Expected a positive number.`);
  }
  const rounded = Number(parsed.toFixed(3));
  if (rounded <= 0) throw new Error(`Invalid ${optionName}: "${value}". Expected at least 0.001 mm.`);
  return rounded;
}

if (!inFile) {
  console.error("Usage: pnpm run fill-export -- --file <path.fsh> [--shuffle] [--crw] [--eps] [--dict <path>] [--template <path>] [--style corel] [--no-defs|--no-clues]");
  process.exit(1);
}

(async () => {
  const startedAt = Date.now();

  /* 1. parse + validate */
  const grid: Grid = parseFsh(inFile);
  validate(grid);

  /* 2. slots + dictionary */
  const slots = scanSlots(grid);
  const lengths = [...new Set(slots.map((slot) => slot.len))];
  const dict = await loadDictionary({ langCode: "ru", lengths });

  /* 3. solve */
  const solveStartedAt = Date.now();
  const solved = solve(grid.data, slots, dict, doShuffle);
  const solveMs = Date.now() - solveStartedAt;
  if (!solved) {
    console.error("Не удалось заполнить: словаря недостаточно.");
    process.exit(1);
  }

  /* 4. SVG */
  const usedWords = slots.map((slot) => slot.cells.map(([row, col]) => solved[row][col]).join(""));
  const definitions = await loadDefinitions(usedWords, { langCode: "ru" });
  const clues = buildClueEntries(grid, slots, solved, definitions);
  const crosswordText = buildCrosswordTextFiles(grid, slots, solved, definitions);
  const { svg, svgRaw, usedWords: used } = buildCrosswordSvg(grid, slots, solved, definitions, {
    style: useCorelStyle ? "corel" : "default",
    arrowMode: "export",
    arrowScale: 0.8,
    debugClusterFill: isTruthyEnv(process.env.CROSS_ENABLE_02_AREA_EXPANSION),
    fontFamily: useCorelStyle ? "Arial" : "monospace",
    templateCellSizeMm,
    type0CellSizeMm,
    type0Features: true,
  });
  const svgAnswers = buildAnswersOnlySvg(grid, solved, answerCellSizeMm);

  /* 5. output */
  mkdirSync("out", { recursive: true });
  writeFileSync("out/crossword.svg", svg);
  writeFileSync("out/crossword-no-text.svg", svgRaw);
  writeFileSync("out/crossword-answers.svg", svgAnswers);
  if (writeEps) {
    await exportSvgFilesToEps([
      "out/crossword.svg",
      "out/crossword-no-text.svg",
      "out/crossword-answers.svg",
    ]);
  }
  writeFileSync("out/used-words.txt", crosswordText?.words ?? used);
  if (!crosswordText || !writeDefsJson) rmSync("out/clues.txt", { force: true });
  if (writeDefsJson) {
    if (crosswordText) writeFileSync("out/clues.txt", crosswordText.clues);
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
  if (writeEps) console.log("✔ EPS  → out/crossword*.eps");
  console.log("✔ words→ out/used-words.txt");
  console.log(`✔ timing → time=${totalSec}s solve=${solveSec}s`);
})();
