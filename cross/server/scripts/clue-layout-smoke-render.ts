import assert from "node:assert/strict";
import {
  CLUE_FONT_BASE_PT,
  CLUE_FONT_MIN_PT,
  CLUE_GLYPH_WIDTH_SCALE,
  CLUE_LINE_HEIGHT_SCALE,
  CLUE_TEXT_ASCENT_RATIO,
  CLUE_TEXT_DESCENT_RATIO,
  CLUE_TEXT_WIDTH_SAFETY_FACTOR,
  convertCluePtToSvgUnits,
  renderClueText,
  resolveClueRenderLayout,
} from "./clue-svg";
import { estimateTextWidth } from "./text-position";
import { COREL_CELL_SIZE_UNITS, COREL_UNITS_PER_MM } from "./svg-theme";

function firstNonZeroDy(text: string): number | null {
  const matches = [...text.matchAll(/<tspan[^>]*dy="([0-9.]+)"/g)];
  for (const match of matches) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function extractFontSizes(text: string): number[] {
  return [...text.matchAll(/font-size="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
}

function uniqueRounded(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 1000) / 1000))];
}

function extractTextValues(text: string): string[] {
  return [...text.matchAll(/>([^<>]+)</g)]
    .map((match) => match[1] ?? "")
    .filter((value) => value.trim().length > 0);
}

function extractTextXValues(text: string): number[] {
  return [...text.matchAll(/<text[^>]* x="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
}

function extractTextYValues(text: string): number[] {
  return [...text.matchAll(/<text[^>]* y="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
}

function extractHorizontalScale(text: string): number | null {
  const match = text.match(/scale\(([0-9.]+) 1\)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function testRenderBottomLeftTextBlockForMultiCellArea(): void {
  const rendered = renderClueText(10, 20, 30, 8, "длинное определение", "clip-1", "#000", {
    mode: "default",
    areaCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    anchorCell: [0, 0],
    textAlign: "bottom-left",
    background: "text-block",
  });
  const rectCount = (rendered.defs.match(/<rect /g) ?? []).length;
  assert.ok(rectCount >= 4);
  assert.match(rendered.text, /text-anchor="start"/);
  assert.match(rendered.text, /fill="#fff"/);
}

function testRenderClueTextUsesUniformScaleAndLineHeight(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "default");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
  const rendered = renderClueText(10, 20, 30, fontSize, "один два три", "clip-scale-default", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
  });
  const dy = firstNonZeroDy(rendered.text);
  const sizes = extractFontSizes(rendered.text);
  assert.ok(dy !== null);
  assert.equal(uniqueRounded(sizes).length, 1);
  assert.equal(Math.round(dy * 1000) / 1000, Math.round(sizes[0] * CLUE_LINE_HEIGHT_SCALE * 1000) / 1000);
  assert.match(rendered.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
  assert.doesNotMatch(rendered.text, /textLength="/);
  assert.doesNotMatch(rendered.text, /lengthAdjust=/);
}

function testRenderClueTextUsesClientScaleOverrides(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "default");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
  const renderedDefault = renderClueText(10, 20, 30, fontSize, "один два три", "clip-scale-default-2", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
  });
  const renderedOverridden = renderClueText(10, 20, 30, fontSize, "один два три", "clip-scale-original", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
    glyphWidthScale: 1,
    lineHeightScale: 1,
  });

  const dyDefault = firstNonZeroDy(renderedDefault.text);
  const dyOverridden = firstNonZeroDy(renderedOverridden.text);
  const overriddenSizes = extractFontSizes(renderedOverridden.text);
  assert.ok(dyDefault !== null);
  assert.ok(dyOverridden !== null);
  assert.notEqual(dyOverridden, dyDefault);
  assert.equal(Math.round(dyOverridden * 1000) / 1000, Math.round(overriddenSizes[0] * 1000) / 1000);
  assert.match(renderedDefault.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
  assert.match(renderedOverridden.text, /scale\(1 1\)/);
}

function testRenderClueTextUsesSingleFontSizeForCorelLines(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "corel");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "corel");
  const rendered = renderClueText(0, 0, 30, fontSize, "один два три четыре", "clip-corel-uniform", "#000", {
    mode: "corel",
    areaCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    anchorCell: [0, 0],
    minFontSize,
  });
  const sizes = extractFontSizes(rendered.text);
  assert.ok(sizes.length > 1);
  assert.equal(uniqueRounded(sizes).length, 1);
  assert.match(rendered.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
  assert.doesNotMatch(rendered.text, /textLength="/);
}

function testRenderCorelTextKeepsBalancedVerticalPadding(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "corel");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "corel");
  const rendered = renderClueText(0, 0, COREL_CELL_SIZE_UNITS, fontSize, "портной специалист по пошиву", "clip-corel-balance", "#000", {
    mode: "corel",
    areaCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    anchorCell: [0, 0],
    minFontSize,
  });
  const yValues = extractTextYValues(rendered.text);
  const sizes = extractFontSizes(rendered.text);
  assert.ok(yValues.length > 1);
  const usedFontSize = sizes[0] ?? fontSize;
  const edgeInset = 0.1 * COREL_UNITS_PER_MM;
  const safeTop = 1 + edgeInset;
  const safeBottom = COREL_CELL_SIZE_UNITS * 2 - safeTop;
  const firstTop = yValues[0] - usedFontSize * CLUE_TEXT_ASCENT_RATIO;
  const lastBottom = yValues[yValues.length - 1] + usedFontSize * CLUE_TEXT_DESCENT_RATIO;
  const topMargin = Math.round((firstTop - safeTop) * 1000) / 1000;
  const bottomMargin = Math.round((safeBottom - lastBottom) * 1000) / 1000;
  assert.ok(topMargin >= -0.25);
  assert.ok(bottomMargin >= -0.25);
  assert.ok(Math.abs(topMargin - bottomMargin) <= usedFontSize * 0.2);
}

function testRenderClueTextStartsAt9PtAndShrinksNoLowerThan8Pt(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "default");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
  const shortRendered = renderClueText(10, 20, 30, fontSize, "кот", "clip-short", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
  });
  const longRendered = renderClueText(
    10,
    20,
    30,
    fontSize,
    "один два три четыре пять шесть семь восемь",
    "clip-long",
    "#000",
    {
      mode: "default",
      textAlign: "center",
      minFontSize,
    }
  );

  const shortSizes = extractFontSizes(shortRendered.text);
  const longSizes = extractFontSizes(longRendered.text);
  assert.equal(uniqueRounded(shortSizes)[0], Math.round(fontSize * 1000) / 1000);
  assert.ok(longSizes[0] < fontSize);
  assert.ok(longSizes[0] > 0);
}

function testRenderClueTextInvalidScaleFallsBackToFixed80(): void {
  const fontSize = convertCluePtToSvgUnits(CLUE_FONT_BASE_PT, "default");
  const minFontSize = convertCluePtToSvgUnits(CLUE_FONT_MIN_PT, "default");
  const renderedDefault = renderClueText(10, 20, 30, fontSize, "один два три", "clip-scale-default-3", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
  });
  const renderedInvalid = renderClueText(10, 20, 30, fontSize, "один два три", "clip-scale-invalid", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize,
    glyphWidthScale: Number.NaN,
    lineHeightScale: 0,
  });

  const dyDefault = firstNonZeroDy(renderedDefault.text);
  const dyInvalid = firstNonZeroDy(renderedInvalid.text);
  assert.ok(dyDefault !== null);
  assert.ok(dyInvalid !== null);
  assert.equal(dyInvalid, dyDefault);
  assert.match(renderedInvalid.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
}

function testRenderClueTextRespectsSafeInsetForWideCorelWord(): void {
  const requestedFontSize = convertCluePtToSvgUnits(14, "corel");
  const minFontSize = convertCluePtToSvgUnits(8, "corel");
  const rendered = renderClueText(0, 0, COREL_CELL_SIZE_UNITS, requestedFontSize, "Железный", "clip-corel-wide-word", "#000", {
    mode: "corel",
    minFontSize,
  });
  const xValues = extractTextXValues(rendered.text);
  const sizes = extractFontSizes(rendered.text);
  const values = extractTextValues(rendered.text);
  assert.equal(xValues.length, values.length);
  const usedFontSize = sizes[0] ?? requestedFontSize;
  const edgeInset = 0.1 * COREL_UNITS_PER_MM;
  const safeLeft = 1 + edgeInset;
  const safeRight = COREL_CELL_SIZE_UNITS - safeLeft;
  for (let idx = 0; idx < values.length; idx += 1) {
    const lineWidth = estimateTextWidth(values[idx] ?? "", usedFontSize) * CLUE_GLYPH_WIDTH_SCALE;
    const lineLeft = xValues[idx] - lineWidth / 2;
    const lineRight = xValues[idx] + lineWidth / 2;
    assert.ok(lineLeft >= safeLeft - 0.001);
    assert.ok(lineRight <= safeRight + 0.001);
  }
  assert.ok(usedFontSize < requestedFontSize);
}

function testRenderClueTextRespectsSafeInsetForWideDefaultWord(): void {
  const requestedFontSize = 20;
  const rendered = renderClueText(0, 0, 30, requestedFontSize, "Железный", "clip-default-wide-word", "#000", {
    mode: "default",
    minFontSize: 8,
  });
  const xValues = [...rendered.text.matchAll(/<tspan x="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const sizes = extractFontSizes(rendered.text);
  const values = extractTextValues(rendered.text);
  const usedFontSize = sizes[0] ?? requestedFontSize;
  const edgeInset = (96 / 25.4) * 0.1;
  const safeLeft = 1 + edgeInset;
  const safeRight = 30 - safeLeft;
  assert.equal(xValues.length, values.length);
  for (let idx = 0; idx < values.length; idx += 1) {
    const lineWidth = estimateTextWidth(values[idx] ?? "", usedFontSize) * CLUE_GLYPH_WIDTH_SCALE;
    const lineLeft = xValues[idx] - lineWidth / 2;
    const lineRight = xValues[idx] + lineWidth / 2;
    assert.ok(lineLeft >= safeLeft - 0.001);
    assert.ok(lineRight <= safeRight + 0.001);
  }
  assert.ok(usedFontSize < requestedFontSize);
}

function testRenderClusterDefinitionFrameAndPadding(): void {
  const rendered = renderClueText(0, 0, 30, 12, "кластерное определение", "clip-cluster-frame", "#000", {
    mode: "default",
    areaCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    anchorCell: [0, 0],
    textAlign: "bottom-left",
    background: "text-block",
    clusterFrame: "top-right",
    clusterPadding: 6,
    clusterBorderWidth: 2,
    minFontSize: 10,
  });
  const rectMatch = rendered.text.match(/<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)" fill="#fff"\/>/);
  assert.ok(rectMatch);
  assert.equal(Number(rectMatch[1]), 0);
  assert.ok(Number(rectMatch[3]) < 60);
  assert.equal((rendered.text.match(/<line /g) ?? []).length, 4);
  assert.match(rendered.text, /stroke-width="2"/);
  assert.match(rendered.text, /text-anchor="start"/);
}

function testRenderMultiCellAreaUsesAtMostFourLines(): void {
  const rendered = renderClueText(
    0,
    0,
    30,
    8,
    "один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать",
    "clip-2",
    "#000",
    {
      mode: "default",
      areaCells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
        [2, 1],
      ],
      anchorCell: [0, 0],
      textAlign: "bottom-left",
      background: "text-block",
    }
  );
  const lineCount = (rendered.text.match(/<tspan /g) ?? []).length;
  assert.ok(lineCount <= 4);
}

function testRenderDetachedClusterDoesNotExpandTailDefinition(): void {
  const rendered = renderClueText(0, 0, 30, 9, "хвостик", "clip-tail-cluster", "#000", {
    mode: "default",
    areaCells: [[5, 5]],
    anchorCell: [5, 5],
    textAlign: "center",
    background: "none",
  });
  assert.equal((rendered.defs.match(/<rect /g) ?? []).length, 1);
  assert.doesNotMatch(rendered.text, /fill="#fff"/);
  assert.doesNotMatch(rendered.text, /<line /);
}

function testRenderClueTextKeepsFullTailWhenLinesOverflow(): void {
  const rendered = renderClueText(0, 0, 30, 8, "легкая склонность к безделью", "clip-ellipsis", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize: 8,
  });
  const sizes = extractFontSizes(rendered.text);
  const usedFontSize = uniqueRounded(sizes)[0] ?? 0;
  assert.ok(usedFontSize > 0);
  assert.ok(usedFontSize <= 8);
  assert.ok((rendered.text.match(/<tspan /g) ?? []).length <= 4);
  assert.match(rendered.text, />склон-</);
  assert.match(rendered.text, />ность|>ность к</);
  assert.match(rendered.text, /безделью|безде-/);
  if (/безде-/.test(rendered.text)) {
    assert.match(rendered.text, />лью</);
  }
}

function testRenderClueTextContinuesLastHyphenatedSegmentInCorel(): void {
  const rendered = renderClueText(
    0,
    0,
    COREL_CELL_SIZE_UNITS,
    convertCluePtToSvgUnits(9, "corel"),
    "легкая склонность к безделью",
    "clip-corel-hyphen-tail",
    "#000",
    {
      mode: "corel",
      textAlign: "center",
      minFontSize: convertCluePtToSvgUnits(7.4, "corel"),
    }
  );
  assert.match(rendered.text, />легкая</);
  assert.match(rendered.text, />склон-</);
  assert.match(rendered.text, />ность к|>ность</);
  assert.match(rendered.text, /безде-|>безделью</);
  if (/безде-/.test(rendered.text)) {
    assert.match(rendered.text, />лью</);
  }
}

function testRenderClueTextAvoidsSingleLetterTailAfterHyphenation(): void {
  const rendered = renderClueText(0, 0, 30, 12, "«чародеи»", "clip-no-single-tail", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize: 12,
  });
  assert.doesNotMatch(rendered.text, />и</);
  assert.doesNotMatch(rendered.text, />и»</);
}

function testRenderClueTextPrefersExistingHyphenBreak(): void {
  const rendered = renderClueText(0, 0, 30, 12, "крепость-тюрьма", "clip-hyphen-break", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize: 12,
  });
  assert.match(rendered.text, />крепость-тюрьма</);
}

function testRenderClueTextNormalizesNonAsciiHyphenBeforeWrap(): void {
  const rendered = renderClueText(0, 0, 30, 12, "врач‑стажер", "clip-hyphen-normalized", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize: 12,
  });
  assert.match(rendered.text, />врач-</);
  assert.match(rendered.text, />ста-|>стажер</);
}

function testRenderClueTextSplitsTooLongLeftPartBeforeHyphen(): void {
  const rendered = renderClueText(0, 0, 30, 12, "дальневосточник-гольд", "clip-long-left-hyphen", "#000", {
    mode: "default",
    textAlign: "center",
    minFontSize: 12,
  });
  assert.match(rendered.text, /даль-|нево-|сточ-|ник-/);
  assert.match(rendered.text, />гольд</);
}

function testRenderClueTextShrinksToKeepProperHyphenation(): void {
  const rendered = renderClueText(0, 0, COREL_CELL_SIZE_UNITS, convertCluePtToSvgUnits(9, "corel"), "несколько волостей", "clip-soft-sign-fallback", "#000", {
    mode: "corel",
    minFontSize: convertCluePtToSvgUnits(8, "corel"),
  });
  const sizes = extractFontSizes(rendered.text);
  const usedFontSize = sizes[0] ?? Number.NaN;
  const minFontSize = convertCluePtToSvgUnits(8, "corel");
  assert.doesNotMatch(rendered.text, />неско-</);
  assert.doesNotMatch(rendered.text, />лько</);
  assert.ok(usedFontSize >= minFontSize);
  assert.match(rendered.text, />несколько|>несколь-</);
}

function testRenderClueTextKeepsEllipsisRunAtomic(): void {
  for (const mode of ["default", "corel"] as const) {
    const standalone = renderClueText(0, 0, 30, 12, "текст...", `clip-ellipsis-standalone-${mode}`, "#000", {
      mode,
      areaCells: [
        [0, 0],
        [1, 0],
      ],
      anchorCell: [0, 0],
      minFontSize: 12,
    });
    assert.deepEqual(extractTextValues(standalone.text), ["текст", "..."]);

    const rendered = renderClueText(0, 0, 30, 12, "текст... ....", `clip-ellipsis-atomic-${mode}`, "#000", {
      mode,
      areaCells: [
        [0, 0],
        [1, 0],
      ],
      anchorCell: [0, 0],
      minFontSize: 12,
    });
    const values = extractTextValues(rendered.text);
    const ellipsisRuns = values.flatMap((value) => value.match(/\.{1,}/g) ?? []);
    assert.deepEqual(ellipsisRuns, ["...", "...."]);
    assert.doesNotMatch(rendered.text, />\.<|>\.\.</);
    assert.doesNotMatch(rendered.text, /…/);
  }
}

function testRenderClueTextKeepsNumberSignAndNumberAtomic(): void {
  for (const mode of ["default", "corel"] as const) {
    for (const source of ["текст №1", "текст № 1", "текст №1,"]) {
      const rendered = renderClueText(0, 0, 30, 12, source, `clip-number-atomic-${mode}`, "#000", {
        mode,
        areaCells: [
          [0, 0],
          [1, 0],
        ],
        anchorCell: [0, 0],
        minFontSize: 12,
      });
      const values = extractTextValues(rendered.text);
      const numberLine = values.find((value) => value.includes("№"));
      assert.ok(numberLine);
      assert.match(numberLine, /^№(?:\u00A0)?1,?$/u);
      assert.equal(values.includes("№"), false);
      assert.equal(values.includes("1"), false);
    }
  }
}

function testRenderClueTextCompressesOversizedProtectedNumber(): void {
  const rendered = renderClueText(0, 0, 30, 12, "№123456", "clip-number-protected-compression", "#000", {
    mode: "default",
    areaCells: [
      [0, 0],
      [1, 0],
    ],
    anchorCell: [0, 0],
    minFontSize: 12,
  });
  const values = extractTextValues(rendered.text);
  const horizontalScale = extractHorizontalScale(rendered.text);
  assert.deepEqual(values, ["№123456"]);
  assert.ok(horizontalScale !== null);
  assert.ok(horizontalScale < CLUE_GLYPH_WIDTH_SCALE);
}

function testRenderClueTextUsesAdaptiveLineSpacing(): void {
  const renderPair = (mode: "default" | "corel", text: string, clipId: string) =>
    renderClueText(0, 0, 30, 12, text, clipId, "#000", {
      mode,
      areaCells: [
        [0, 0],
        [1, 0],
      ],
      anchorCell: [0, 0],
      minFontSize: 12,
    });

  const riskyDefault = renderPair("default", "УУ ББ", "clip-adaptive-risky-default");
  const regularDefault = renderPair("default", "АА ББ", "clip-adaptive-regular-default");
  assert.equal(Math.round((firstNonZeroDy(riskyDefault.text) ?? 0) * 1000) / 1000, 12);
  assert.equal(
    Math.round((firstNonZeroDy(regularDefault.text) ?? 0) * 1000) / 1000,
    Math.round(12 * CLUE_LINE_HEIGHT_SCALE * 1000) / 1000
  );

  const roomyDefault = renderClueText(0, 0, 30, 12, "УУ ББ", "clip-adaptive-roomy-default", "#000", {
    mode: "default",
    areaCells: [
      [0, 0],
      [1, 0],
    ],
    anchorCell: [0, 0],
    minFontSize: 12,
    lineHeightScale: 1,
  });
  assert.equal(firstNonZeroDy(roomyDefault.text), 12);

  for (const [text, clipId] of [
    ["ддд йй", "clip-adaptive-de-yot"],
    ["ррр йй", "clip-adaptive-er-yot"],
  ]) {
    const rendered = renderPair("default", text, clipId);
    assert.equal(firstNonZeroDy(rendered.text), 12);
  }

  const riskyCorelY = extractTextYValues(renderPair("corel", "УУ ББ", "clip-adaptive-risky-corel").text);
  const regularCorelY = extractTextYValues(renderPair("corel", "АА ББ", "clip-adaptive-regular-corel").text);
  assert.equal(
    Math.round(((riskyCorelY[1] ?? 0) - (riskyCorelY[0] ?? 0)) * 1000) / 1000,
    12
  );
  assert.equal(
    Math.round(((regularCorelY[1] ?? 0) - (regularCorelY[0] ?? 0)) * 1000) / 1000,
    Math.round(12 * CLUE_LINE_HEIGHT_SCALE * 1000) / 1000
  );

  for (const [text, riskyAdvanceIndex] of [
    ["роман Драйзера", 0],
    ["левый приток Волги", 1],
  ] as const) {
    const rendered = renderClueText(0, 0, 30, 12, text, `clip-adaptive-real-${riskyAdvanceIndex}`, "#000", {
      mode: "default",
      minFontSize: 8,
      glyphWidthScale: 1,
      lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
    });
    const usedFontSize = extractFontSizes(rendered.text)[0] ?? 0;
    const advances = [...rendered.text.matchAll(/<tspan[^>]*dy="([0-9.]+)"/g)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0);
    assert.equal(Math.round((advances[riskyAdvanceIndex] ?? 0) * 1000) / 1000, usedFontSize);
  }

  const healerDefinition = renderClueText(
    0,
    0,
    30,
    12,
    "врач, ведаю- щий едой больных",
    "clip-adaptive-healer-definition",
    "#000",
    {
      mode: "default",
      areaCells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      anchorCell: [0, 0],
      minFontSize: 8,
      glyphWidthScale: 1,
      lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
    }
  );
  const healerFontSize = extractFontSizes(healerDefinition.text)[0] ?? 0;
  const healerAdvances = [...healerDefinition.text.matchAll(/<tspan[^>]*dy="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  assert.deepEqual(extractTextValues(healerDefinition.text), ["врач,", "ведаю-", "щий едой", "больных"]);
  assert.equal(healerAdvances[1], healerFontSize);

  const quotedDefinition = renderClueText(
    0,
    0,
    30,
    12,
    'модель "Мицубиси"',
    "clip-adaptive-closing-quote",
    "#000",
    {
      mode: "default",
      areaCells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      anchorCell: [0, 0],
      minFontSize: 12,
      glyphWidthScale: 1,
      lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
    }
  );
  const quotedFontSize = extractFontSizes(quotedDefinition.text)[0] ?? 0;
  const quotedLines = extractTextValues(quotedDefinition.text);
  const quotedAdvances = [...quotedDefinition.text.matchAll(/<tspan[^>]*dy="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  assert.match(quotedLines[quotedLines.length - 1] ?? "", /^си(?:&quot;|")$/u);
  assert.equal(quotedAdvances[quotedAdvances.length - 1], quotedFontSize);
}

function testRenderClueTextLimitsDefinitionsToFourLines(): void {
  for (const mode of ["default", "corel"] as const) {
    for (const text of ["др. серебряная монета арабов", "подземный народ ... белоглазая"]) {
      const rendered = renderClueText(0, 0, 30, 12, text, `clip-four-lines-${mode}-${text.length}`, "#000", {
        mode,
        areaCells: [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ],
        anchorCell: [0, 0],
        minFontSize: 12,
        glyphWidthScale: 1,
        lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
      });
      const values = extractTextValues(rendered.text);
      const usedFontSize = extractFontSizes(rendered.text)[0] ?? 12;
      assert.ok(values.length <= 4);
      assert.ok(usedFontSize < 12);
      assert.match(values.join(" "), /арабов|белоглазая|белогла-.*зая/u);
    }
  }
}

function testRenderClueTextKeepsWideMultiCellLinesAwayFromBorders(): void {
  for (const [text, expectedLines] of [
    ["король триллера ... Кинг", ["король", "триллера", "... Кинг"]],
    ["миф. сын Велеса", ["миф. сын", "Велеса"]],
  ] as const) {
    const rendered = renderClueText(0, 0, 30, 12, text, `clip-wide-safe-${text.length}`, "#000", {
      mode: "default",
      areaCells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      anchorCell: [0, 0],
      minFontSize: 8,
      glyphWidthScale: 1,
    });
    const values = extractTextValues(rendered.text);
    const usedFontSize = extractFontSizes(rendered.text)[0] ?? 12;
    const edgeInset = (96 / 25.4) * 0.1;
    const availableWidth = 60 - (1 + edgeInset) * 2;
    assert.deepEqual(values, expectedLines);
    assert.ok(usedFontSize < 12);
    for (const line of values) {
      const guardedWidth = estimateTextWidth(line, usedFontSize) * CLUE_TEXT_WIDTH_SAFETY_FACTOR;
      assert.ok(guardedWidth <= availableWidth + 0.001);
    }
  }
}

function testRenderClueTextAdaptiveSpacingStillFitsHeight(): void {
  const rendered = renderClueText(0, 0, 30, 12, "УУ ББ УУ", "clip-adaptive-height", "#000", {
    mode: "default",
    minFontSize: 8,
  });
  const sizes = extractFontSizes(rendered.text);
  const usedFontSize = sizes[0] ?? 12;
  const yMatch = rendered.text.match(/<text[^>]* y="([0-9.]+)"/);
  const textTop = Number(yMatch?.[1] ?? Number.NaN);
  const dyValues = [...rendered.text.matchAll(/<tspan[^>]*dy="([0-9.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const textBlockHeight = usedFontSize * CLUE_LINE_HEIGHT_SCALE + dyValues.reduce((sum, value) => sum + value, 0);
  const edgeInset = (96 / 25.4) * 0.1;
  const safeBottom = 30 - (1 + edgeInset);
  assert.ok(Number.isFinite(textTop));
  assert.ok(textTop + textBlockHeight <= safeBottom + 0.001);
}

function testResolveClueRenderLayoutIgnoresDetachedClusterCells(): void {
  const resolved = resolveClueRenderLayout({
    areaCells: [[0, 3]],
    clusterCells: [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
  });
  assert.deepEqual(resolved.definitionAreaCells, [[0, 3]]);
  assert.equal(resolved.isExpandedDefinition, false);
  assert.equal(resolved.isClusterDefinition, false);
}

function testResolveClueRenderLayoutKeepsExpandedAnchorAreaBottomLeft(): void {
  const resolved = resolveClueRenderLayout({
    areaCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    clusterCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  });
  assert.deepEqual(resolved.definitionAreaCells, [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]);
  assert.equal(resolved.isExpandedDefinition, true);
  assert.equal(resolved.isClusterDefinition, true);
}

function testResolveClueRenderLayoutUsesClusterFrameForSingleAnchorWithAttachedCluster(): void {
  const resolved = resolveClueRenderLayout({
    areaCells: [[0, 0]],
    clusterCells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  });
  assert.deepEqual(resolved.definitionAreaCells, [[0, 0]]);
  assert.equal(resolved.isExpandedDefinition, false);
  assert.equal(resolved.isClusterDefinition, true);
}

export function runClueRenderSmokeSuite(): void {
  testRenderBottomLeftTextBlockForMultiCellArea();
  testRenderClueTextUsesUniformScaleAndLineHeight();
  testRenderClueTextUsesClientScaleOverrides();
  testRenderClueTextUsesSingleFontSizeForCorelLines();
  testRenderCorelTextKeepsBalancedVerticalPadding();
  testRenderClueTextStartsAt9PtAndShrinksNoLowerThan8Pt();
  testRenderClueTextInvalidScaleFallsBackToFixed80();
  testRenderClueTextRespectsSafeInsetForWideCorelWord();
  testRenderClueTextRespectsSafeInsetForWideDefaultWord();
  testRenderClusterDefinitionFrameAndPadding();
  testRenderMultiCellAreaUsesAtMostFourLines();
  testRenderDetachedClusterDoesNotExpandTailDefinition();
  testRenderClueTextKeepsFullTailWhenLinesOverflow();
  testRenderClueTextContinuesLastHyphenatedSegmentInCorel();
  testRenderClueTextAvoidsSingleLetterTailAfterHyphenation();
  testRenderClueTextPrefersExistingHyphenBreak();
  testRenderClueTextNormalizesNonAsciiHyphenBeforeWrap();
  testRenderClueTextSplitsTooLongLeftPartBeforeHyphen();
  testRenderClueTextShrinksToKeepProperHyphenation();
  testRenderClueTextKeepsEllipsisRunAtomic();
  testRenderClueTextKeepsNumberSignAndNumberAtomic();
  testRenderClueTextCompressesOversizedProtectedNumber();
  testRenderClueTextUsesAdaptiveLineSpacing();
  testRenderClueTextLimitsDefinitionsToFourLines();
  testRenderClueTextKeepsWideMultiCellLinesAwayFromBorders();
  testRenderClueTextAdaptiveSpacingStillFitsHeight();
  testResolveClueRenderLayoutIgnoresDetachedClusterCells();
  testResolveClueRenderLayoutKeepsExpandedAnchorAreaBottomLeft();
  testResolveClueRenderLayoutUsesClusterFrameForSingleAnchorWithAttachedCluster();
}
