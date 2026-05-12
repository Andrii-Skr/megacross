import { describe, expect, it } from "vitest";
import type { FillReviewPayload } from "@/components/scanwords/workspace/model";
import {
  buildEditableTemplateStates,
  buildFinalizePayload,
  mapPersistedRowsByTemplate,
  normalizePersistedRows,
} from "@/components/scanwords/workspace/reviewDraftState";

function makeReviewPayload(): FillReviewPayload {
  return {
    version: 1,
    issue: {
      issueId: "1",
      editionId: 7,
      editionCode: "E1",
      issueLabel: "42",
    },
    options: {
      style: "corel",
      writeCrw: false,
      usageStats: true,
    },
    templates: [
      {
        key: "tpl-1",
        name: "8",
        sourceName: "8.fsh",
        order: 0,
        path: "sample/8.fsh",
        language: "ru",
        langId: 1,
        grid: {
          rows: 1,
          cols: 1,
          data: ["*"],
          marker: "000",
          codes: [[1]],
        },
        slots: [
          {
            slotId: 10,
            r: 0,
            c: 0,
            dir: "right",
            len: 3,
            cells: [[0, 0]],
            word: "КОТ",
            wordId: "100",
            opredId: "200",
            definition: "Кот",
            definitionOptions: [{ opredId: "200", text: "Кот", difficulty: 2 }],
            isPhotoDefinition: false,
            intersections: [],
            clueCell: null,
            startNumber: 1,
          },
        ],
        clueGroups: [],
        startPositions: [],
      },
      {
        key: "tpl-2",
        name: "9",
        sourceName: "9.fsh",
        order: 1,
        path: "sample/9.fsh",
        language: "ru",
        langId: 1,
        grid: {
          rows: 1,
          cols: 1,
          data: ["*"],
          marker: "000",
          codes: [[1]],
        },
        slots: [
          {
            slotId: 11,
            r: 0,
            c: 0,
            dir: "right",
            len: 4,
            cells: [[0, 0]],
            word: "ЛИСА",
            wordId: "101",
            opredId: "201",
            definition: "Лиса",
            definitionOptions: [{ opredId: "201", text: "Лиса", difficulty: 1 }],
            isPhotoDefinition: false,
            intersections: [],
            clueCell: null,
            startNumber: 1,
          },
        ],
        clueGroups: [],
        startPositions: [],
      },
    ],
  };
}

describe("review draft state helpers", () => {
  it("builds editable template state from persisted draft rows", () => {
    const payload = makeReviewPayload();
    const rows = normalizePersistedRows([
      {
        templateKey: "tpl-1",
        slotId: 10,
        word: "дом",
        definition: "Домашний кот",
        wordId: "500",
        opredId: "600",
      },
    ]);
    const editable = buildEditableTemplateStates(payload.templates, mapPersistedRowsByTemplate(rows));

    expect(editable).toHaveLength(2);
    expect(editable[0]).toMatchObject({
      key: "tpl-1",
      slots: [
        {
          slotId: 10,
          word: "ДОМ",
          definition: "Домашний кот",
          wordId: "500",
          opredId: "600",
        },
      ],
    });
    expect(editable[0]?.slots[0]?.definitionOptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "Домашний кот", opredId: "600" })]),
    );
    expect(editable[1]).toMatchObject({
      key: "tpl-2",
      slots: [{ slotId: 11, word: "ЛИСА", definition: "Лиса" }],
    });
  });

  it("builds finalize payload for all templates and normalizes limits", () => {
    const payload = makeReviewPayload();
    const finalizePayload = buildFinalizePayload(
      payload,
      {
        "tpl-1": [
          {
            slotId: 10,
            word: "  дом ",
            definition: " Новый кот ",
            wordId: "500",
            opredId: "600",
            definitionOptions: [],
          },
        ],
        "tpl-2": [
          {
            slotId: 11,
            word: "лиса",
            definition: "Лесная лиса",
            wordId: "101",
            opredId: "201",
            definitionOptions: [],
          },
        ],
      },
      { maxPerCell: 12.9, maxPerHalfCell: 99 },
    );

    expect(finalizePayload).toEqual({
      templates: [
        {
          key: "tpl-1",
          slots: [
            {
              slotId: 10,
              word: "ДОМ",
              definition: "Новый кот",
              wordId: "500",
              opredId: "600",
            },
          ],
        },
        {
          key: "tpl-2",
          slots: [
            {
              slotId: 11,
              word: "ЛИСА",
              definition: "Лесная лиса",
              wordId: "101",
              opredId: "201",
            },
          ],
        },
      ],
      definitionLimits: {
        maxPerCell: 12,
        maxPerHalfCell: 99,
      },
    });
  });
});
