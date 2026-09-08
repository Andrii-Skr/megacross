import assert from "node:assert/strict";
import sharp from "sharp";
import {
  CLUE_DISPLAY_DASH,
  CLUE_EDGE_INSET_MM,
  CLUE_FONT_BASE_PT,
  CLUE_FONT_MIN_PT,
  CLUE_GLYPH_WIDTH_SCALE,
  CLUE_LINE_HEIGHT_SCALE,
  convertCluePtToSvgUnits,
  renderClueText,
} from "./clue-svg";
import { COREL_CELL_SIZE_UNITS, COREL_UNITS_PER_MM } from "./svg-theme";
import { getBundledArimoFontResource } from "./svg-font-metrics";

const ARIMO = getBundledArimoFontResource();

const REGRESSION_CLUES = [
  "опера Пуччини ... Леско",
  "Гельмут ... объединил Германию",
  "гонщик ... Трулли",
  "певица ... Милоу",
  "..., Емеля, твоя неделя",
  "звезда Голливуда ... Ривз",
  "кого люблю, ... и бью",
  "Йошкар-Ола в Марий Эл",
  "2-й в Чехии после Праги",
  'винный "погребок" на дому',
  "нем. микробиолог Роберт ...",
  'Дж. Лондон "Белый клык"',
  "одежда секонд-хенд",
  "сценарист-юморист Аркадий ...",
  "чудо карельского зодчества",
  "трудноискоренимый сорный злак",
  "собачий реквием по хозяину",
  "самая южная европ. столица",
  "куст со свистульками детворе",
  "имя диснеевской русалочки",
  '... фон Триер, снял "Догвилль"',
  'ревнивец в "Цыганах" Пушкина',
  '"оружие возмездия" Гитлера',
  "дерево – символ мира и любви",
  "садовый цветок–однодневка",
  "разгульное пиршество",
  "престижная нем. легковушка",
  "страна Аравийского п-ова",
  "двуколка на людской тяге",
  "рабочий инструмент пастуха",
  "буква старославянской азбуки",
  "очаг культуры на селе",
  "кенийский город у экватора",
  "пособник буржуинов у Гайдара",
  "вид параллелограмма",
  "немецкие братья–сказочники",
] as const;

type PixelBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function extractTextValues(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/gu)].map((match) => match[1] ?? "");
}

function canonicalClueText(value: string): string {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/[«»“”„]/gu, '"')
    .replace(/[-‐‑‒–—−]/gu, "")
    .replace(/\s+/gu, "");
}

function findVisibleBounds(data: Buffer, width: number, height: number, channels: number): PixelBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + (channels - 1)] ?? 0;
      if (alpha <= 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  return right >= left && bottom >= top ? { left, top, right, bottom } : null;
}

async function assertClueRasterFits(
  text: string,
  glyphWidthScale: number,
  options: {
    basePt?: number;
    minPt?: number;
    expectedMinPt?: number;
    expectedMinGlyphWidthScale?: number;
    expectNegativeLetterSpacing?: boolean;
    expectedLines?: number;
  } = {}
): Promise<void> {
  const cell = COREL_CELL_SIZE_UNITS;
  const basePt = options.basePt ?? CLUE_FONT_BASE_PT;
  const minPt = options.minPt ?? CLUE_FONT_MIN_PT;
  const rendered = renderClueText(
    0,
    0,
    cell,
    convertCluePtToSvgUnits(basePt, "corel"),
    text,
    `raster-${text.length}-${glyphWidthScale}`,
    "#000",
    {
      mode: "corel",
      minFontSize: convertCluePtToSvgUnits(minPt, "corel"),
      glyphWidthScale,
      lineHeightScale: CLUE_LINE_HEIGHT_SCALE,
      measureTextWidth: ARIMO.measureTextWidth,
    }
  );
  const values = extractTextValues(rendered.text);
  const usedFontSize = Number(rendered.text.match(/font-size="([0-9.]+)"/u)?.[1] ?? Number.NaN);
  const usedGlyphWidthScale = Number(rendered.text.match(/scale\(([0-9.]+) 1\)/u)?.[1] ?? Number.NaN);
  const usedLetterSpacing = Number(rendered.text.match(/letter-spacing="([^"]+)"/u)?.[1] ?? 0);
  const inkscapeLetterSpacingPx =
    (usedLetterSpacing * (96 / 25.4) * Math.sqrt(usedGlyphWidthScale)) / COREL_UNITS_PER_MM;
  assert.ok(values.length > 0 && values.length <= 4, `expected one to four lines for: ${text}`);
  if (options.expectedLines != null) {
    assert.equal(values.length, options.expectedLines, `expected ${options.expectedLines} lines for: ${text}`);
  }
  assert.equal(canonicalClueText(values.join(" ")), canonicalClueText(text), `expected full clue text for: ${text}`);
  assert.doesNotMatch(values.join(""), /-/u, `expected no ASCII hyphen for: ${text}`);
  if (/[-‐‑‒–—−]/u.test(text)) {
    assert.ok(values.join("").includes(CLUE_DISPLAY_DASH), `expected en dash for: ${text}`);
  }
  if (options.expectedMinPt != null) {
    assert.ok(
      usedFontSize >= convertCluePtToSvgUnits(options.expectedMinPt, "corel"),
      `expected recommended minimum font size at ${glyphWidthScale} width scale for: ${text}`
    );
  }
  if (options.expectedMinGlyphWidthScale != null) {
    assert.ok(
      usedGlyphWidthScale >= options.expectedMinGlyphWidthScale,
      `expected readable glyph width scale for: ${text}`
    );
  }
  if (options.expectNegativeLetterSpacing) {
    assert.ok(usedLetterSpacing < 0, `expected negative letter spacing for: ${text}`);
  }
  assert.ok(
    inkscapeLetterSpacingPx >= -0.9 - 0.01,
    `expected Inkscape letter spacing not below -0.90px, got ${inkscapeLetterSpacingPx}px for: ${text}`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}" viewBox="0 0 ${cell} ${cell}" font-family="${ARIMO.familyName}"><defs><style type="text/css"><![CDATA[${ARIMO.fontFaceCss}]]></style></defs>${rendered.text}</svg>`;
  const raster = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = findVisibleBounds(
    raster.data,
    raster.info.width,
    raster.info.height,
    raster.info.channels
  );
  assert.ok(bounds, `expected visible text pixels for: ${text}`);

  const scaleX = raster.info.width / cell;
  const scaleY = raster.info.height / cell;
  const requiredInset = CLUE_EDGE_INSET_MM * COREL_UNITS_PER_MM;
  const margins = {
    left: bounds.left,
    right: raster.info.width - 1 - bounds.right,
    top: bounds.top,
    bottom: raster.info.height - 1 - bounds.bottom,
  };
  const requiredPixelsX = Math.floor(requiredInset * scaleX);
  const requiredPixelsY = Math.floor(requiredInset * scaleY);
  assert.ok(margins.left >= requiredPixelsX, `left margin ${margins.left}px for: ${text}`);
  assert.ok(margins.right >= requiredPixelsX, `right margin ${margins.right}px for: ${text}`);
  assert.ok(margins.top >= requiredPixelsY, `top margin ${margins.top}px for: ${text}`);
  assert.ok(margins.bottom >= requiredPixelsY, `bottom margin ${margins.bottom}px for: ${text}`);
}

async function main(): Promise<void> {
  for (const text of REGRESSION_CLUES) {
    for (const glyphWidthScale of [CLUE_GLYPH_WIDTH_SCALE, 1]) {
      await assertClueRasterFits(text, glyphWidthScale);
    }
  }
  for (const text of [
    "чудо карельского зодчества",
    "трудноискоренимый сорный злак",
    "собачий реквием по хозяину",
    "самая южная европ. столица",
    "куст со свистульками детворе",
    "имя диснеевской русалочки",
    '... фон Триер, снял "Догвилль"',
    'ревнивец в "Цыганах" Пушкина',
    '"оружие возмездия" Гитлера',
    "дерево – символ мира и любви",
    "садовый цветок–однодневка",
    "разгульное пиршество",
    "престижная нем. легковушка",
    "страна Аравийского п-ова",
    "двуколка на людской тяге",
    "рабочий инструмент пастуха",
    "буква старославянской азбуки",
  ]) {
    await assertClueRasterFits(text, 0.8, {
      basePt: 9,
      minPt: 7.6,
      expectedMinPt: 7.6,
      expectedMinGlyphWidthScale: 0.65,
      expectNegativeLetterSpacing: text === "буква старославянской азбуки",
    });
  }
  await assertClueRasterFits("очаг культуры на селе", 0.8, {
    basePt: 9,
    minPt: 7.6,
    expectedMinPt: 9,
    expectedMinGlyphWidthScale: 0.8,
    expectNegativeLetterSpacing: true,
    expectedLines: 3,
  });
  await assertClueRasterFits("кенийский город у экватора", 0.8, {
    basePt: 9,
    minPt: 7.6,
    expectedMinPt: 8.8,
    expectedMinGlyphWidthScale: 0.73,
    expectNegativeLetterSpacing: true,
    expectedLines: 3,
  });
  process.stdout.write("clue layout raster smoke checks passed\n");
}

await main();
