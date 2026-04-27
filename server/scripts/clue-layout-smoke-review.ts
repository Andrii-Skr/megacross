import assert from "node:assert/strict";
import { validateTemplateDefinitions, type FinalSlotState } from "../src/services/fillFinalizeService";
import { buildReviewTemplate, type ReviewTemplateEntry } from "../src/services/fillJobReviewService";
import { DIRS, type Grid, type Slot } from "../src/types";

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

export function runClueReviewSmokeSuite(): void {
  testDefinitionLimitsForExpandedAndSharedGroups();
  testReviewPayloadKeepsExpandedAreaCellCount();
}
