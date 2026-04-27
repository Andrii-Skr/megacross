#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { validateTemplateDefinitions, type FinalSlotState } from "../src/services/fillFinalizeService";
import { buildReviewTemplate, type ReviewTemplateEntry } from "../src/services/fillJobReviewService";
import type { Grid, Slot } from "../src/types";
import { DIRS } from "../src/types";
import { buildClueLayouts } from "../src/utils/clues";
import {
  CLUE_FONT_BASE_PT,
  CLUE_FONT_MIN_PT,
  CLUE_GLYPH_WIDTH_SCALE,
  CLUE_LINE_HEIGHT_SCALE,
  convertCluePtToSvgUnits,
  renderClueText,
} from "./clue-svg";

const AREA_EXPANSION_ENV_KEY = "CROSS_ENABLE_02_AREA_EXPANSION";

function createCodes(rows: number, cols: number, value = 0x01): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(value));
}

function buildGrid(data: string[], codes: number[][]): Grid {
  return {
    rows: data.length,
    cols: data[0]?.length ?? 0,
    data,
    marker: "000",
    codes,
  };
}

function layoutByKey(layouts: ReturnType<typeof buildClueLayouts>, key: string) {
  const found = layouts.find((item) => item.key === key);
  assert.ok(found, `layout ${key} not found`);
  return found;
}

function testExpandFor02GroupSizeAtLeast4SingleSlot(): void {
  const data = ["*##*", "*##*", "*↓**", "****"];
  const codes = createCodes(4, 4, 0x01);
  codes[1][1] = 0x02;
  codes[0][1] = 0x02;
  codes[0][2] = 0x02;
  codes[1][2] = 0x02;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 2,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["*##*", "*##*", "*A**", "*B**"];
  const definitions = new Map<string, string>([["AB", "Определение"]]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "1,1");
  assert.equal(clue.areaCells.length, 4);
}

function testNoExpandFor02GroupSizeLessThan4(): void {
  const data = ["##**", "#↓**", "****", "****"];
  const codes = createCodes(4, 4, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[1][0] = 0x02;
  codes[1][1] = 0x02;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 1,
      c: 1,
      dir: DIRS.down,
      len: 3,
      cells: [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["##AA", "#CAA", "ADAA", "AEAA"];
  const definitions = new Map<string, string>([["CDE", "Определение"]]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "0,0");
  assert.equal(clue.areaCells.length, 1);
}

function testNoExpandWhenTwoSlotsPointToSame02Group(): void {
  const data = ["##***", "#↓→**", "#****", "*****"];
  const codes = createCodes(4, 5, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[1][0] = 0x02;
  codes[2][0] = 0x02;
  codes[1][1] = 0x02;
  codes[1][2] = 0x10;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 1,
      c: 1,
      dir: DIRS.down,
      len: 3,
      cells: [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    },
    {
      id: 2,
      r: 1,
      c: 2,
      dir: DIRS.right,
      len: 3,
      cells: [
        [1, 2],
        [1, 3],
        [1, 4],
      ],
    },
  ];
  const solved = ["##AAA", "#CDEF", "#GAAA", "AHAAA"];
  const definitions = new Map<string, string>([
    ["CGH", "Первое"],
    ["DEF", "Второе"],
  ]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const first = layoutByKey(layouts, "0,0");
  const second = layoutByKey(layouts, "0,1");
  assert.equal(first.areaCells.length, 1);
  assert.equal(second.areaCells.length, 1);
}

function testNoExpandWhenGroupIsNot02(): void {
  const data = ["##**", "#↓**", "#***", "****"];
  const codes = createCodes(4, 4, 0x01);
  codes[0][0] = 0x03;
  codes[0][1] = 0x03;
  codes[1][0] = 0x03;
  codes[2][0] = 0x03;
  codes[1][1] = 0x02;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 1,
      c: 1,
      dir: DIRS.down,
      len: 3,
      cells: [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["##AA", "#CAA", "#DAA", "AEAA"];
  const definitions = new Map<string, string>([["CDE", "Определение"]]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "0,0");
  assert.equal(clue.areaCells.length, 1);
}

function testRectAreaWithAttachedTailDefinitionCanExpand(): void {
  const data = [
    "#####*",
    "#####*",
    "#####*",
    "#####*",
    "*↓#↓**",
    "*******",
  ];
  const codes = createCodes(6, 6, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  codes[4][2] = 0x02;
  codes[4][3] = 0x03;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 1],
        [5, 1],
      ],
    },
    {
      id: 2,
      r: 4,
      c: 3,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 3],
        [5, 3],
      ],
    },
  ];
  const solved = [
    "#####*",
    "#####*",
    "#####*",
    "#####*",
    "*A#B**",
    "*C*D**",
  ];
  const definitions = new Map<string, string>([
    ["AC", "Большая область"],
    ["BD", "Хвост"],
  ]);

  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const top = layoutByKey(layouts, "3,1");
  const tail = layoutByKey(layouts, "4,2");
  assert.equal(top.areaCells.length, 20);
  assert.equal(tail.areaCells.length, 1);
}

function testTwoCellSideTailDoesNotExpand(): void {
  const data = [
    "#####**",
    "######↓",
    "######*",
    "#####**",
    "*↓*****",
    "*******",
  ];
  const codes = createCodes(6, 7, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  codes[1][5] = 0x02;
  codes[2][5] = 0x02;
  codes[1][6] = 0x03;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 1],
        [5, 1],
      ],
    },
    {
      id: 2,
      r: 1,
      c: 6,
      dir: DIRS.down,
      len: 2,
      cells: [
        [1, 6],
        [2, 6],
      ],
    },
  ];
  const solved = [
    "#####**",
    "#####BD",
    "#####*E",
    "#####**",
    "*A*****",
    "*C*****",
  ];
  const definitions = new Map<string, string>([
    ["AC", "Большая область"],
    ["DE", "Хвост справа"],
  ]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const top = layoutByKey(layouts, "3,1");
  const tail = layoutByKey(layouts, "1,5");
  assert.equal(top.areaCells.length, 20);
  assert.equal(tail.areaCells.length, 1);
}

function testClusterAppliesOnlyToClusterDefinitionSlot(): void {
  const data = [
    "####**",
    "####**",
    "####**",
    "####**",
    "*↓#***",
    "**↓***",
    "******",
  ];
  const codes = createCodes(7, 6, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  codes[4][2] = 0x02;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 1],
        [5, 1],
      ],
    },
    {
      id: 2,
      r: 5,
      c: 2,
      dir: DIRS.down,
      len: 2,
      cells: [
        [5, 2],
        [6, 2],
      ],
    },
  ];
  const solved = [
    "####AA",
    "####AA",
    "####AA",
    "####AA",
    "*A#AAA",
    "*BCAAA",
    "**DAAA",
  ];
  const definitions = new Map<string, string>([
    ["AB", "Кластер"],
    ["CD", "Хвост"],
  ]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clusterDef = layoutByKey(layouts, "3,1");
  const tailDef = layoutByKey(layouts, "4,2");
  assert.equal(clusterDef.areaCells.length, 16);
  assert.equal(tailDef.areaCells.length, 1);
  assert.equal(tailDef.clusterCells, undefined);
}

function testNoExpansionForOverlappingCandidatesFromDifferentDefinitions(): void {
  const data = [
    "####",
    "####",
    "####",
    "####",
    "↓↓**",
    "****",
  ];
  const codes = createCodes(6, 4, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 0,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 0],
        [5, 0],
      ],
    },
    {
      id: 2,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 1],
        [5, 1],
      ],
    },
  ];
  const solved = [
    "####",
    "####",
    "####",
    "####",
    "AC**",
    "BD**",
  ];
  const definitions = new Map<string, string>([
    ["AB", "Первое"],
    ["CD", "Второе"],
  ]);

  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const first = layoutByKey(layouts, "3,0");
  const second = layoutByKey(layouts, "3,1");
  assert.equal(first.areaCells.length, 1);
  assert.equal(second.areaCells.length, 1);
  assert.equal(first.clusterCells, undefined);
  assert.equal(second.clusterCells, undefined);
}

function testAnchorCanExpandToLocalRectangleWhenAnotherRectangleIsBigger(): void {
  const data = [
    "#####****",
    "#####****",
    "#####****",
    "#####****",
    "*↓#******",
    "**######*",
    "**######*",
    "**######*",
    "**######*",
    "*********",
  ];
  const codes = createCodes(10, 9, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  codes[4][2] = 0x02;
  for (let row = 5; row < 9; row += 1) {
    for (let col = 2; col < 8; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 6,
      cells: [
        [4, 1],
        [5, 1],
        [6, 1],
        [7, 1],
        [8, 1],
        [9, 1],
      ],
    },
  ];
  const solved = [
    "#####AAAA",
    "#####AAAA",
    "#####AAAA",
    "#####AAAA",
    "*A#AAAAAA",
    "*B######*",
    "*C######*",
    "*D######*",
    "*E######*",
    "*F*******",
  ];
  const definitions = new Map<string, string>([["ABCDEF", "Верхний прямоугольник"]]);

  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const top = layoutByKey(layouts, "3,1");
  assert.equal(top.areaCells.length, 20);
}

function testNoClusterForMultiDefinitionComponent(): void {
  const data = [
    "#####*",
    "#####*",
    "#####*",
    "#####*",
    "*↓*↓**",
    "******",
  ];
  const codes = createCodes(6, 6, 0x01);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 4,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 1],
        [5, 1],
      ],
    },
    {
      id: 2,
      r: 4,
      c: 3,
      dir: DIRS.down,
      len: 2,
      cells: [
        [4, 3],
        [5, 3],
      ],
    },
  ];
  const solved = [
    "#####*",
    "#####*",
    "#####*",
    "#####*",
    "*A*B**",
    "*C*D**",
  ];
  const definitions = new Map<string, string>([
    ["AC", "Главный кластер"],
    ["BD", "Хвост снизу"],
  ]);

  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const top = layoutByKey(layouts, "3,1");
  assert.equal(top.areaCells.length, 1);
  assert.equal(top.clusterCells, undefined);
}

function makeState(slotId: number, definitionLength: number): FinalSlotState {
  return {
    slotId,
    len: 3,
    word: `W${slotId}W`,
    definition: "А".repeat(definitionLength),
    wordId: null,
    opredId: null,
  };
}

function testDefinitionLimitsForExpandedAndSharedGroups(): void {
  const grid = buildGrid(["#"], [[0x02]]);
  const templateSingle = {
    key: "single",
    name: "Single",
    grid,
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "down" as const,
        len: 3,
        cells: [
          [0, 0],
          [0, 0],
          [0, 0],
        ] as [number, number][],
        word: "AAA",
        wordId: null,
        opredId: null,
        definition: "",
        clueCell: { key: "0,0", row: 0, col: 0 },
      },
    ],
    clueGroups: [{ key: "0,0", row: 0, col: 0, slotIds: [1], areaCellCount: 4 }],
  };

  const passSingle = validateTemplateDefinitions(
    templateSingle as any,
    new Map<number, FinalSlotState>([[1, makeState(1, 120)]])
  );
  assert.equal(passSingle.length, 0);

  const failSingle = validateTemplateDefinitions(
    templateSingle as any,
    new Map<number, FinalSlotState>([[1, makeState(1, 121)]])
  );
  assert.equal(failSingle.length, 1);
  assert.match(failSingle[0], /exceeds 120 symbols/);

  const templateShared = {
    ...templateSingle,
    key: "shared",
    name: "Shared",
    slots: [
      { ...templateSingle.slots[0], slotId: 1 },
      { ...templateSingle.slots[0], slotId: 2, dir: "right" as const },
    ],
    clueGroups: [{ key: "0,0", row: 0, col: 0, slotIds: [1, 2], areaCellCount: 6 }],
  };

  const failShared = validateTemplateDefinitions(
    templateShared as any,
    new Map<number, FinalSlotState>([
      [1, makeState(1, 16)],
      [2, makeState(2, 10)],
    ])
  );
  assert.equal(failShared.length, 1);
  assert.match(failShared[0], /exceeds 15 symbols for shared clue cell/);

  const legacyTemplate = {
    ...templateSingle,
    key: "legacy",
    name: "Legacy",
    clueGroups: [{ key: "0,0", row: 0, col: 0, slotIds: [1] }],
  };
  const failLegacy = validateTemplateDefinitions(
    legacyTemplate as any,
    new Map<number, FinalSlotState>([[1, makeState(1, 31)]])
  );
  assert.equal(failLegacy.length, 1);
  assert.match(failLegacy[0], /exceeds 30 symbols/);
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

function testRenderClueTextIgnoresClientScaleOverridesForNow(): void {
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
  assert.ok(dyDefault !== null);
  assert.ok(dyOverridden !== null);
  assert.equal(dyOverridden, dyDefault);
  assert.match(renderedDefault.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
  assert.match(renderedOverridden.text, new RegExp(`scale\\(${CLUE_GLYPH_WIDTH_SCALE} 1\\)`));
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
  assert.ok(longSizes[0] >= minFontSize);
}

function testRenderClueTextInvalidScaleStillUsesFixed80(): void {
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
  assert.match(rendered.text, /<rect x="0" y="[^"]+" width="[^"]+" height="[^"]+" fill="#fff"\/>/);
  assert.equal((rendered.text.match(/<line /g) ?? []).length, 4);
  assert.match(rendered.text, /stroke-width="2"/);
  assert.match(rendered.text, /text-anchor="middle"/);
}

function testRenderMultiCellAreaCanUseMoreThanFourLines(): void {
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
  assert.ok(lineCount > 4);
}

function testExpandUsesVisibleDefinitionCountNotRawSlotCount(): void {
  const data = ["*##*", "*##*", "*↓**", "****"];
  const codes = createCodes(4, 4, 0x01);
  codes[1][1] = 0x02;
  codes[0][1] = 0x02;
  codes[0][2] = 0x02;
  codes[1][2] = 0x02;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [
    {
      id: 1,
      r: 2,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 1],
        [3, 1],
      ],
    },
    {
      id: 2,
      r: 2,
      c: 1,
      dir: DIRS.right,
      len: 2,
      cells: [
        [2, 1],
        [2, 2],
      ],
    },
  ];
  const solved = ["*##*", "*##*", "*AB*", "*C**"];
  const definitions = new Map<string, string>([
    ["AC", "Видимое определение"],
  ]);

  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "1,1");
  assert.equal(clue.areaCells.length, 4);
}

function testNoExpandForOneByFourStripe(): void {
  const data = ["####↓*", "******"];
  const codes = createCodes(2, 6, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[0][2] = 0x02;
  codes[0][3] = 0x02;
  codes[0][4] = 0x03;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [
    {
      id: 1,
      r: 0,
      c: 4,
      dir: DIRS.down,
      len: 2,
      cells: [
        [0, 4],
        [1, 4],
      ],
    },
  ];
  const solved = ["####AB", "****C*"];
  const definitions = new Map<string, string>([["AC", "Полоса"]]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "0,3");
  assert.equal(clue.areaCells.length, 1);
}

function testTailAnchorCanExpandToDetachedTwoBySevenRectangle(): void {
  const data = [
    "***#↓***",
    "*#######",
    "*#######",
    "********",
  ];
  const codes = createCodes(4, 8, 0x01);
  codes[0][3] = 0x02;
  for (let row = 1; row <= 2; row += 1) {
    for (let col = 1; col <= 7; col += 1) {
      codes[row][col] = 0x02;
    }
  }
  codes[0][4] = 0x03;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [
    {
      id: 1,
      r: 0,
      c: 4,
      dir: DIRS.down,
      len: 2,
      cells: [
        [0, 4],
        [1, 4],
      ],
    },
  ];
  const solved = ["***#A***", "*###B###", "*#######", "********"];
  const definitions = new Map<string, string>([["AB", "Большой нижний прямоугольник"]]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const clue = layoutByKey(layouts, "0,3");
  assert.equal(clue.areaCells.length, 1);
  assert.equal(clue.clusterCells?.length, 14);
  assert.equal(
    clue.areaCells.some(([row, col]) => row === 0 && col === 3),
    true
  );
  assert.equal(
    clue.clusterCells?.some(([row, col]) => row === 0 && col === 3),
    false
  );
  assert.equal(
    clue.clusterCells?.some(([row, col]) => row === 1 && col === 1),
    true
  );
  assert.equal(
    clue.clusterCells?.some(([row, col]) => row === 2 && col === 7),
    true
  );
}

function testClusterHighlightWithoutDefinitionTexts(): void {
  const data = ["##*", "##*", "↓↓*", "***"];
  const codes = createCodes(4, 3, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[1][0] = 0x02;
  codes[1][1] = 0x02;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 2,
      c: 0,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 0],
        [3, 0],
      ],
    },
    {
      id: 2,
      r: 2,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["##*", "##*", "AB*", "CD*"];
  const definitions = new Map<string, string>();
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const first = layoutByKey(layouts, "1,0");
  const second = layoutByKey(layouts, "1,1");
  assert.equal(first.text, "");
  assert.equal(second.text, "");
  assert.equal(first.areaCells.length, 1);
  assert.equal(second.areaCells.length, 1);
  assert.equal(first.clusterCells?.length, 4);
  assert.equal(second.clusterCells?.length, 4);
}

function testNoClusterHighlightForTwoDefinitionsInRectangle(): void {
  const data = ["##*", "##*", "↓↓*", "***"];
  const codes = createCodes(4, 3, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[1][0] = 0x02;
  codes[1][1] = 0x02;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [
    {
      id: 1,
      r: 2,
      c: 0,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 0],
        [3, 0],
      ],
    },
    {
      id: 2,
      r: 2,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["##*", "##*", "AB*", "CD*"];
  const definitions = new Map<string, string>([
    ["AC", "Первое"],
    ["BD", "Второе"],
  ]);
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  const first = layoutByKey(layouts, "1,0");
  const second = layoutByKey(layouts, "1,1");
  assert.equal(first.areaCells.length, 1);
  assert.equal(second.areaCells.length, 1);
  assert.equal(first.clusterCells, undefined);
  assert.equal(second.clusterCells, undefined);
}

function testReviewPayloadKeepsExpandedAreaCellCount(): void {
  const data = ["*##*", "*##*", "*↓**", "****"];
  const codes = createCodes(4, 4, 0x01);
  codes[1][1] = 0x02;
  codes[0][1] = 0x02;
  codes[0][2] = 0x02;
  codes[1][2] = 0x02;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [
    {
      id: 1,
      r: 2,
      c: 1,
      dir: DIRS.down,
      len: 2,
      cells: [
        [2, 1],
        [3, 1],
      ],
    },
  ];
  const solved = ["*##*", "*##*", "*A**", "*B**"];
  const word = "AB";
  const entry: ReviewTemplateEntry = {
    key: "review-area",
    path: "sample/review-area.fsh",
    name: "review-area",
    sourceName: "review-area",
    order: 0,
    grid,
    slots,
    startNumberBySlotId: new Map<number, number>([[1, 1]]),
    startPositions: [
      { number: 1, r: 2, c: 1, dir: "down", slotId: 1 },
    ],
  };
  const template = buildReviewTemplate(
    entry,
    solved,
    "ru",
    null,
    new Map(),
    new Map<string, string>([[word, "Определение"]])
  );
  const group = template.clueGroups.find((item) => item.key === "1,1");
  assert.ok(group);
  assert.equal(group.areaCellCount, 4);
}

function testDisable02AreaExpansionByEnv(): void {
  const previousValue = process.env[AREA_EXPANSION_ENV_KEY];
  delete process.env[AREA_EXPANSION_ENV_KEY];
  try {
    const data = ["*##*", "*##*", "*↓**", "****"];
    const codes = createCodes(4, 4, 0x01);
    codes[1][1] = 0x02;
    codes[0][1] = 0x02;
    codes[0][2] = 0x02;
    codes[1][2] = 0x02;
    const grid = buildGrid(data, codes);

    const slots: Slot[] = [
      {
        id: 1,
        r: 2,
        c: 1,
        dir: DIRS.down,
        len: 2,
        cells: [
          [2, 1],
          [3, 1],
        ],
      },
    ];
    const solved = ["*##*", "*##*", "*A**", "*B**"];
    const definitions = new Map<string, string>([["AB", "Определение"]]);
    const layouts = buildClueLayouts(grid, slots, solved, definitions);
    const clue = layoutByKey(layouts, "1,1");
    assert.equal(clue.areaCells.length, 1);
    assert.equal(clue.clusterCells, undefined);
  } finally {
    if (previousValue === undefined) {
      delete process.env[AREA_EXPANSION_ENV_KEY];
    } else {
      process.env[AREA_EXPANSION_ENV_KEY] = previousValue;
    }
  }
}

function main(): void {
  const previousValue = process.env[AREA_EXPANSION_ENV_KEY];
  process.env[AREA_EXPANSION_ENV_KEY] = "1";
  try {
    testExpandFor02GroupSizeAtLeast4SingleSlot();
    testNoExpandFor02GroupSizeLessThan4();
    testNoExpandWhenTwoSlotsPointToSame02Group();
    testNoExpandWhenGroupIsNot02();
    testRectAreaWithAttachedTailDefinitionCanExpand();
    testTwoCellSideTailDoesNotExpand();
    testClusterAppliesOnlyToClusterDefinitionSlot();
    testNoExpansionForOverlappingCandidatesFromDifferentDefinitions();
    testAnchorCanExpandToLocalRectangleWhenAnotherRectangleIsBigger();
    testNoClusterForMultiDefinitionComponent();
    testDefinitionLimitsForExpandedAndSharedGroups();
    testRenderBottomLeftTextBlockForMultiCellArea();
    testRenderClueTextUsesUniformScaleAndLineHeight();
    testRenderClueTextIgnoresClientScaleOverridesForNow();
    testRenderClueTextUsesSingleFontSizeForCorelLines();
    testRenderClueTextStartsAt9PtAndShrinksNoLowerThan8Pt();
    testRenderClueTextInvalidScaleStillUsesFixed80();
    testRenderClusterDefinitionFrameAndPadding();
    testRenderMultiCellAreaCanUseMoreThanFourLines();
    testExpandUsesVisibleDefinitionCountNotRawSlotCount();
    testNoExpandForOneByFourStripe();
    testTailAnchorCanExpandToDetachedTwoBySevenRectangle();
    testNoClusterHighlightForTwoDefinitionsInRectangle();
    testClusterHighlightWithoutDefinitionTexts();
    testReviewPayloadKeepsExpandedAreaCellCount();
    testDisable02AreaExpansionByEnv();
  } finally {
    if (previousValue === undefined) {
      delete process.env[AREA_EXPANSION_ENV_KEY];
    } else {
      process.env[AREA_EXPANSION_ENV_KEY] = previousValue;
    }
  }
  console.log("clue layout smoke checks passed");
}

main();
