#!/usr/bin/env tsx
//------------------------------------------------------------------
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { loadDefinitions, loadDictionary } from "../src/services/dictionary";
import type { Grid } from "../src/types";
import { validate, scanSlots } from "../src/utils/grid";
import { parseFsh } from "../src/utils/parseFsh";
import { solve } from "../src/utils/solver";
import { buildClueEntries } from "../src/utils/clues";
import { buildCrw } from "../src/utils/writeCrw";
import { buildAnswersOnlySvg } from "./answer-only-svg";
import { buildCrosswordSvg } from "./crossword-svg";

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file: { type: "string", short: "f" },
    shuffle: { type: "boolean", short: "s" },
    crw: { type: "boolean", short: "c" },
    dict: { type: "string", short: "d" },
    template: { type: "string", short: "t" },
    style: { type: "string" },
    "no-defs": { type: "boolean" },
    "no-clues": { type: "boolean" },
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
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}

if (!inFile) {
  console.error("Usage: pnpm run fill-export -- --file <path.fsh> [--shuffle] [--crw] [--dict <path>] [--template <path>] [--style corel] [--no-defs|--no-clues]");
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
  const { svg, svgRaw, usedWords: used } = buildCrosswordSvg(grid, slots, solved, definitions, {
    style: useCorelStyle ? "corel" : "default",
    arrowMode: "export",
    arrowScale: 0.8,
    debugClusterFill: true,
    fontFamily: useCorelStyle ? "Arial" : "monospace",
    type0Features: true,
  });
  const svgAnswers = buildAnswersOnlySvg(grid, solved);

  /* 5. output */
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
