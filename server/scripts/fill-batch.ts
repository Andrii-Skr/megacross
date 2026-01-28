
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
import { solve, type SolveFailInfo, type SolveProgress } from "../src/utils/solver";
import { consumeLastNativeFail, isNativeDlxAvailable, solveDlxNativeAsync } from "../src/utils/nativeDlx";
import { loadDictionary, loadDefinitions } from "../src/services/dictionary";
import { buildCrw }            from "../src/utils/writeCrw";
import { buildClueEntries }    from "../src/utils/clues";
import { Cell, Grid, Slot }    from "../src/types";
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

function formatLenCountsSimple(
  lengths: number[],
  counts: Map<number, number>
): string {
  if (!lengths.length) return "";
  const lenWidth = Math.max(1, ...lengths.map((len) => String(len).length));
  const countWidth = Math.max(1, ...lengths.map((len) => String(counts.get(len) ?? 0).length));
  return lengths
    .map((len) => {
      const count = counts.get(len) ?? 0;
      const lenStr = String(len).padStart(lenWidth, " ");
      const countStr = String(count).padStart(countWidth, " ");
      return `${lenStr}:${countStr}`;
    })
    .join("  ");
}

type TemplateStats = {
  slots: number;
  letters: number;
  uniqueCells: number;
  intersections: number;
  density: number;
  maxDegree: number;
  avgDegree: number;
  degreeSqSum: number;
  pressure?: number;
};

function buildLenCounts(slots: Slot[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const slot of slots) {
    counts.set(slot.len, (counts.get(slot.len) ?? 0) + 1);
  }
  return counts;
}

function analyzeTemplate(slots: Slot[]): TemplateStats {
  const cellUse = new Map<string, number>();
  const cellSlots = new Map<string, number[]>();
  const adjacency = new Map<number, Set<number>>();
  for (const slot of slots) {
    adjacency.set(slot.id, new Set());
  }
  let letters = 0;
  for (const slot of slots) {
    letters += slot.len;
    for (const [r, c] of slot.cells) {
      const key = `${r},${c}`;
      cellUse.set(key, (cellUse.get(key) ?? 0) + 1);
      const list = cellSlots.get(key);
      if (list) {
        list.push(slot.id);
      } else {
        cellSlots.set(key, [slot.id]);
      }
    }
  }
  let intersections = 0;
  for (const list of cellSlots.values()) {
    if (list.length > 1) {
      intersections += 1;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          adjacency.get(list[i])?.add(list[j]);
          adjacency.get(list[j])?.add(list[i]);
        }
      }
    }
  }
  const uniqueCells = cellUse.size;
  const density = uniqueCells ? intersections / uniqueCells : 0;
  const degrees = slots.map((slot) => adjacency.get(slot.id)?.size ?? 0);
  const maxDegree = degrees.length ? Math.max(...degrees) : 0;
  const avgDegree = degrees.length
    ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length
    : 0;
  const degreeSqSum = degrees.reduce((sum, d) => sum + d * d, 0);
  return {
    slots: slots.length,
    letters,
    uniqueCells,
    intersections,
    density,
    maxDegree,
    avgDegree,
    degreeSqSum,
  };
}

function computePressure(
  lenCounts: Map<number, number>,
  dictCounts: Map<number, number>
): number {
  let pressure = 0;
  for (const [len, need] of lenCounts) {
    const have = dictCounts.get(len) ?? 0;
    if (have <= 0) return Number.POSITIVE_INFINITY;
    pressure += need / have;
  }
  return pressure;
}

function formatComplexity(stats: TemplateStats): string {
  const pressure = stats.pressure ?? 0;
  const pressureStr = Number.isFinite(pressure) ? pressure.toFixed(4) : "inf";
  const densityStr = stats.density.toFixed(2);
  const avgDegStr = stats.avgDegree.toFixed(2);
  return `degMax=${stats.maxDegree} degAvg=${avgDegStr} degSq=${stats.degreeSqSum} press=${pressureStr} slots=${stats.slots} cells=${stats.uniqueCells} cross=${stats.intersections} dens=${densityStr}`;
}

function compareByComplexity(a: TemplateStats, b: TemplateStats): number {
  if (a.maxDegree !== b.maxDegree) return b.maxDegree - a.maxDegree;
  if (a.avgDegree !== b.avgDegree) return b.avgDegree - a.avgDegree;
  if (a.degreeSqSum !== b.degreeSqSum) return b.degreeSqSum - a.degreeSqSum;
  const ap = a.pressure ?? 0;
  const bp = b.pressure ?? 0;
  if (ap !== bp) {
    if (!Number.isFinite(ap)) return -1;
    if (!Number.isFinite(bp)) return 1;
    return bp - ap;
  }
  if (b.slots !== a.slots) return b.slots - a.slots;
  if (b.intersections !== a.intersections) return b.intersections - a.intersections;
  if (b.letters !== a.letters) return b.letters - a.letters;
  return 0;
}

type FailSlot = NonNullable<NonNullable<SolveFailInfo["detail"]>["slot"]>;
type FailColumn = NonNullable<NonNullable<SolveFailInfo["detail"]>["column"]>;

function formatDir(dir: "down" | "right"): string {
  return dir === "down" ? "↓" : "→";
}

function formatSlotRef(slot?: FailSlot): string {
  if (!slot) return "slot=—";
  return `slot#${slot.id} (r=${slot.r} c=${slot.c} ${formatDir(slot.dir)} len=${slot.len})`;
}

function formatFail(info: SolveFailInfo): string {
  switch (info.reason) {
    case "aborted": {
      const limit = info.detail?.limit ?? "limit";
      return `aborted (${limit})`;
    }
    case "forward-check": {
      const patt = info.detail?.pattern ?? "";
      return `forward-check: ${formatSlotRef(info.detail?.slot)} patt=${patt}`;
    }
    case "zero-pick": {
      const col: FailColumn | undefined = info.detail?.column;
      if (col) {
        if (col.type === "slot") {
          return `zero-pick: ${formatSlotRef(col.slot)} candidates=0`;
        }
        if (col.type === "cell") {
          const cell = col.cell;
          if (cell) return `zero-pick: cell r=${cell.r} c=${cell.c} candidates=0`;
          return "zero-pick: cell candidates=0";
        }
        if (col.type === "word") {
          return `zero-pick: word "${col.word ?? ""}" candidates=0`;
        }
        return `zero-pick: column "${col.name}" candidates=0`;
      }
      const patt = info.detail?.pattern ?? "";
      return `zero-pick: ${formatSlotRef(info.detail?.slot)} patt=${patt}`;
    }
    default:
      return "no-solution";
  }
}

async function waitForNativeFail(timeoutMs = 200): Promise<SolveFailInfo | null> {
  const started = Date.now();
  let info = consumeLastNativeFail();
  while (!info && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    info = consumeLastNativeFail();
  }
  return info;
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
    hardFirst: { type: "boolean" },
    "hard-first": { type: "boolean" },
    keepOrder: { type: "boolean" },
    "keep-order": { type: "boolean" },
    explainFail: { type: "boolean" },
    "explain-fail": { type: "boolean" },
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
const hardFirst = !!values.hardFirst || !!values["hard-first"];
const keepOrder = !!values.keepOrder || !!values["keep-order"];
const explainFail = !!values.explainFail || !!values["explain-fail"];
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
    slots: Slot[];
    lenCounts: Map<number, number>;
    stats: TemplateStats;
  }[] = [];
  const lengthsSet = new Set<number>();

  for (const path of files) {
    const name = basename(path, ".fsh");
    try {
      const grid: Grid = parseFsh(path);
      validate(grid);
      const slots = scanSlots(grid);
      const lenCounts = buildLenCounts(slots);
      const stats = analyzeTemplate(slots);
      entries.push({ path, name, grid, slots, lenCounts, stats });
      for (const len of lenCounts.keys()) lengthsSet.add(len);
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
  for (const entry of entries) {
    entry.stats.pressure = computePressure(entry.lenCounts, dictCounts);
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
  const useProgressStdout = doProgress && nativeAvailable && parallelRestarts > 1;
  const progressLabel = doProgress
    ? `on (logMs=${logEveryMs}${useProgressStdout ? " stdout" : ""})`
    : "off";
  console.log(
    `⚙ engine=${engineLabel} restarts=${restarts} parallel=${parallelLabel} progress=${progressLabel} lcv=${doLcv ? "on" : "off"} shuffle=${shuffleOpt ? "on" : "off"} unique=${unique ? "on" : "off"} explainFail=${explainFail ? "on" : "off"}`
  );
  const orderMode = hardFirst || (unique && !keepOrder) ? "complex" : "file";
  console.log(`🧭 order=${orderMode === "complex" ? "complexity" : "file"}`);
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

  const orderedEntries =
    orderMode === "complex"
      ? [...entries].sort((a, b) => {
          const cmp = compareByComplexity(a.stats, b.stats);
          if (cmp !== 0) return cmp;
          return a.name.localeCompare(b.name);
        })
      : entries;
  if (orderMode === "complex") {
    console.log("\nСложность шаблонов (hard→easy):");
    for (const entry of orderedEntries) {
      console.log(`  ${entry.name}: ${formatComplexity(entry.stats)}`);
    }
  }

  /* если уникальный режим — будем прямо мутировать глобальный экземпляр */
  const globalDict = unique
    ? new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]))
    : masterDict;

  for (const entry of orderedEntries) {
    const { path, name, grid, slots } = entry;
    console.log(`\n● ${name} …`);
    const perTemplateCounts = entry.lenCounts;
    const perTemplateLengths = [...perTemplateCounts.keys()].sort((a, b) => a - b);
    console.log(`  нужно → ${formatLenCountsSimple(perTemplateLengths, perTemplateCounts)}`);
    console.log(`  сложность → ${formatComplexity(entry.stats)}`);
    const startedAt = Date.now();
    let failInfo: SolveFailInfo | null = null;
    let nativeActive = false;
    const useFailStdout = explainFail && nativeAvailable && parallelRestarts > 1;

    try {
      /* 2. словарь для решения */
      const dict = unique
        ? globalDict
        : new Map<number, string[]>([...masterDict].map(([l, a]) => [l, [...a]]));

      /* 3. solve */
      const logProgress = doProgress;
      const onProgress = logProgress
        ? (info: SolveProgress) => {
          if (nativeActive && useProgressStdout) return;
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
      const onFail = explainFail
        ? (info: SolveFailInfo) => {
            failInfo = info;
            if (!(nativeActive && useFailStdout)) {
              console.warn(`  fail → ${formatFail(info)}`);
            }
          }
        : undefined;
      const baseOptions = {
        shuffle: shuffleOpt,
        lcv: doLcv,
        restarts,
        parallelRestarts,
        maxMs,
        maxNodes,
        label: name,
        debugDlx,
        nativeDlx,
        onFail,
      };
      const solveOptions = logProgress
        ? { ...baseOptions, logEveryMs, onProgress }
        : baseOptions;
      const nativeOptions = (doProgress || explainFail) && parallelRestarts > 1
        ? {
          ...solveOptions,
          logEveryMs: logProgress ? logEveryMs : 0,
          progressStdout: useProgressStdout,
          failStdout: useFailStdout,
        }
        : solveOptions;
      let solved: string[] | null = null;
      if (nativeDlx && (doProgress || explainFail) && parallelRestarts > 1) {
        nativeActive = true;
        const nativeSolved = await solveDlxNativeAsync(grid.data, slots, dict, nativeOptions);
        if (nativeSolved !== undefined) {
          solved = nativeSolved;
        } else {
          nativeActive = false;
          solved = solve(grid.data, slots, dict, { ...solveOptions, nativeDlx: false });
        }
        nativeActive = false;
      } else {
        solved = solve(grid.data, slots, dict, solveOptions);
      }
      const solveMs = Date.now() - solveStartedAt;
      solveTotalMs += solveMs;
      if (!solved) {
        if (explainFail && !failInfo && nativeDlx) {
          failInfo = await waitForNativeFail();
        }
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        const solveSec = (solveMs / 1000).toFixed(2);
        console.warn(`  ⚠ недостаточно слов (time=${elapsedSec}s solve=${solveSec}s)`);
        if (explainFail && failInfo) {
          console.warn(`  причина → ${formatFail(failInfo)}`);
        }
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

  const totalMin = ((Date.now() - batchStartedAt) / 60000).toFixed(1);
  const solveMin = (solveTotalMs / 60000).toFixed(1);
  console.log(
    `Итог: успешно заполнены ${solvedCount}, не удалось ${failedCount} (всего ${entries.length})`
  );
  console.log(`\nВсе файлы обработаны. time=${totalMin}m solve=${solveMin}m`);
})();
