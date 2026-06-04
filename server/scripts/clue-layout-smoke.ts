#!/usr/bin/env tsx
import assert from "node:assert/strict";
import type { Grid, Slot } from "../src/types";
import { DIRS } from "../src/types";
import { buildClueLayouts } from "../src/utils/clues";
import { runClueRenderSmokeSuite } from "./clue-layout-smoke-render";
import { runClueReviewSmokeSuite } from "./clue-layout-smoke-review";
import { buildCrosswordSvg } from "./crossword-svg";

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

function testAreaExpansionIsEnabledByDefaultEvenWhenEnvDisabled(): void {
  const previousValue = process.env[AREA_EXPANSION_ENV_KEY];
  process.env[AREA_EXPANSION_ENV_KEY] = "0";
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
    assert.equal(clue.areaCells.length, 4);
  } finally {
    if (previousValue === undefined) {
      delete process.env[AREA_EXPANSION_ENV_KEY];
    } else {
      process.env[AREA_EXPANSION_ENV_KEY] = previousValue;
    }
  }
}

function testAreaExpansionCanBeDisabledExplicitlyByOption(): void {
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expand02Area: false });
  const clue = layoutByKey(layouts, "1,1");
  assert.equal(clue.areaCells.length, 1);
  assert.equal(clue.clusterCells, undefined);
}

function testPhotoClueRendersImageUnderDefinitionPlaque(): void {
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
  const definitions = new Map<string, string>([["AB", "Фото определение"]]);
  const { svg } = buildCrosswordSvg(grid, slots, solved, definitions, {
    style: "default",
    arrowMode: "export",
    arrowScale: 1,
    photoClues: [{ clueKey: "1,1", href: "https://example.com/photo.jpg" }],
  });

  const imageIndex = svg.indexOf('<image href="https://example.com/photo.jpg"');
  const textIndex = svg.indexOf(">Фото<");
  assert.ok(imageIndex >= 0, "expected photo clue image in svg");
  assert.ok(
    svg.includes(">определение</tspan>") || (svg.includes(">определе-</tspan>") && svg.includes(">ние</tspan>")),
    "expected definition text to be rendered either on one line or split across lines",
  );
  assert.ok(textIndex >= 0, "expected definition text in svg");
  assert.ok(imageIndex < textIndex, "expected image layer before definition plaque");
  assert.match(svg, /<rect x="31" y="[0-9.]+" width="60" height="[0-9.]+" fill="#fff"\/>/);
  assert.match(svg, /<rect x="32" y="[0-9.]+" width="58" height="[0-9.]+" fill="none" stroke="#2B2A29" stroke-width="2"\/>/);
  assert.match(svg, /<text x="61" y="[0-9.]+" font-size="12" text-anchor="middle"/);
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
    runClueReviewSmokeSuite();
    runClueRenderSmokeSuite();
    testExpandUsesVisibleDefinitionCountNotRawSlotCount();
    testNoExpandForOneByFourStripe();
    testTailAnchorCanExpandToDetachedTwoBySevenRectangle();
    testNoClusterHighlightForTwoDefinitionsInRectangle();
    testClusterHighlightWithoutDefinitionTexts();
    testAreaExpansionIsEnabledByDefaultEvenWhenEnvDisabled();
    testAreaExpansionCanBeDisabledExplicitlyByOption();
    testPhotoClueRendersImageUnderDefinitionPlaque();
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
