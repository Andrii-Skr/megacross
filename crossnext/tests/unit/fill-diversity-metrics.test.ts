import { describe, expect, it } from "vitest";
import { compareFillRuns } from "../../../cross/server/src/utils/fillDiversityMetrics";

describe("repeated fill comparison", () => {
  it("recognizes identical fills independently of template order", () => {
    const a = { key: "a", filled: true, words: ["КОТ", "ДОМ"] };
    const b = { key: "b", filled: true, words: ["САД"] };
    expect(compareFillRuns([a, b], [b, a])).toMatchObject({
      comparableTemplates: 2,
      identicalTemplates: 2,
      changedTemplates: 0,
      comparedSlots: 3,
      identicalSlots: 3,
      sameSlotShare: 1,
      batchSharedWords: 3,
      batchWordOverlapShare: 1,
    });
  });

  it("distinguishes the same word pool from words in the same slots", () => {
    const result = compareFillRuns(
      [{ key: "a", filled: true, words: ["КОТ", "ДОМ"] }],
      [{ key: "a", filled: true, words: ["ДОМ", "КОТ"] }],
    );
    expect(result.identicalTemplates).toBe(0);
    expect(result.sameSlotShare).toBe(0);
    expect(result.batchWordOverlapShare).toBe(1);
  });

  it("excludes failures, missing templates and incompatible slot counts", () => {
    const result = compareFillRuns(
      [
        { key: "a", filled: true, words: ["КОТ", "ДОМ"] },
        { key: "b", filled: false, words: [] },
        { key: "c", filled: true, words: ["САД"] },
        { key: "d", filled: true, words: ["ЛЕС"] },
      ],
      [
        { key: "a", filled: true, words: ["КОТ", "СОН"] },
        { key: "b", filled: true, words: ["САД"] },
        { key: "c", filled: true, words: ["САД", "ЛЕС"] },
      ],
    );
    expect(result).toMatchObject({
      comparableTemplates: 1,
      changedTemplates: 1,
      comparedSlots: 2,
      identicalSlots: 1,
      sameSlotShare: 0.5,
      batchWordOverlapShare: 0.5,
    });
  });

  it("returns no misleading percentage when there are no comparable answers", () => {
    expect(compareFillRuns([], [])).toMatchObject({
      comparableTemplates: 0,
      sameSlotShare: null,
      batchWordOverlapShare: null,
    });
  });
});
