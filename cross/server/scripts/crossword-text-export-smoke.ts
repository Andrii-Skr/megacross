import assert from "node:assert/strict";
import type { Grid } from "../src/types";
import { scanSlots } from "../src/utils/grid";
import { buildCrosswordTextFiles } from "../src/utils/crosswordTextExport";
import { buildCrosswordSvg } from "./crossword-svg";

const solved = ["ABC", "DEF", "GHI"];
const definitions = new Map([
  ["ABC", "Первая строка."],
  ["DEF", "Вторая\nстрока."],
  ["ADG", "Первый столбец."],
  ["BEH", "Второй столбец."],
  ["CFI", "Третий столбец."],
]);

function grid(type: "0" | "<" | "2"): Grid {
  return {
    rows: 3,
    cols: 3,
    marker: `${type}33`,
    templateTypeCode: type,
    templateType: type === "0" ? "crossword" : type === "<" ? "crossword_variant" : "scanword",
    data: ["***", "***", "***"],
    codes: Array.from({ length: 3 }, () => [1, 1, 1]),
  };
}

for (const type of ["0", "<"] as const) {
  const template = grid(type);
  const slots = scanSlots(template);
  const files = buildCrosswordTextFiles(template, slots, solved, definitions);
  assert.ok(files);
  assert.equal(files.words, "По горизонтали:\n1. ABC\n4. DEF\n5. GHI\n\nПо вертикали:\n1. ADG\n2. BEH\n3. CFI\n");
  assert.equal(files.clues, "По горизонтали:\n1. Первая строка.\n4. Вторая строка.\n5. \n\nПо вертикали:\n1. Первый столбец.\n2. Второй столбец.\n3. Третий столбец.\n");

  const rendered = buildCrosswordSvg(template, slots, solved, definitions, {
    style: "default",
    arrowMode: "batch",
    arrowScale: 0.6,
    templateCellSizeMm: 8,
    type0CellSizeMm: 8,
    type0Features: false,
  });
  for (const number of [1, 2, 3, 4, 5]) {
    assert.ok(rendered.svg.includes(`>${number}</text>`), `missing grid number ${number} for type ${type}`);
  }
}

const scanword = grid("2");
const scanwordSlots = scanSlots(scanword);
assert.equal(buildCrosswordTextFiles(scanword, scanwordSlots, solved, definitions), null);
const scanwordSvg = buildCrosswordSvg(scanword, scanwordSlots, solved, definitions, {
  style: "default",
  arrowMode: "batch",
  arrowScale: 0.6,
  templateCellSizeMm: 8,
  type0CellSizeMm: 8,
});
assert.ok(!scanwordSvg.svg.includes(">1</text>"));
assert.equal(scanwordSvg.usedWords, "ABC\nADG\nBEH\nCFI\nDEF\nGHI");

console.log("Crossword text export smoke passed");
