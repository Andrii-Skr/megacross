#!/usr/bin/env ts-node
//------------------------------------------------------------------
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename, extname }               from "node:path";
import { parseArgs }                             from "node:util";

import { parseFsh }        from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import { solve }              from "../src/utils/solver";
import { loadDictionary }     from "../src/services/dictionary";
import { Cell, Grid }         from "../src/types";

const CELL       = 30;          // px
const SAMPLE_DIR = "sample";
const OUT_DIR    = "out";

const { values } = parseArgs({
  options: { shuffle: { type: "boolean", short: "s" } },
});
const doShuffle = values.shuffle === true;

/* ищем все .fsh */
const files = readdirSync(SAMPLE_DIR)
  .filter(f => extname(f).toLowerCase() === ".fsh")
  .map(f => join(SAMPLE_DIR, f));

if (!files.length) { console.log("Нет *.fsh в sample/"); process.exit(0); }

/* ── всё асинхронное в IIFE ─────────────────────────────── */
(async () => {
  const dictMaster = await loadDictionary();  // 1 раз

  for (const path of files) {
    const name = basename(path, ".fsh");
    console.log(`\n● ${name} …`);

    try {
      const grid: Grid = parseFsh(path);   // { rows, cols, marker, data[] }
      validate(grid);
      const slots = scanSlots(grid);

      /* копия словаря, чтобы файлы не влияли друг на друга */
      const dict = new Map<number, string[]>(
        [...dictMaster].map(([len, arr]) => [len, [...arr]])
      );

      const solvedData = solve(grid.data, slots, dict, doShuffle);
      if (!solvedData) { console.warn("  ⚠ недостаточно слов"); continue; }

      /* ── SVG ── */
      const { rows: ROWS, cols: COLS } = grid;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" ` +
                `width="${COLS * CELL}" height="${ROWS * CELL}" ` +
                `font-family="monospace" text-anchor="middle" dominant-baseline="central">`;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * CELL, y = r * CELL;
          const ch = solvedData[r][c] as Cell;
          if (ch === "#") {
            svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#000"/>`;
          } else {
            svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#fff" stroke="#000"/>`;
            svg += `<text x="${x + CELL / 2}" y="${y + CELL / 2}" font-size="${CELL * 0.6}">${ch}</text>`;
          }
        }
      }
      svg += "</svg>";

      /* список использованных слов */
      const used = slots
        .map(s => s.cells.map(([r, c]) => solvedData[r][c]).join(""))
        .join("\n");

      const dst = join(OUT_DIR, name);
      mkdirSync(dst, { recursive: true });
      writeFileSync(join(dst, "crossword.svg"), svg);
      writeFileSync(join(dst, "used-words.txt"), used);

      console.log(`  ✔ готово → ${dst}`);
    } catch (e) {
      console.error("  🛑", (e as Error).message);
    }
  }

  console.log("\nВсе файлы обработаны.");
})();
