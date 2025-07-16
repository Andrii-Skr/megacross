#!/usr/bin/env ts-node
//------------------------------------------------------------
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs }                from "node:util";
import { parseFsh }                 from "../src/utils/parseFsh";
import { validate, scanSlots }      from "../src/utils/grid";
import { solve }                    from "../src/utils/solver";
import { loadDictionary }           from "../src/services/dictionary";
import { Cell, ROWS, COLS }         from "../src/types";

const CELL = 30; // px

// оборачиваем весь «main» в IIFE
(async () => {
  const { values, positionals } = parseArgs({
    options: { file: { type: "string", short: "f" } },
    allowPositionals: true,
  });
  const inFile = values.file ?? positionals[0];
  if (!inFile) {
    console.error("Usage: pnpm run fill-export -- --file <path.fsh>");
    process.exit(1);
  }

  /* 1. parse + validate */
  const rawRows = parseFsh(inFile);
  validate(rawRows);
  const slots   = scanSlots(rawRows);

  /* 2. load dictionary + solve */
  const dict = await loadDictionary();          // ← await внутри IIFE теперь ок
  const filledRows = solve(rawRows, slots, dict);
  if (!filledRows) {
    console.error("⚠ Не удалось подобрать слова.");
    process.exit(1);
  }

  /* 3a. make SVG */
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS*CELL}" height="${ROWS*CELL}" font-family="monospace" text-anchor="middle" dominant-baseline="central">`;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      const ch = filledRows[r][c] as Cell;
      if (ch === "#") {
        svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#000"/>`;
      } else {
        svg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#fff" stroke="#000"/>`;
        svg += `<text x="${x + CELL/2}" y="${y + CELL/2}" font-size="${CELL*0.6}">${ch}</text>`;
      }
    }
  }
  svg += "</svg>";

  /* 3b. words list */
  const usedWords = slots.map(s =>
    s.cells.map(([r,c]) => filledRows[r][c]).join("")
  );

  /* 4. write files */
  mkdirSync("out", { recursive: true });
  writeFileSync("out/crossword.svg", svg);
  writeFileSync("out/used-words.txt", usedWords.join("\n"));

  console.log("✔ crossword filled.");
  console.log("  SVG : out/crossword.svg");
  console.log("  TXT : out/used-words.txt");
})();
