import { describe, expect, it } from "vitest";
import { buildFinalSlotState } from "../../../cross/server/src/services/fillFinalizeService";

const slot = {
  slotId: 1,
  r: 0,
  c: 0,
  dir: "right" as const,
  len: 3,
  cells: [
    [0, 0],
    [0, 1],
    [0, 2],
  ] as [number, number][],
  word: "КОТ",
  wordId: "10",
  opredId: "20",
  definition: "Питомец",
  selectedImageId: "30",
  isPhotoDefinition: true,
  photoAreaBounds: { minRow: 1, maxRow: 2, minCol: 0, maxCol: 1 },
};
const template = { key: "t", name: "1", grid: { rows: 1, cols: 3, data: ["***"] }, slots: [slot], clueGroups: [] };
describe("final slot image selection", () => {
  it("preserves the reviewed image when an override omits imageId", () => {
    const result = buildFinalSlotState(template, slot, { slotId: 1, definition: "Кошка" });
    expect(result.state.imageId).toBe(30n);
    expect(result.errors).toEqual([]);
  });
  it("honors explicit image removal", () => {
    const result = buildFinalSlotState(template, slot, { slotId: 1, imageId: null });
    expect(result.state.imageId).toBeNull();
    expect(result.errors).toContain("Slot 1: image is required for photo definition");
  });
});
