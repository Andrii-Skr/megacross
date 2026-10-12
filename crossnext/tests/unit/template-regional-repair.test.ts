import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../../cross/server/src/templateGenerator/generator";
import { searchRegionalRepair } from "../../../cross/server/src/templateGenerator/regionalRepair";
import type { Cell } from "../../../cross/server/src/types";

function fixture() {
  const mask = ["****", "****", "****", "****"].map((row) => [...row] as Cell[]);
  const mutable = mask.flatMap((row, r) => row.map((_, c) => [r, c] as const));
  return { mask, mutable };
}

describe("regional mask repair", () => {
  it("escapes a neighborhood where no single or paired flip can improve the score", () => {
    const { mask, mutable } = fixture();
    const before = mask.map((row) => row.join(""));
    const result = searchRegionalRepair(mask, {
      mutable,
      focus: [[1, 1]],
      rng: new SeededRandom("triple-only"),
      currentScore: 5,
      evaluate: () => {
        const count = mask.flat().filter((cell) => cell === "#").length;
        return { score: count >= 3 ? 0 : 5, value: mask.map((row) => row.join("")) };
      },
    });
    expect(result.best?.score).toBe(0);
    expect(result.best?.changes.length).toBeGreaterThanOrEqual(3);
    expect(mask.map((row) => row.join(""))).toEqual(before);
    for (const change of result.best?.changes ?? []) mask[change.row][change.col] = change.cell;
    expect(mask.map((row) => row.join(""))).toEqual(result.best?.value);
  });

  it("never touches frozen photo cells, their margins or cutouts", () => {
    const rng = new SeededRandom("frozen-regions");
    for (let seed = 0; seed < 40; seed += 1) {
      const mask = ["%***%", "*###*", "*###*", "*****", "%***%"].map((row) => [...row] as Cell[]);
      const before = mask.map((row) => [...row]);
      const mutable = mask.flatMap((row, r) =>
        row.flatMap((cell, c) => (cell === "*" && c !== 0 ? [[r, c] as const] : [])),
      );
      const allowed = new Set(mutable.map(([r, c]) => `${r},${c}`));
      searchRegionalRepair(mask, {
        mutable,
        focus: [[1, 2]],
        rng,
        currentScore: 4,
        evaluate: (changed) => {
          for (let r = 0; r < mask.length; r += 1)
            for (let c = 0; c < mask[0].length; c += 1) {
              if (!allowed.has(`${r},${c}`)) expect(mask[r][c]).toBe(before[r][c]);
            }
          expect(changed.every(([r, c]) => allowed.has(`${r},${c}`))).toBe(true);
          return { score: 3, value: null };
        },
      });
      expect(mask).toEqual(before);
    }
  });

  it("is bounded, deterministic and can reject every invalid trial", () => {
    const run = () => {
      const { mask, mutable } = fixture();
      const rng = new SeededRandom("repeatable-regional");
      const candidates: string[] = [];
      const result = searchRegionalRepair(mask, {
        mutable,
        focus: [],
        rng,
        currentScore: 3,
        maxEvaluations: 17,
        evaluate: () => {
          candidates.push(mask.map((row) => row.join("")).join("/"));
          return null;
        },
      });
      expect(result.best).toBeNull();
      expect(result.evaluations).toBe(17);
      expect(mask).toEqual(fixture().mask);
      return { candidates, position: rng.position };
    };
    expect(run()).toEqual(run());
  });

  it("rolls back even when evaluation throws", () => {
    const { mask, mutable } = fixture();
    expect(() =>
      searchRegionalRepair(mask, {
        mutable,
        focus: [[1, 1]],
        rng: new SeededRandom("failed-evaluation"),
        currentScore: 3,
        evaluate: () => {
          throw new Error("evaluation failed");
        },
      }),
    ).toThrow("evaluation failed");
    expect(mask).toEqual(fixture().mask);
  });

  it("never accepts worse/equal scores or runs with an empty budget", () => {
    const { mask, mutable } = fixture();
    let calls = 0;
    for (const maxEvaluations of [0, 30]) {
      const result = searchRegionalRepair(mask, {
        mutable,
        focus: [],
        rng: new SeededRandom("no-improvement"),
        currentScore: 3,
        maxEvaluations,
        evaluate: () => {
          calls += 1;
          return { score: 3, value: null };
        },
      });
      expect(result.best).toBeNull();
      expect(result.evaluations).toBe(maxEvaluations);
    }
    expect(calls).toBe(30);
  });
});
