
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
import { loadDictionary, loadDefinitions } from "../src/services/dictionary";
import { buildCrw }            from "../src/utils/writeCrw";
import { buildClueEntries }    from "../src/utils/clues";
import { Cell, Grid }          from "../src/types";
import { arrowSvg }            from "./arrow-utils";
import { buildClueTextMap, renderClueText } from "./clue-svg";
import {
  BLOCK_CELL_FILL,
  CELL_STROKE_COLOR,
  CELL_STROKE_WIDTH,
  CLUE_TEXT_FILL,
  WORD_TEXT_FILL,
} from "./svg-theme";

const DEFAULT_CELL       = 30;        // px
const SAMPLE_DIR = "sample";
const OUT_DIR    = "out";

/* ---------- CLI ---------- */
const { values } = parseArgs({
  options: {
    shuffle: { type: "boolean", short: "s" },
    unique:  { type: "boolean", short: "u" },
    crw:     { type: "boolean", short: "c" },
    dict:    { type: "string",  short: "d" },
    template:{ type: "string",  short: "t" },
    style:   { type: "string" },
  },
});
const doShuffle = !!values.shuffle;
const unique    = !!values.unique;
const doCrw     = !!values.crw;
const dictPath  = values.dict ?? "";
const templatePath = values.template ?? "";
const styleName = (values.style ?? "default").toLowerCase();
const useCorelStyle = styleName === "corel";
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}
const CELL = useCorelStyle ? 118 : DEFAULT_CELL;
const EMPTY_CELL_FILL = useCorelStyle ? "#FEFEFE" : "#fff";
const GRID_OFFSET_X = useCorelStyle ? -CELL / 2 : 0;
const GRID_OFFSET_Y = useCorelStyle ? -Math.round(CELL * 0.034) : 0;
const STROKE_WIDTH = useCorelStyle
  ? Math.round(CELL * 0.07 * 1000) / 1000
  : CELL_STROKE_WIDTH;
const WORD_FONT_SIZE = useCorelStyle
  ? Math.round(CELL * 0.565 * 1000) / 1000
  : CELL * 0.6;
const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
const WORD_TEXT_Y = useCorelStyle ? CELL * 0.7 : CELL / 2;
const SVG_WIDTH = useCorelStyle ? 2480 : 0;
const SVG_HEIGHT = useCorelStyle ? 3508 : 0;
const SVG_VIEWBOX = useCorelStyle ? ` viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"` : "";
const SVG_XML_SPACE = useCorelStyle ? ' xml:space="preserve"' : "";
const SVG_STYLE_ATTR = useCorelStyle
  ? ' style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"'
  : "";
const SVG_PREAMBLE = useCorelStyle
  ? '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
  : "";
const FONT_FAMILY = useCorelStyle ? "Arial" : "monospace";

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
      const usedWordsList = slots.map((s) =>
        s.cells.map(([r, c]) => solved[r][c]).join("")
      );
      const usedWords = usedWordsList.join("\n");
      const definitions = await loadDefinitions(usedWordsList);
      const clues = buildClueEntries(grid, slots, solved, definitions);
      const clueTextMap = buildClueTextMap([...clues.down, ...clues.right]);

      const svgParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${useCorelStyle ? SVG_WIDTH : COLS * CELL}" height="${useCorelStyle ? SVG_HEIGHT : ROWS * CELL}"${SVG_VIEWBOX}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
      ];
      const svgRawParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${useCorelStyle ? SVG_WIDTH : COLS * CELL}" height="${useCorelStyle ? SVG_HEIGHT : ROWS * CELL}"${SVG_VIEWBOX}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
      ];
      const clueDefs: string[] = [];
      const clueFont = Math.max(5, Math.floor(CELL * 0.22));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = GRID_OFFSET_X + c * CELL, y = GRID_OFFSET_Y + r * CELL;
          const ch = solved[r][c] as Cell;
          const orig = grid.data[r][c] as Cell;
          const code = grid.codes[r][c];
          const clueKey = `${r},${c}`;
          const clueText = clueTextMap.get(clueKey);

          if (ch === "#") {
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${BLOCK_CELL_FILL}"/>`;
            svgParts.push(rect);
            svgRawParts.push(rect);
            if (clueText) {
              const clipId = `clue-${r}-${c}`;
              const clueSvg = renderClueText(
                x,
                y,
                CELL,
                clueFont,
                clueText,
                clipId,
                CLUE_TEXT_FILL
              );
              clueDefs.push(clueSvg.defs);
              svgParts.push(clueSvg.text);
              svgRawParts.push(clueSvg.text);
            }
            const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
            svgParts.push(border);
            svgRawParts.push(border);
          } else {
            const rect = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${EMPTY_CELL_FILL}"/>`;
            svgParts.push(rect);
            svgRawParts.push(rect);
            const arrow = arrowSvg("batch", code, orig, x, y, CELL, CELL * 0.6);
            if (arrow) {
              svgParts.push(arrow);
              svgRawParts.push(arrow);
            }
            svgParts.push(
              `<text x="${x + CELL / 2}" y="${y + WORD_TEXT_Y}" font-size="${WORD_FONT_SIZE}" fill="${WORD_TEXT_FILL}"${WORD_FONT_WEIGHT_ATTR}${WORD_BASELINE_ATTR}>${ch}</text>`
            );
            const border = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${CELL_STROKE_COLOR}" stroke-width="${STROKE_WIDTH}"/>`;
            svgParts.push(border);
            svgRawParts.push(border);
          }
        }
      }
      if (clueDefs.length) {
        svgParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
        svgRawParts.splice(1, 0, `<defs>${clueDefs.join("")}</defs>`);
      }
      svgParts.push("</svg>");
      svgRawParts.push("</svg>");

      const svg = svgParts.join("");
      const svgRaw = svgRawParts.join("");

      /* 9. write */
      const dstDir = join(OUT_DIR, name);
      mkdirSync(dstDir, { recursive: true });
      writeFileSync(join(dstDir, "crossword.svg"), svg);
      writeFileSync(join(dstDir, "crossword-no-text.svg"), svgRaw);
      writeFileSync(join(dstDir, "used-words.txt"), usedWords);
      writeFileSync(join(dstDir, "definitions-down.json"), JSON.stringify(clues.down, null, 2));
      writeFileSync(join(dstDir, "definitions-right.json"), JSON.stringify(clues.right, null, 2));

      if (doCrw) {
        const crw = buildCrw(grid, slots, solved, {
          dictPath,
          templatePath: templatePath || path,
          lowerCaseWords: true,
        });
        const crwOut = join(dstDir, `${name}.crw`);
        writeFileSync(crwOut, crw);
      }

      console.log(`  ✔ готово → ${dstDir}`);
    } catch (e) {
      console.error("  🛑", (e as Error).message);
    }
  }

  console.log("\nВсе файлы обработаны.");
})();
