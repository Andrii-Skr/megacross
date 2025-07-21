
//  • читает ВСЕ *.fsh в sample/
//  • решает каждый кроссворд (shuffle optional)
//  • флаг -u / --unique  → слово используется только один раз за весь запуск
//  • сохраняет SVG + used-words.txt в out/<basename>/
//------------------------------------------------------------------
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename, extname }               from "node:path";
import { parseArgs }                             from "node:util";

import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import { solve }               from "../src/utils/solver";
import { loadDictionary }      from "../src/services/dictionary";
import { Cell, Grid }          from "../src/types";
import { arrowSvg }            from "./arrow-utils";

const CELL       = 30;        // px
const SAMPLE_DIR = "sample";
const OUT_DIR    = "out";

/* ---------- CLI ---------- */
const { values } = parseArgs({
  options: {
    shuffle: { type: "boolean", short: "s" },
    unique:  { type: "boolean", short: "u" },
  },
});
const doShuffle = !!values.shuffle;
const unique    = !!values.unique;

/* ---------- ищем .fsh ---------- */
const files = readdirSync(SAMPLE_DIR)
  .filter(f => extname(f).toLowerCase() === ".fsh")
  .map(f => join(SAMPLE_DIR, f));

if (!files.length) {
  console.log("Нет *.fsh в sample/");
  process.exit(0);
}


(async () => {
  /* 1. словарь на весь раунд */
  const masterDict = await loadDictionary();

  /* если уникальный режим — будем прямо мутировать глобальный экземпляр */
  const globalDict = unique
    ? new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]))
    : masterDict;

  for (const path of files) {
    const name = basename(path, ".fsh");
    console.log(`\n● ${name} …`);

    try {
      /* 2. parse + validate */
      const grid: Grid = parseFsh(path);
      validate(grid);

      /* 3. slots */
      const slots = scanSlots(grid);

      /* 4. словарь для решения */
      const dict = unique
        ? globalDict
        : new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]));

      /* 5. solve */
      const solved = solve(grid.data, slots, dict, doShuffle);
      if (!solved) { console.warn("  ⚠ недостаточно слов"); continue; }

      /* 6. если уникальный режим — вычёркиваем использованные слова */
      if (unique) {
        const usedHere = slots.map(s =>
          s.cells.map(([r, c]) => solved[r][c]).join("")
        );
        for (const w of usedHere) {
          const len = w.length;
          const arr = globalDict.get(len);
          if (arr) {
            const idx = arr.indexOf(w);
            if (idx >= 0) arr.splice(idx, 1);
          }
        }
      }

      /* 7. SVG */
      const { rows: ROWS, cols: COLS } = grid;

      let svg    = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${ROWS * CELL}" font-family="monospace" text-anchor="middle" dominant-baseline="central">`;
      let svgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${ROWS * CELL}" font-family="monospace" text-anchor="middle" dominant-baseline="central">`;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * CELL, y = r * CELL;
          const ch = solved[r][c] as Cell;
          const orig = grid.data[r][c] as Cell;
          const code = grid.codes[r][c];

          if (ch === "#") {
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#333333"/>`;
            svg += rect;
            svgRaw += rect;
          } else {
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#fff" stroke="#333333"/>`;
            svg += rect;
            svgRaw += rect;
            const arrow = arrowSvg("batch", code, orig, x, y, CELL, CELL * 0.6);
            if (arrow) {
              svg += arrow;
              svgRaw += arrow;
            }
            svg += `<text x="${x + CELL / 2}" y="${y + CELL / 2}" font-size="${CELL * 0.6}">${ch}</text>`;
          }
        }
      }
      svg    += "</svg>";
      svgRaw += "</svg>";

      /* 8. список использованных слов */
      const usedWords = slots
        .map(s => s.cells.map(([r, c]) => solved[r][c]).join(""))
        .join("\n");

      /* 9. write */
      const dstDir = join(OUT_DIR, name);
      mkdirSync(dstDir, { recursive: true });
      writeFileSync(join(dstDir, "crossword.svg"), svg);
      writeFileSync(join(dstDir, "crossword-no-text.svg"), svgRaw);
      writeFileSync(join(dstDir, "used-words.txt"), usedWords);

      console.log(`  ✔ готово → ${dstDir}`);
    } catch (e) {
      console.error("  🛑", (e as Error).message);
    }
  }

  console.log("\nВсе файлы обработаны.");
})();
