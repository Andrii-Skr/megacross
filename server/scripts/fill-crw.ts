#!/usr/bin/env ts-node
//------------------------------------------------------------------
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, basename, join }  from "node:path";
import { parseArgs }                from "node:util";

import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import { solve }               from "../src/utils/solver";
import { loadDictionary }      from "../src/services/dictionary";
import { buildCrw }            from "../src/utils/writeCrw";
import { Grid }                from "../src/types";

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file:     { type: "string", short: "f" },
    out:      { type: "string", short: "o" },
    dict:     { type: "string", short: "d" },
    template: { type: "string", short: "t" },
    shuffle:  { type: "boolean", short: "s" },
  },
  allowPositionals: true,
});

const inFile = values.file ?? positionals[0];
if (!inFile) {
  console.error("Usage: pnpm run fill-crw -- --file <path.fsh> [--out <path.crw>] [--dict <path>] [--template <path>] [--shuffle]");
  process.exit(1);
}

const outFile =
  values.out ?? join("out", `${basename(inFile, ".fsh")}.crw`);
const dictPath = values.dict ?? "";
const templatePath = values.template ?? inFile;
const doShuffle = values.shuffle === true;

(async () => {
  /* 1. parse + validate */
  const grid: Grid = parseFsh(inFile);
  validate(grid);

  /* 2. slots + dictionary */
  const slots = scanSlots(grid);
  const dict = await loadDictionary();

  /* 3. solve */
  const solved = solve(grid.data, slots, dict, doShuffle);
  if (!solved) {
    console.error("Не удалось заполнить: словаря недостаточно.");
    process.exit(1);
  }

  /* 4. build crw */
  const crw = buildCrw(grid, slots, solved, {
    dictPath,
    templatePath,
    lowerCaseWords: true,
  });

  /* 5. write */
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, crw);

  console.log(`✔ CRW → ${outFile}`);
})();
