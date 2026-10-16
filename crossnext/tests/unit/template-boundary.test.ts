import { DIRS, type Slot } from "@megacross/cross-format";
import { describe, expect, it } from "vitest";
import { boundaryDirectionMetrics, boundaryPattern } from "../../../cross/server/src/templateGenerator/boundary";
import { verifyClueOwnership } from "../../../cross/server/src/templateGenerator/clueMatcher";
import {
  generateStructuralCandidate,
  SeededRandom,
  verifyTemplateInvariants,
} from "../../../cross/server/src/templateGenerator/generator";
import { calculateLengthWeights, DEFAULT_DICTIONARY_COUNTS } from "../../../cross/server/src/templateGenerator/weights";
import type { Grid } from "../../../cross/server/src/types";

const emptyGrid = (rows = 15, cols = 15): Grid => ({
  rows,
  cols,
  data: Array(rows).fill("*".repeat(cols)),
  codes: Array.from({ length: rows }, () => Array(cols).fill(0)),
});
const start = (r: number, c: number, dir: Slot["dir"]): Slot => ({
  id: r * 100 + c,
  r,
  c,
  dir,
  len: 3,
  cells: [
    [r, c],
    [r + dir.dr, c + dir.dc],
    [r + 2 * dir.dr, c + 2 * dir.dc],
  ],
});

describe("mixed top and left boundaries", () => {
  it("samples reproducible non-periodic borders with room for parallel words", () => {
    const patterns = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const run = () => {
        const rng = new SeededRandom(`boundary-${seed}`);
        return boundaryPattern(31, rng, () => 3 + rng.int(5)).join("");
      };
      const pattern = run();
      expect(pattern).toBe(run());
      expect(pattern).toHaveLength(31);
      expect(pattern).toContain("***");
      expect(pattern).not.toMatch(/^(#\*)+[#*]?$/u);
      patterns.add(pattern);
    }
    expect(patterns.size).toBeGreaterThan(30);
    expect(boundaryPattern(5, new SeededRandom("small-edge"), () => 5)).toHaveLength(5);
  });

  it("detects all-inward edges and rewards starts in both directions", () => {
    const grid = emptyGrid();
    const inward = [start(0, 2, DIRS.down), start(0, 4, DIRS.down), start(2, 0, DIRS.right), start(4, 0, DIRS.right)];
    const old = boundaryDirectionMetrics(grid, [], inward);
    const mixed = boundaryDirectionMetrics(grid, [], [...inward, start(0, 6, DIRS.right), start(6, 0, DIRS.down)]);
    expect(old.edgeDirectionDeficit).toBe(2);
    expect(old.edgeDirectionPenalty).toBe(1);
    expect(mixed.edgeDirectionDeficit).toBe(0);
    expect(mixed.edgeDirectionPenalty).toBe(0);
    expect(mixed.top).toMatchObject({ along: 1, inward: 2 });
    expect(mixed.left).toMatchObject({ along: 1, inward: 2 });
  });

  it("exempts short boundary fragments and obstructed crossing collars", () => {
    expect(boundaryDirectionMetrics(emptyGrid(7, 7), []).edgeDirectionDeficit).toBe(0);
    const grid = emptyGrid();
    grid.data[0] = "%%%%%%%********";
    grid.data[1] = "**************%";
    grid.data[2] = "**************%";
    grid.data[7] = "%**************";
    const result = boundaryDirectionMetrics(grid, []);
    expect(result.top.eligible).toBe(false);
    expect(result.left.eligible).toBe(false);
    expect(result.edgeDirectionDeficit).toBe(0);
    const photo = boundaryDirectionMetrics(emptyGrid(), [{ row: 1, col: 0, width: 15, height: 4 }]);
    expect(photo.top.eligible).toBe(false);
  });

  it("publishes mixed outer starts with intact topology and unique clue ownership", () => {
    const request = {
      rows: 15,
      cols: 11,
      resultCount: 1,
      pictures: { mode: "auto" as const, count: 0 },
      cutoutPresetId: "none" as const,
      seed: "profile-15-11",
    };
    const candidate = generateStructuralCandidate(
      request,
      new SeededRandom(request.seed),
      new Set(),
      18,
      calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS),
      { dictionaryCounts: DEFAULT_DICTIONARY_COUNTS },
    );
    if (!candidate) throw new Error("boundary regression fixture was not generated");
    expect(verifyTemplateInvariants(candidate.grid).valid).toBe(true);
    expect(verifyClueOwnership(candidate.grid, [])).toEqual([]);
    const edges = boundaryDirectionMetrics(candidate.grid, []);
    expect(edges.top.eligible && edges.left.eligible).toBe(true);
    expect(edges.top.along).toBeGreaterThan(0);
    expect(edges.top.inward).toBeGreaterThan(0);
    expect(edges.left.along).toBeGreaterThan(0);
    expect(edges.left.inward).toBeGreaterThan(0);
  });
});
