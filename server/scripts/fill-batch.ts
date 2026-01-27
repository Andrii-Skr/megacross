
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
import { solve, type SolveProgress }               from "../src/utils/solver";
import { isNativeDlxAvailable, solveDlxNativeAsync } from "../src/utils/nativeDlx";
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

function formatLenCountsAligned(
  lengths: number[],
  primary: Map<number, number>,
  secondary: Map<number, number>,
  prefix: string
): string {
  const lenWidth = Math.max(1, ...lengths.map((len) => String(len).length));
  const colWidths = lengths.map((len) => {
    const a = primary.get(len) ?? 0;
    const b = secondary.get(len) ?? 0;
    const countWidth = Math.max(String(a).length, String(b).length, 1);
    return lenWidth + 1 + countWidth;
  });
  return (
    prefix +
    lengths
      .map((len, i) => {
        const count = primary.get(len) ?? 0;
        const countWidth = colWidths[i] - lenWidth - 1;
        const lenStr = String(len).padStart(lenWidth, " ");
        const countStr = String(count).padStart(countWidth, " ");
        return `${lenStr}:${countStr}`;
      })
      .join("  ")
  );
}

/* ---------- CLI ---------- */
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    shuffle: { type: "boolean", short: "s" },
    unique:  { type: "boolean", short: "u" },
    crw:     { type: "boolean", short: "c" },
    progress:{ type: "boolean", short: "p" },
    logMs:   { type: "string" },
    "log-ms":{ type: "string" },
    maxMs:   { type: "string" },
    "max-ms":{ type: "string" },
    maxNodes:{ type: "string" },
    "max-nodes":{ type: "string" },
    lcv:     { type: "boolean" },
    debugDlx:{ type: "boolean" },
    "debug-dlx":{ type: "boolean" },
    nativeDlx:{ type: "boolean" },
    "native-dlx":{ type: "boolean" },
    parallel: { type: "string" },
    "parallel-restarts": { type: "string" },
    restarts:{ type: "string" },
    dict:    { type: "string",  short: "d" },
    template:{ type: "string",  short: "t" },
    style:   { type: "string" },
    "no-defs": { type: "boolean" },
    "no-clues": { type: "boolean" },
  },
});
const shuffleOpt = values.shuffle === true ? true : undefined;
const unique    = !!values.unique;
const doCrw     = !!values.crw;
const doProgress = !!values.progress;
const progressMinMs = 5000;
const logEveryMsRaw = values.logMs ?? values["log-ms"];
const logEveryMsParsed = logEveryMsRaw !== undefined ? Number(logEveryMsRaw) : NaN;
const logEveryMs = Number.isFinite(logEveryMsParsed) ? logEveryMsParsed : 5000;
const maxMsRaw = values.maxMs
  ? Number(values.maxMs)
  : values["max-ms"] ? Number(values["max-ms"]) : undefined;
const maxNodesRaw = values.maxNodes
  ? Number(values.maxNodes)
  : values["max-nodes"] ? Number(values["max-nodes"]) : undefined;
const maxMs = Number.isFinite(maxMsRaw) ? maxMsRaw : undefined;
const maxNodes = Number.isFinite(maxNodesRaw) ? maxNodesRaw : undefined;
const doLcv = !!values.lcv;
const debugDlx = !!values.debugDlx || !!values["debug-dlx"];
const nativeDlx = !!values.nativeDlx || !!values["native-dlx"];
const restartsRaw = values.restarts ? Number(values.restarts) : 1;
const restarts = Number.isFinite(restartsRaw) && restartsRaw > 0 ? Math.floor(restartsRaw) : 1;
const parallelRaw = values.parallel
  ? Number(values.parallel)
  : values["parallel-restarts"] ? Number(values["parallel-restarts"]) : undefined;
const parallelRestarts = Number.isFinite(parallelRaw) && parallelRaw && parallelRaw > 1
  ? Math.floor(parallelRaw)
  : 1;
const dictPath  = values.dict ?? "";
const templatePath = values.template ?? "";
const styleName = (values.style ?? "default").toLowerCase();
const writeDefsJson = !values["no-defs"] && !values["no-clues"];
const useCorelStyle = styleName === "corel";
if (!["default", "corel"].includes(styleName)) {
  console.warn(`Unknown SVG style "${values.style}", using default.`);
}
const CELL = useCorelStyle ? 118 : DEFAULT_CELL;
const EMPTY_CELL_FILL = useCorelStyle ? "#FEFEFE" : "#fff";
const STROKE_WIDTH = useCorelStyle
  ? Math.round(CELL * 0.07 * 1000) / 1000
  : CELL_STROKE_WIDTH;
const SVG_PAD = STROKE_WIDTH / 2;
const GRID_PAD = useCorelStyle ? 0 : SVG_PAD;
const GRID_OFFSET_X = (useCorelStyle ? -CELL / 2 : 0) + GRID_PAD;
const GRID_OFFSET_Y = (useCorelStyle ? -Math.round(CELL * 0.034) : 0) + GRID_PAD;
const WORD_FONT_SIZE = useCorelStyle
  ? Math.round(CELL * 0.565 * 1000) / 1000
  : CELL * 0.6;
const WORD_FONT_WEIGHT_ATTR = useCorelStyle ? ' font-weight="bold"' : "";
const WORD_BASELINE_ATTR = useCorelStyle ? ' dominant-baseline="alphabetic"' : "";
const WORD_TEXT_Y = useCorelStyle ? CELL * 0.7 : CELL / 2;
const SVG_WIDTH = useCorelStyle ? 2480 : 0;
const SVG_HEIGHT = useCorelStyle ? 3508 : 0;
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
  const batchStartedAt = Date.now();
  let solveTotalMs = 0;
  let solvedCount = 0;
  let failedCount = 0;
  const entries: {
    path: string;
    name: string;
    grid: Grid;
    slots: ReturnType<typeof scanSlots>;
  }[] = [];
  const lengthsSet = new Set<number>();

  for (const path of files) {
    const name = basename(path, ".fsh");
    try {
      const grid: Grid = parseFsh(path);
      validate(grid);
      const slots = scanSlots(grid);
      entries.push({ path, name, grid, slots });
      for (const s of slots) lengthsSet.add(s.len);
    } catch (e) {
      console.error(`  🛑 ${name}:`, (e as Error).message);
    }
  }

  if (!entries.length) {
    console.log("Нет валидных *.fsh для решения.");
    return;
  }

  /* 1. словарь на весь раунд */
  const lengths = [...lengthsSet];
  const masterDict = await loadDictionary({ langCode: "ru", lengths });
  const dictCounts = new Map<number, number>();
  for (const len of lengths) {
    dictCounts.set(len, masterDict.get(len)?.length ?? 0);
  }
  const totalSlotCounts = new Map<number, number>();
  for (const entry of entries) {
    for (const slot of entry.slots) {
      totalSlotCounts.set(slot.len, (totalSlotCounts.get(slot.len) ?? 0) + 1);
    }
  }
  const totalSlotLengths = [...totalSlotCounts.keys()].sort((a, b) => a - b);
  const parallelLabel = parallelRestarts > 1 ? `${parallelRestarts} (early-stop)` : "1";
  const nativeAvailable = nativeDlx && isNativeDlxAvailable();
  const engineLabel = nativeAvailable ? "dlx(native)" : nativeDlx ? "dlx(js,fallback)" : "dlx(js)";
  const prefixNeed = "📚 нужно (все) → ";
  const prefixDict = "📖 словарь → ";
  const prefixPad = " ".repeat(Math.max(0, prefixNeed.length - prefixDict.length));
  console.log(`\n📄 файлов: ${entries.length}`);
  console.log(
    formatLenCountsAligned(totalSlotLengths, totalSlotCounts, dictCounts, prefixNeed)
  );
  console.log(
    formatLenCountsAligned(totalSlotLengths, dictCounts, totalSlotCounts, `${prefixDict}${prefixPad}`)
  );
  const useNativeStdout = doProgress && nativeAvailable && parallelRestarts > 1;
  const progressLabel = doProgress
    ? `on (logMs=${logEveryMs}${useNativeStdout ? " stdout" : ""})`
    : "off";
  console.log(
    `⚙ engine=${engineLabel} restarts=${restarts} parallel=${parallelLabel} progress=${progressLabel} lcv=${doLcv ? "on" : "off"} shuffle=${shuffleOpt ? "on" : "off"} unique=${unique ? "on" : "off"}`
  );
  if (unique) {
    const deficits = totalSlotLengths
      .map((len) => {
        const need = totalSlotCounts.get(len) ?? 0;
        const have = dictCounts.get(len) ?? 0;
        return need > have ? { len, need, have } : null;
      })
      .filter(Boolean) as Array<{ len: number; need: number; have: number }>;
    if (deficits.length) {
      console.error("🛑 недостаточно слов в словаре для уникального режима:");
      for (const d of deficits) {
        console.error(`   длина ${d.len}: нужно ${d.need}, в словаре ${d.have}`);
      }
    }
  }

  /* если уникальный режим — будем прямо мутировать глобальный экземпляр */
  const globalDict = unique
    ? new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]))
    : masterDict;

  for (const entry of entries) {
    const { path, name, grid, slots } = entry;
    console.log(`\n● ${name} …`);
    const startedAt = Date.now();

    try {
      /* 2. словарь для решения */
      const dict = unique
        ? globalDict
        : new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]));

      /* 3. solve */
      const onProgress = doProgress
        ? (info: SolveProgress) => {
          if (info.elapsedMs < progressMinMs) return;
          const sec = (info.elapsedMs / 1000).toFixed(1);
          const pick = info.lastPick
            ? `slot=${info.lastPick.id} len=${info.lastPick.len} cand=${info.lastPick.candidates} deg=${info.lastPick.degree} patt=${info.lastPick.pattern}`
            : "slot=—";
          const stats = `rej=I:${info.stats.rejectIntersect} F:${info.stats.rejectForward} Z:${info.stats.zeroPick} bt=${info.stats.backtracks}`;
          console.log(
            `[progress][${info.label ?? "solve"}#${info.attempt}/${info.restarts}] ${sec}s nps=${info.nodesPerSec} nodes=${info.nodes} unfilled=${info.unfilled} depth=${info.depth} ${pick} ${stats}`
          );
        }
        : undefined;

      const solveStartedAt = Date.now();
      const baseOptions = { shuffle: shuffleOpt, lcv: doLcv, restarts, parallelRestarts, maxMs, maxNodes, label: name, debugDlx, nativeDlx };
      const solveOptions = doProgress
        ? { ...baseOptions, logEveryMs, onProgress }
        : baseOptions;
      const nativeOptions = doProgress && parallelRestarts > 1
        ? { ...baseOptions, logEveryMs, progressStdout: true }
        : solveOptions;
      let solved: string[] | null = null;
      if (nativeDlx && doProgress && parallelRestarts > 1) {
        const nativeSolved = await solveDlxNativeAsync(grid.data, slots, dict, nativeOptions);
        if (nativeSolved !== undefined) {
          solved = nativeSolved;
        } else {
          solved = solve(grid.data, slots, dict, { ...solveOptions, nativeDlx: false });
        }
      } else {
        solved = solve(grid.data, slots, dict, solveOptions);
      }
      const solveMs = Date.now() - solveStartedAt;
      solveTotalMs += solveMs;
      if (!solved) {
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        const solveSec = (solveMs / 1000).toFixed(2);
        console.warn(`  ⚠ недостаточно слов (time=${elapsedSec}s solve=${solveSec}s)`);
        failedCount += 1;
        continue;
      }

      /* 4. если уникальный режим — вычёркиваем использованные слова */
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

      /* 5. SVG */
      const { rows: ROWS, cols: COLS } = grid;
      const usedWordsList = slots.map((s) =>
        s.cells.map(([r, c]) => solved[r][c]).join("")
      );
      const usedWords = usedWordsList.join("\n");
      const definitions = await loadDefinitions(usedWordsList, { langCode: "ru" });
      const clues = buildClueEntries(grid, slots, solved, definitions);
      const clueTextMap = buildClueTextMap([...clues.down, ...clues.right]);

      const gridWidth = COLS * CELL;
      const gridHeight = ROWS * CELL;
      const svgWidth = useCorelStyle ? SVG_WIDTH : gridWidth + SVG_PAD * 2;
      const svgHeight = useCorelStyle ? SVG_HEIGHT : gridHeight + SVG_PAD * 2;
      const svgViewBox = useCorelStyle
        ? ` viewBox="${GRID_OFFSET_X - SVG_PAD} ${GRID_OFFSET_Y - SVG_PAD} ${Math.max(SVG_WIDTH, gridWidth + SVG_PAD * 2)} ${Math.max(SVG_HEIGHT, gridHeight + SVG_PAD * 2)}"`
        : "";
      const svgParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidth}" height="${svgHeight}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
      ];
      const svgRawParts: string[] = [
        `${SVG_PREAMBLE}<svg xmlns="http://www.w3.org/2000/svg"${SVG_XML_SPACE} width="${svgWidth}" height="${svgHeight}"${svgViewBox}${SVG_STYLE_ATTR} font-family="${FONT_FAMILY}" text-anchor="middle" dominant-baseline="central">`,
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
                CLUE_TEXT_FILL,
                { mode: useCorelStyle ? "corel" : "default" }
              );
              if (clueSvg.defs) {
                clueDefs.push(clueSvg.defs);
              }
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

      /* 6. write */
      const dstDir = join(OUT_DIR, name);
      mkdirSync(dstDir, { recursive: true });
      writeFileSync(join(dstDir, "crossword.svg"), svg);
      writeFileSync(join(dstDir, "crossword-no-text.svg"), svgRaw);
      writeFileSync(join(dstDir, "used-words.txt"), usedWords);
      if (writeDefsJson) {
        writeFileSync(join(dstDir, "definitions-down.json"), JSON.stringify(clues.down, null, 2));
        writeFileSync(join(dstDir, "definitions-right.json"), JSON.stringify(clues.right, null, 2));
      }

      if (doCrw) {
        const crw = buildCrw(grid, slots, solved, {
          dictPath,
          templatePath: templatePath || path,
          lowerCaseWords: true,
        });
        const crwOut = join(dstDir, `${name}.crw`);
        writeFileSync(crwOut, crw);
      }

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const solveSec = (solveMs / 1000).toFixed(2);
      console.log(`  ✔ готово → ${dstDir} (time=${elapsedSec}s solve=${solveSec}s)`);
      solvedCount += 1;
    } catch (e) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.error("  🛑", (e as Error).message);
      console.error(`  time=${elapsedSec}s`);
      failedCount += 1;
    }
  }

  const totalSec = ((Date.now() - batchStartedAt) / 1000).toFixed(1);
  const solveSec = (solveTotalMs / 1000).toFixed(1);
  console.log(
    `Итог: успешно заполнены ${solvedCount}, не удалось ${failedCount} (всего ${entries.length})`
  );
  console.log(`\nВсе файлы обработаны. time=${totalSec}s solve=${solveSec}s`);
})();
