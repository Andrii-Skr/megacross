import assert from "node:assert/strict";
import type { Grid } from "../src/types";
import { buildAnswersOnlySvg } from "./answer-only-svg";
import { buildCrosswordSvg } from "./crossword-svg";
import { convertMmToCorelUnits, resolveSvgCellSizesMm } from "./svg-theme";

function buildGrid(templateTypeCode: "S" | "0"): Grid {
  return {
    rows: 1,
    cols: 1,
    data: ["*"],
    marker: `${templateTypeCode}11`,
    templateTypeCode,
    templateType: templateTypeCode === "0" ? "crossword" : "scanword",
    codes: [[0x01]],
  };
}

function assertCellWidth(svg: string, sizeMm: number): void {
  const expected = convertMmToCorelUnits(sizeMm);
  assert.match(svg, new RegExp(`<rect[^>]+width="${expected}" height="${expected}"`));
}

const templateCellSizeMm = 12.345;
const type0CellSizeMm = 7.125;
const answerCellSizeMm = 9.75;
const solved = ["А"];

assert.deepEqual(resolveSvgCellSizesMm(undefined), {
  templateCellSizeMm: 11,
  answerCellSizeMm: 10,
  type0CellSizeMm: 8.5,
});
assert.deepEqual(
  resolveSvgCellSizesMm({ templateCellSizeMm: 12.3456, answerCellSizeMm: 9.75, type0CellSizeMm: 7.125 }),
  { templateCellSizeMm: 12.346, answerCellSizeMm: 9.75, type0CellSizeMm: 7.125 },
);
assert.throws(() => resolveSvgCellSizesMm({ answerCellSizeMm: 0 }), /positive number/);
assert.throws(() => resolveSvgCellSizesMm({ type0CellSizeMm: Number.POSITIVE_INFINITY }), /positive number/);

const scanword = buildCrosswordSvg(buildGrid("S"), [], solved, new Map(), {
  style: "corel",
  arrowMode: "batch",
  arrowScale: 0.6,
  templateCellSizeMm,
  type0CellSizeMm,
});
assertCellWidth(scanword.svg, templateCellSizeMm);
assertCellWidth(scanword.svgRaw, templateCellSizeMm);

const crossword = buildCrosswordSvg(buildGrid("0"), [], solved, new Map(), {
  style: "corel",
  arrowMode: "batch",
  arrowScale: 0.6,
  templateCellSizeMm,
  type0CellSizeMm,
});
assertCellWidth(crossword.svg, type0CellSizeMm);
assertCellWidth(crossword.svgRaw, type0CellSizeMm);

const answers = buildAnswersOnlySvg(buildGrid("S"), solved, answerCellSizeMm);
assertCellWidth(answers, answerCellSizeMm);

const customAnswers = buildAnswersOnlySvg(buildGrid("S"), ["A"], 12, {
  familyName: "PinyonScript-Regular",
  fontFaceCss: "@font-face{font-family:'PinyonScript-Regular';src:url(data:font/ttf;base64,AA==)}",
});
assertCellWidth(customAnswers, 12);
assert.match(customAnswers, /font-family="PinyonScript-Regular"/);
assert.match(customAnswers, /data:font\/ttf;base64,AA==/);

console.log("cell-size-smoke: ok");
