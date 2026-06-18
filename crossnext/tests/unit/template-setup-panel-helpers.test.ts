import { describe, expect, it } from "vitest";
import type { TemplateSetupPreviewTemplate, TemplateSetupTemplate } from "@/components/scanwords/workspace/model";
import {
  applyLockedLettersToWord,
  buildLockedSlotLetters,
  buildReservedWordIds,
  wordMatchesLockedLetters,
} from "@/components/scanwords/workspace/TemplateSetupPanel";

function makeTemplate(): TemplateSetupPreviewTemplate {
  return {
    key: "tpl-1",
    name: "8",
    sourceName: "8.fsh",
    order: 0,
    grid: {
      rows: 6,
      cols: 6,
      data: ["******", "******", "******", "******", "******", "******"],
      marker: "000000",
      codes: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 1)),
    },
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "right",
        len: 6,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [0, 5],
        ],
        startNumber: 1,
        isPhotoDefinition: false,
        photoAreaBounds: null,
      },
      {
        slotId: 4,
        r: 0,
        c: 5,
        dir: "down",
        len: 6,
        cells: [
          [0, 5],
          [1, 5],
          [2, 5],
          [3, 5],
          [4, 5],
          [5, 5],
        ],
        startNumber: 4,
        isPhotoDefinition: true,
        photoAreaBounds: { minRow: 0, minCol: 0, maxRow: 2, maxCol: 2 },
      },
    ],
    startPositions: [
      { number: 1, r: 0, c: 0, dir: "right", slotId: 1 },
      { number: 4, r: 0, c: 5, dir: "down", slotId: 4 },
    ],
    cells: [{ row: 0, col: 5, isIntersection: true, slotIds: [1, 4] }],
    arrows: [],
    setup: null,
  };
}

function makeTemplateMap(): Map<string, TemplateSetupTemplate> {
  return new Map([
    [
      "tpl-1",
      {
        templateKey: "tpl-1",
        keyword: null,
        fixedSlots: [
          { slotId: 1, wordId: "word-1", word: "РАЗБЕГ" },
          { slotId: 4, wordId: "word-2", word: "ГОРОД" },
        ],
      },
    ],
    [
      "tpl-2",
      {
        templateKey: "tpl-2",
        keyword: null,
        fixedSlots: [{ slotId: 10, wordId: "word-3", word: "АБВ" }],
      },
    ],
  ]);
}

describe("template setup helpers", () => {
  it("locks letters that come from already fixed intersecting slots", () => {
    const template = makeTemplate();
    const fixedSlotMap = new Map([[1, { slotId: 1, wordId: "word-1", word: "РАЗБЕГ" }]]);

    const lockedBySlotId = buildLockedSlotLetters(template, fixedSlotMap);
    const lockedLetters = lockedBySlotId.get(4);

    expect(lockedLetters).toEqual(new Map([[0, "Г"]]));
    expect(applyLockedLettersToWord(["", "", "", "", "", ""], 6, lockedLetters ?? new Map())).toEqual([
      "Г",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(wordMatchesLockedLetters("ГОРОДО", lockedLetters ?? new Map())).toBe(true);
    expect(wordMatchesLockedLetters("АГУТИН", lockedLetters ?? new Map())).toBe(false);
  });

  it("excludes reserved wordIds from other slots but keeps the current slot word", () => {
    const templateMap = makeTemplateMap();

    expect(buildReservedWordIds(templateMap, null)).toEqual(new Set(["word-1", "word-2", "word-3"]));
    expect(buildReservedWordIds(templateMap, "word-2")).toEqual(new Set(["word-1", "word-3"]));
  });

  it("makes a cleared reserved word available again", () => {
    const templateMap = new Map<string, TemplateSetupTemplate>([
      [
        "tpl-1",
        {
          templateKey: "tpl-1",
          keyword: null,
          fixedSlots: [],
        },
      ],
    ]);

    expect(buildReservedWordIds(templateMap, null)).toEqual(new Set());
  });
});
