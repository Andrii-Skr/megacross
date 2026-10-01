import { describe, expect, it } from "vitest";
import type { FillReviewTemplate } from "@/components/scanwords/workspace/model";
import {
  getPairedDefinitionMaxLength,
  isPreferredPairedDefinition,
  pickReviewDefinition,
  preferPairedReviewDefinitions,
} from "@/components/scanwords/workspace/reviewDefinitionPolicy";
import { buildInitialTemplateState } from "@/components/scanwords/workspace/reviewDraftState";

function template(): FillReviewTemplate {
  return {
    key: "paired",
    name: "1",
    sourceName: "1.fsh",
    order: 0,
    path: "1.fsh",
    language: "ru",
    langId: 1,
    grid: { rows: 1, cols: 2, data: ["##"], codes: [[2, 2]], marker: "" },
    startPositions: [],
    clueGroups: [{ key: "0,0", row: 0, col: 0, slotIds: [1], areaCellCount: 2 }],
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "right",
        len: 3,
        cells: [],
        word: "КОТ",
        wordId: "1",
        opredId: "short",
        definition: "Кот",
        definitionOptions: [
          { text: "Кот", opredId: "short", difficulty: null },
          { text: "Домашний любимец", opredId: "long", difficulty: null },
        ],
        isPhotoDefinition: false,
        availableImages: [],
        selectedImageId: null,
        intersections: [],
        clueCell: { key: "0,0", row: 0, col: 0 },
      },
    ],
  };
}

describe("review definition policy", () => {
  it("doubles the configured limit for paired text cells only", () => {
    const item = template();
    expect(getPairedDefinitionMaxLength(item, 1, 30)).toBe(60);
    expect(getPairedDefinitionMaxLength(item, 1, 40)).toBe(80);
    item.slots[0].isPhotoDefinition = true;
    expect(getPairedDefinitionMaxLength(item, 1, 30)).toBeNull();
    item.slots[0].isPhotoDefinition = false;
    item.clueGroups[0].areaCellCount = 1;
    expect(getPairedDefinitionMaxLength(item, 1, 30)).toBeNull();
  });

  it("accepts 15 and 60 characters and prefers them over a short definition", () => {
    expect(isPreferredPairedDefinition("x".repeat(14), 60)).toBe(false);
    expect(isPreferredPairedDefinition("x".repeat(15), 60)).toBe(true);
    expect(isPreferredPairedDefinition("x".repeat(60), 60)).toBe(true);
    expect(isPreferredPairedDefinition("x".repeat(61), 60)).toBe(false);
    const slot = template().slots[0];
    expect(pickReviewDefinition(slot.definitionOptions, slot, 60)?.opredId).toBe("long");
    expect(pickReviewDefinition(slot.definitionOptions, slot, null)?.opredId).toBe("short");
    expect(pickReviewDefinition(slot.definitionOptions.slice(0, 1), slot, 60)?.opredId).toBe("short");
  });

  it("selects a longer clue on opening review and preserves saved manual choices", () => {
    const item = template();
    const rows = { [item.key]: buildInitialTemplateState(item) };
    expect(preferPairedReviewDefinitions([item], rows, 30)[item.key][0].opredId).toBe("long");
    const draft = {
      templateKey: item.key,
      slotId: 1,
      word: "КОТ",
      definition: "Кот",
      wordId: "1",
      opredId: "short",
      imageId: null,
      bookmarked: false,
    };
    const drafts = new Map([[item.key, new Map([[1, draft]])]]);
    expect(preferPairedReviewDefinitions([item], rows, 30, drafts)[item.key][0].opredId).toBe("short");
  });

  it("keeps a short fallback when the longer definition is already used", () => {
    const item = template();
    const rows = {
      [item.key]: buildInitialTemplateState(item),
      other: [
        {
          ...buildInitialTemplateState(item)[0],
          definition: "Домашний любимец",
          opredId: "long",
        },
      ],
    };
    expect(preferPairedReviewDefinitions([item], rows, 30)[item.key][0].opredId).toBe("short");
  });
});
