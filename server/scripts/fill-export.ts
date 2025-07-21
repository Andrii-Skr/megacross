#!/usr/bin/env ts-node
//------------------------------------------------------------------
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join }                     from "node:path";
import { parseArgs }                from "node:util";
import { parseFsh }                 from "../src/utils/parseFsh";
import { validate, scanSlots }      from "../src/utils/grid";
import { solve }                    from "../src/utils/solver";
import { loadDictionary }           from "../src/services/dictionary";
import { Cell, Grid }               from "../src/types";

const CELL = 30;                         // px
const ARROW_01 = readFileSync(join(__dirname, "../src/arrows/01.svg")).toString("base64");
const ARROW_18 = readFileSync(join(__dirname, "../src/arrows/18.svg")).toString("base64");
const ARROW_28 = readFileSync(join(__dirname, "../src/arrows/28.svg")).toString("base64");
const ARROW_30 = readFileSync(join(__dirname, "../src/arrows/30.svg")).toString("base64");

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
        if (code === 0x30 || code === 0x18 || code === 0x28 || code === 0x29 || (code === 0x01 && orig === "↓")) {
          const size = CELL * 0.8;
          if (code === 0x29) {
            const ax1 = x + CELL / 2 - size / 2;
            const ay1 = y;
            const arrow1 = `<image href="data:image/svg+xml;base64,${ARROW_01}" x="${ax1}" y="${ay1}" width="${size}" height="${size}"/>`;
            svg += arrow1;
            svgRaw += arrow1;
            const ax2 = x + CELL / 2 - size / 2;
            const ay2 = y + CELL - size;
            const arrow2 = `<image href="data:image/svg+xml;base64,${ARROW_28}" x="${ax2}" y="${ay2}" width="${size}" height="${size}"/>`;
            svg += arrow2;
            svgRaw += arrow2;
          } else {
            let ax = x, ay = y, img = ARROW_30;
            if (code === 0x30) {
              ax = x;
              ay = y;
              img = ARROW_30;
            } else if (code === 0x18) {
              ax = x + CELL - size;
              ay = y + CELL / 2 - size / 2;
              img = ARROW_18;
            } else if (code === 0x28) {
              ax = x + CELL / 2 - size / 2;
              ay = y + CELL - size;
              img = ARROW_28;
            } else if (code === 0x01) {
              ax = x + CELL / 2 - size / 2;
              ay = y;
              img = ARROW_01;
            }
            const arrow = `<image href="data:image/svg+xml;base64,${img}" x="${ax}" y="${ay}" width="${size}" height="${size}"/>`;
            svg += arrow;
            svgRaw += arrow;
          }
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
