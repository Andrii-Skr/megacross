#!/usr/bin/env ts-node
//------------------------------------------------------------------
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs }                from "node:util";
import { parseFsh }                 from "../src/utils/parseFsh";
import { validate, scanSlots }      from "../src/utils/grid";
import { solve }                    from "../src/utils/solver";
import { loadDictionary }           from "../src/services/dictionary";
import { Cell, Grid }               from "../src/types";
import { arrowSvg }                 from "./arrow-utils";

const CELL = 30;                         // px

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file:    { type: "string",  short: "f" },
    shuffle: { type: "boolean", short: "s" },
  },
  allowPositionals: true,
});
const inFile    = values.file ?? positionals[0];
const doShuffle = values.shuffle === true;

if (!inFile) {
  console.error("Usage: pnpm run fill-export -- --file <path.fsh> [--shuffle]");
  process.exit(1);
}

(async () => {
  /* 1. parse + validate */
  const grid: Grid = parseFsh(inFile);   // { rows, cols, marker, data[] }
  validate(grid);

  /* 2. slots + dictionary */
  const slots = scanSlots(grid);
  const dict  = await loadDictionary();

  /* 3. solve */
  const solved = solve(grid.data, slots, dict, doShuffle);
  if (!solved) {
    console.error("Не удалось заполнить: словаря недостаточно.");
    process.exit(1);
  }

  /* 4. SVG */
  const { rows: ROWS, cols: COLS } = grid;
  let svg    = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS*CELL}" height="${ROWS*CELL}" font-family="monospace" text-anchor="middle" dominant-baseline="central">`;
  let svgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS*CELL}" height="${ROWS*CELL}" font-family="monospace" text-anchor="middle" dominant-baseline="central">`;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      const ch = solved[r][c] as Cell;
      const orig = grid.data[r][c] as Cell
      const code = grid.codes[r][c];
      if (ch === "#") {
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#000"/>`;
        svg += rect;
        svgRaw += rect;
      } else {
        const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#fff" stroke="#000"/>`;
        svg += rect;
        svgRaw += rect;
        const arrow = arrowSvg("export", code, orig, x, y, CELL, CELL * 0.8);
        if (arrow) {
          svg += arrow;
          svgRaw += arrow;
        }
        svg += `<text x="${x + CELL/2}" y="${y + CELL/2}" font-size="${CELL*0.6}">${ch}</text>`;
      }
    }
  }
  svg    += "</svg>";
  svgRaw += "</svg>";

  /* 5. список использованных слов */
  const used = slots
    .map(s => s.cells.map(([r,c]) => solved[r][c]).join(""))
    .join("\n");

  /* 6. вывод */
  mkdirSync("out", { recursive: true });
  writeFileSync("out/crossword.svg", svg);
  writeFileSync("out/crossword-no-text.svg", svgRaw);
  writeFileSync("out/used-words.txt", used);

  console.log("✔ SVG  → out/crossword.svg");
  console.log("✔ words→ out/used-words.txt");
})();
