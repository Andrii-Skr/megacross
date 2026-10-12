import { describe, expect, it } from "vitest";
import { analyzeFillability } from "../../../cross/server/src/templateGenerator/fillability";
import { maximalRuns, slotsForSolver } from "../../../cross/server/src/templateGenerator/generator";
import type { Cell } from "../../../cross/server/src/types";

const crossing = {
  rows: 3,
  cols: 3,
  data: ["###", "#↘*", "#→*"],
  codes: [
    [2, 2, 2],
    [2, 0x19, 1],
    [2, 0x18, 1],
  ],
};
describe("template crossing feasibility", () => {
  it("keeps coordinates and updates word runs after local mutations", () => {
    const mask = ["#****###****", "#****###****"].map((row) => [...row] as Cell[]);
    expect(maximalRuns(mask, "right").map(({ r, c, cells }) => [r, c, cells.length])).toEqual([
      [0, 1, 4],
      [0, 8, 4],
      [1, 1, 4],
      [1, 8, 4],
    ]);
    mask[0][3] = "#";
    expect(maximalRuns(mask, "right").map(({ r, c, cells }) => [r, c, cells.length])).toEqual([
      [0, 8, 4],
      [1, 1, 4],
      [1, 8, 4],
    ]);
    expect(maximalRuns(mask, "right", 2).some(({ r, c, cells }) => r === 0 && c === 1 && cells.length === 2)).toBe(
      true,
    );
  });
  it("keeps vertical start ordering and treats cutouts as barriers", () => {
    const mask = ["#*#*", "#*#*", "#*#%", "###*", "###*", "###*"].map((row) => [...row] as Cell[]);
    expect(maximalRuns(mask, "down").map(({ r, c, cells }) => [r, c, cells.length])).toEqual([
      [0, 1, 3],
      [3, 3, 3],
    ]);
  });
  it("rejects domains whose intersecting letters cannot agree", () => {
    const result = analyzeFillability(crossing, new Map([[2, ["АБ"]]]));
    expect(result.feasible).toBe(false);
    expect(result.bottleneckSlots).not.toHaveLength(0);
  });
  it("keeps supported crossing domains for the full uniqueness solver", () => {
    expect(analyzeFillability(crossing, new Map([[2, ["АА", "АБ", "БА", "ББ"]]])).feasible).toBe(true);
  });
  it("rejects slots without dictionary supply", () => {
    expect(analyzeFillability(crossing, new Map()).feasible).toBe(false);
  });
  it("propagates singleton uniqueness even between non-crossing answers", () => {
    const grid = {
      rows: 2,
      cols: 3,
      data: ["#→*", "#→*"],
      codes: [
        [2, 0x18, 1],
        [2, 0x18, 1],
      ],
    };
    expect(analyzeFillability(grid, new Map([[2, ["АД"]]])).feasible).toBe(false);
  });
  it("passes logically forced letters to the native solver", () => {
    const grid = {
      rows: 2,
      cols: 4,
      data: ["#→*#", "#→**"],
      codes: [
        [2, 0x18, 1, 2],
        [2, 0x18, 1, 1],
      ],
    };
    expect(
      analyzeFillability(
        grid,
        new Map([
          [2, ["АД"]],
          [3, ["ДАР"]],
        ]),
      ).fixedRows,
    ).toEqual(["#АД#", "#ДАР"]);
  });
  it("never eliminates a brute-force solution or forces a wrong letter", () => {
    const words = ["АА", "АБ", "БА", "ББ"];
    const slots = slotsForSolver(crossing);
    for (let mask = 1; mask < 16; mask += 1) {
      const domain = words.filter((_, id) => mask & (1 << id));
      const checked = analyzeFillability(crossing, new Map([[2, domain]]));
      for (const a of domain)
        for (const b of domain)
          for (const c of domain) {
            const assignment = [a, b, c];
            if (new Set(assignment).size !== 3) continue;
            const cells = new Map<string, string>();
            let valid = true;
            slots.forEach((slot, id) => {
              slot.cells.forEach(([r, col], offset) => {
                const key = `${r},${col}`;
                const letter = assignment[id][offset];
                if (cells.has(key) && cells.get(key) !== letter) valid = false;
                cells.set(key, letter);
              });
            });
            if (!valid) continue;
            expect(checked.feasible).toBe(true);
            for (const [key, letter] of cells) {
              const [r, col] = key.split(",").map(Number);
              const forced = checked.fixedRows[r][col];
              if (forced !== ".") expect(forced).toBe(letter);
            }
          }
    }
  });
});
