#!/usr/bin/env tsx
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSlotsDetailed } from "@megacross/cross-format";
import type { Grid, Slot } from "../src/types";
import { DIRS } from "../src/types";
import { buildClueLayouts, buildPhotoAreaBoundsBySlotId, findAnchorlessEdgeClusterCells } from "../src/utils/clues";
import { parseFsh } from "../src/utils/parseFsh";
import { runClueRenderSmokeSuite } from "./clue-layout-smoke-render";
import { runClueReviewSmokeSuite } from "./clue-layout-smoke-review";
import { buildCrosswordSvg } from "./crossword-svg";
import { convertMmToCorelUnits } from "./svg-theme";

const AREA_EXPANSION_ENV_KEY = "CROSS_ENABLE_02_AREA_EXPANSION";
const TEST_DEFAULT_CELL_SIZE_MM = 30 / (96 / 25.4);
const TEST_TYPE0_CELL_SIZE_MM = 8.5;

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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
  const clue = layoutByKey(layouts, "1,1");
  assert.equal(clue.areaCells.length, 4);
}

function testSmall02GroupUsesPairWithoutPhoto(): void {
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
  assert.deepEqual(clue.areaCells, [[0, 0], [0, 1]]);
  assert.equal(clue.areaKind, "paired");
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
  const clue = layoutByKey(layouts, "1,1");
  assert.equal(clue.areaCells.length, 4);
}

function testOneByFourStripeUsesPairWithoutPhoto(): void {
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
  assert.deepEqual(clue.areaCells, [[0, 2], [0, 3]]);
  assert.equal(clue.areaKind, "paired");
}

function testPairedClueSvgHasOneFrameAndNoPhotoArea(): void {
  const data = ["##↓*", "****"];
  const codes = createCodes(2, 4, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[0][2] = 0x03;
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [{
    id: 1,
    r: 0,
    c: 2,
    dir: DIRS.down,
    len: 2,
    cells: [[0, 2], [1, 2]],
  }];
  const solved = ["##A*", "**B*"];
  const definitions = new Map([["AB", "Текст"]]);
  const clue = layoutByKey(buildClueLayouts(grid, slots, solved, definitions), "0,1");
  assert.deepEqual(clue.areaCells, [[0, 0], [0, 1]]);
  assert.equal(clue.areaKind, "paired");
  assert.equal(buildPhotoAreaBoundsBySlotId(grid, slots, solved, definitions).size, 0);

  const result = buildCrosswordSvg(grid, slots, solved, definitions, {
    style: "default",
    arrowMode: "export",
    arrowScale: 1,
    templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
    type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
  });
  for (const variant of ["svg", "svgRaw"] as const) {
    const output = result[variant];
    assert.ok(output.includes('<rect x="1" y="1" width="60" height="30" fill="none" stroke="#000000" stroke-width="2"/>'));
    assert.equal(output.includes('<rect x="31" y="1" width="30" height="30" fill="none"'), false);
    assert.ok(output.includes(">Текст</tspan>"));
  }
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
  const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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
    const layouts = buildClueLayouts(grid, slots, solved, definitions, { expandPairedClues: false });
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

function testExpandedCluePlaqueWithAndWithoutPhoto(): void {
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
  const embeddedPhoto = "data:image/jpeg;base64,QUJDRA==";
  const { svg } = buildCrosswordSvg(grid, slots, solved, definitions, {
    style: "default",
    arrowMode: "export",
    arrowScale: 1,
    templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
    type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
    photoClues: [{ clueKey: "1,1", href: embeddedPhoto }],
  });

  const imageIndex = svg.indexOf(`<image href="${embeddedPhoto}"`);
  const gridIndex = svg.indexOf('<rect x="1" y="1" width="30" height="30" fill="#fff"/>');
  const textIndex = svg.indexOf(">Фото определение<");
  assert.ok(imageIndex >= 0, "expected photo clue image in svg");
  assert.ok(gridIndex >= 0, "expected main grid in svg");
  assert.ok(imageIndex < gridIndex, "expected photo layer under the main grid");
  assert.equal(svg.includes('href="assets/'), false, "photo clue image should not depend on archive assets");
  assert.ok(svg.includes(">Фото определение</tspan>"), "expected complete definition text on the plaque");
  assert.ok(textIndex >= 0, "expected definition text in svg");
  assert.ok(imageIndex < textIndex, "expected image layer before definition plaque");
  assert.match(
    svg,
    /<image href="data:image\/jpeg;base64,QUJDRA==" x="31" y="1" width="60" height="60" preserveAspectRatio="xMidYMid slice"\/>/,
  );
  const photoFrame = '<rect x="31" y="1" width="60" height="60" fill="none" stroke="#000000" stroke-width="2"/>';
  assert.ok(svg.indexOf(photoFrame, imageIndex) > imageIndex, "expected frame over the photo edge");
  assert.match(svg, /<rect x="31" y="[0-9.]+" width="[0-9.]+" height="[0-9.]+" fill="#fff"\/>/);
  assert.match(svg, /<rect x="31" y="[0-9.]+" width="[0-9.]+" height="[0-9.]+" fill="none" stroke="#000000" stroke-width="2"\/>/);
  assert.match(svg, /<text x="[0-9.]+" y="[0-9.]+" font-size="[0-9.]+"[^>]*text-anchor="middle"/);
  for (const style of ["default", "corel"] as const) {
    for (const withPhoto of [false, true]) {
      const rendered = buildCrosswordSvg(grid, slots, solved, definitions, {
        style,
        arrowMode: "export",
        arrowScale: 1,
        templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
        type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
        photoClues: withPhoto ? [{ clueKey: "1,1", href: embeddedPhoto }] : [],
      });
      const cellUnits = style === "corel" ? convertMmToCorelUnits(TEST_DEFAULT_CELL_SIZE_MM) : 30;
      const areaX = style === "corel" ? cellUnits / 2 : 31;
      const areaY = style === "corel" ? -Math.round(cellUnits * 0.034) : 1;
      const areaBottom = areaY + cellUnits * 2;
      for (const variant of ["svg", "svgRaw"] as const) {
        const output = rendered[variant];
        assert.equal(output.includes(`<image href="${embeddedPhoto}"`), withPhoto,
          `${style} ${variant}: photo presence`);
        const plaque = [...output.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="#fff"\/>/g)]
          .filter((match) => Math.abs(Number(match[1]) - areaX) < 0.001 && Number(match[2]) < areaBottom)
          .at(-1);
        assert.ok(plaque, `${style} ${variant} photo=${withPhoto}: expected plaque`);
        const unitsPerMm = style === "corel" ? 2480 / 210 : 96 / 25.4;
        assert.ok(Math.abs(Number(plaque[4]) / unitsPerMm - 3.5) < 0.001,
          `${style} ${variant} photo=${withPhoto}: plaque height must be 3.5 mm`);
        const frame = [...output.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="none" stroke="#000000" stroke-width="([^"]+)"\/>/g)]
          .find((match) => Math.abs(Number(match[1]) - areaX) < 0.001 &&
            Number(match[2]) > Number(plaque[2]) && Number(match[2]) < Number(plaque[2]) + Number(plaque[4]));
        assert.ok(frame, `${style} ${variant} photo=${withPhoto}: expected plaque frame`);
        assert.ok(Math.abs(Number(frame[2]) + Number(frame[4]) - areaBottom) < 0.001,
          `${style} ${variant} photo=${withPhoto}: frame bottom must coincide with cell edge`);
      }
    }
  }
}

function testClusterBackgroundIsTransparent(): void {
  const data = ["*##*#", "*##**", "*↓***", "*****"];
  const codes = createCodes(4, 5);
  for (const [row, col] of [[0, 1], [0, 2], [1, 1], [1, 2]]) {
    codes[row][col] = 0x02;
  }
  const grid = buildGrid(data, codes);
  const slots: Slot[] = [{ id: 1, r: 2, c: 1, dir: DIRS.down, len: 2, cells: [[2, 1], [3, 1]] }];
  const solved = ["*##*#", "*##**", "*A***", "*B***"];
  for (const style of ["default", "corel"] as const) {
    for (const withText of [false, true]) {
      for (const withPhoto of [false, true]) {
        const definitions = new Map<string, string>(withText ? [["AB", "Фото"]] : []);
        const options = {
          style, arrowMode: "export" as const, arrowScale: 1,
          templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
          type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
          photoClues: withPhoto ? [{ clueKey: "1,1", href: "data:image/jpeg;base64,QUJDRA==" }] : [],
        };
        const result = buildCrosswordSvg(grid, slots, solved, definitions, options);
        const debug = buildCrosswordSvg(grid, slots, solved, definitions, {
          ...options, debugClusterFill: true, debugClusterColor: "#abcdef",
        });
        if (style === "corel") {
          assert.match(result.svg, /font-family="Arimo"/u, "Corel SVG should use bundled Arimo");
          assert.match(
            result.svg,
            /@font-face\{font-family:'Arimo';src:url\('data:font\/ttf;base64,/u,
            "Corel SVG should embed the same font used for text measurement"
          );
        }
        for (const variant of ["svg", "svgRaw"] as const) {
          const highlighted = debug[variant].match(/<rect[^>]*fill="#abcdef"\/>/g) ?? [];
          assert.equal(highlighted.length, 4, "all cluster cells should retain debug highlighting");
          assert.equal(debug[variant].replace(/<rect[^>]*fill="#abcdef"\/>/g, ""), result[variant],
            "only cluster backgrounds should differ from debug output");
          for (const rect of highlighted) {
            const geometry = rect.slice(0, rect.indexOf(' fill='));
            const cellRects = result[variant].match(/<rect[^>]*\/>/g) ?? [];
            assert.ok(!cellRects.some((item) => item.startsWith(`${geometry} fill=`)),
              "cluster cells must have neither background fill nor cell borders");
          }
          assert.ok(!result[variant].includes("#abcdef"));
          assert.ok(result[variant].includes(`fill="${style === "corel" ? "#FEFEFE" : "#fff"}"`), "keep ordinary cell fill");
          assert.equal(result[variant].includes("<image "), withText && withPhoto);
          if (withText && withPhoto) {
            const photoIndex = result[variant].indexOf("<image ");
            const ordinaryCellIndex = result[variant].indexOf(
              `fill="${style === "corel" ? "#FEFEFE" : "#fff"}"/>`,
            );
            assert.ok(photoIndex < ordinaryCellIndex, "photo layer must be under the main grid");
          }
          if (withText) assert.ok(result[variant].includes('fill="#fff"/>'), "keep white text plaque");
        }
      }
    }
  }
}

function testAnchorlessEdgeClusterFixtures(): void {
  const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "anchorless-edge-clusters");
  const expected = Array.from({ length: 6 }, (_, index) => [14, index + 5]);
  for (const name of ["12-2026", "14-2026", "16-2026", "18-2026"]) {
    const grid = parseFsh(path.join(fixtureDirectory, `${name}.fsh`));
    const slots = scanSlotsDetailed(grid).slots;
    const layouts = buildClueLayouts(grid, slots, grid.data, new Map());
    assert.deepEqual(findAnchorlessEdgeClusterCells(grid, layouts), expected, `${name}: only the lower strip is a cutout`);
    assert.equal(layouts.some((layout) => layout.key === "13,5" && layout.clusterCells?.length), false);

    for (const style of ["default", "corel"] as const) {
      const options = {
        style,
        arrowMode: "export" as const,
        arrowScale: 1,
        templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
        type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
      };
      const normal = buildCrosswordSvg(grid, slots, grid.data, new Map(), options);
      const debug = buildCrosswordSvg(grid, slots, grid.data, new Map(), {
        ...options,
        debugClusterFill: true,
        debugClusterColor: "#abcdef",
      });
      for (const variant of ["svg", "svgRaw"] as const) {
        const highlighted = debug[variant].match(/<rect[^>]*fill="#abcdef"\/>/g) ?? [];
        assert.ok(highlighted.length >= 6, `${name}: debug view must include the six cutout cells`);
        const cell = style === "default" ? 30 : convertMmToCorelUnits(TEST_DEFAULT_CELL_SIZE_MM);
        const offsetX = style === "default" ? 1 : -cell / 2;
        const offsetY = style === "default" ? 1 : -Math.round(cell * 0.034);
        for (let col = 5; col <= 10; col += 1) {
          const geometry = `x="${offsetX + col * cell}" y="${offsetY + 14 * cell}" width="${cell}" height="${cell}"`;
          assert.ok(highlighted.some((rect) => rect.includes(geometry)), `${name}: debug cell 14,${col}`);
          assert.ok(!normal[variant].includes(`<rect ${geometry}`), `${name}: cutout cell 14,${col} has no fill or border`);
        }
        assert.ok(normal[variant].includes(`x="${offsetX + 5 * cell}" y="${offsetY + 13 * cell}"`),
          `${name}: neighboring block above the strip remains`);
        const contourLines = [...normal[variant].matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)];
        assert.ok(contourLines.some((match) =>
          Math.abs(Number(match[1]) - (offsetX + 5 * cell)) < 0.001 &&
          Math.abs(Number(match[2]) - (offsetY + 14 * cell)) < 0.001 &&
          Math.abs(Number(match[3]) - (offsetX + 6 * cell)) < 0.001 &&
          Math.abs(Number(match[4]) - (offsetY + 14 * cell)) < 0.001),
        `${name}: contour follows the cutout edge`);
      }
    }
  }
}

function testAnchorlessEdgeClusterGuards(): void {
  const codes = createCodes(5, 7, 0x02);
  const grid = buildGrid(["*####**", "*******", "###****", "*******", "**##***"], codes);
  grid.templateType = "scanword";
  const layouts = [{
    key: "0,2", row: 0, col: 2, slotIds: [1], definitionSlotIds: [1],
    areaCells: [[0, 2] as [number, number]], text: "definition",
  }];
  assert.deepEqual(findAnchorlessEdgeClusterCells(grid, layouts), [],
    "an anchor splits the upper run, and shorter edge runs remain ordinary blocks");
  assert.deepEqual(findAnchorlessEdgeClusterCells(grid, []), [[0, 1], [0, 2], [0, 3], [0, 4]],
    "a four-cell anchorless run on another edge is cut out");
  const occupied = [{ ...layouts[0], key: "0,0", row: 0, col: 0, areaCells: [[0, 1] as [number, number]],
    clusterCells: [[0, 2] as [number, number]] }];
  assert.deepEqual(findAnchorlessEdgeClusterCells(grid, occupied), [],
    "existing expanded areas and clusters must not overlap a new cutout");
}

function testNonScanwordEdgeBlocksRemainVisible(): void {
  const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "non-scanword-edge", "85.fsh");
  const grid = parseFsh(fixturePath);
  const slots = scanSlotsDetailed(grid).slots;
  const layouts = buildClueLayouts(grid, slots, grid.data, new Map());
  assert.equal(grid.templateType, "crossword_variant");
  assert.deepEqual(findAnchorlessEdgeClusterCells(grid, layouts), [], "crossword blocks are not scanword cutouts");

  const result = buildCrosswordSvg(grid, slots, grid.data, new Map(), {
    style: "default",
    arrowMode: "export",
    arrowScale: 1,
    templateCellSizeMm: TEST_DEFAULT_CELL_SIZE_MM,
    type0CellSizeMm: TEST_TYPE0_CELL_SIZE_MM,
  });
  for (const variant of ["svg", "svgRaw"] as const) {
    assert.ok(result[variant].includes('<rect x="361" y="391" width="30" height="30" fill="#EBECEC"/>'),
      "right edge block remains visible");
    assert.ok(result[variant].includes('<rect x="241" y="511" width="30" height="30" fill="#EBECEC"/>'),
      "bottom edge block remains visible");
  }
}

function main(): void {
  const previousValue = process.env[AREA_EXPANSION_ENV_KEY];
  process.env[AREA_EXPANSION_ENV_KEY] = "1";
  try {
    testExpandFor02GroupSizeAtLeast4SingleSlot();
    testSmall02GroupUsesPairWithoutPhoto();
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
    testOneByFourStripeUsesPairWithoutPhoto();
    testPairedClueSvgHasOneFrameAndNoPhotoArea();
    testTailAnchorCanExpandToDetachedTwoBySevenRectangle();
    testNoClusterHighlightForTwoDefinitionsInRectangle();
    testClusterHighlightWithoutDefinitionTexts();
    testAreaExpansionIsEnabledByDefaultEvenWhenEnvDisabled();
    testAreaExpansionCanBeDisabledExplicitlyByOption();
    testExpandedCluePlaqueWithAndWithoutPhoto();
    testClusterBackgroundIsTransparent();
    testAnchorlessEdgeClusterFixtures();
    testAnchorlessEdgeClusterGuards();
    testNonScanwordEdgeBlocksRemainVisible();
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
