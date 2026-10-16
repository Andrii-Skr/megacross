import { describe, expect, it } from "vitest";
import { type ClueGroup, matchClueGroups } from "../../../cross/server/src/templateGenerator/clueMatching";
import { geometryDistance, isDiverseGeometry } from "../../../cross/server/src/templateGenerator/diversity";
import {
  buildMask,
  geometryFingerprint,
  MASK_FAMILIES,
  SeededRandom,
  verifyTemplateInvariants,
} from "../../../cross/server/src/templateGenerator/generator";
import { evaluateTemplateQuality } from "../../../cross/server/src/templateGenerator/quality";
import type { Grid } from "../../../cross/server/src/types";

const option = (...resources: string[]) => ({ code: 1, resources });
function covered(groups: readonly ClueGroup[], selected: ReturnType<typeof matchClueGroups>["selected"]) {
  const resources = [...selected.values()].flatMap((o) => o.resources);
  expect(new Set(resources).size).toBe(resources.length);
  for (const [group, chosen] of selected) expect(groups.includes(group) && group.options.includes(chosen)).toBe(true);
  return resources.length;
}
function bruteForce(groups: ClueGroup[], index = 0, used = new Set<string>()): number {
  if (index === groups.length) return used.size;
  let best = bruteForce(groups, index + 1, used);
  for (const o of groups[index].options)
    if (o.resources.every((r) => !used.has(r))) {
      best = Math.max(best, bruteForce(groups, index + 1, new Set([...used, ...o.resources])));
    }
  return best;
}

describe("clue conflict search", () => {
  it("reconsiders a double choice that blocks otherwise matchable singles", () => {
    const groups = [
      { directions: [6, 8], options: [option("a", "b"), option("c", "d")] },
      { directions: [6], options: [option("a")] },
      { directions: [8], options: [option("b")] },
    ];
    const result = matchClueGroups(groups);
    expect(result.exhaustive).toBe(true);
    expect(covered(groups, result.selected)).toBe(4);
    expect(result.selected.get(groups[0])?.resources).toEqual(["c", "d"]);
    const bounded = matchClueGroups(groups, 0);
    expect(bounded.exhaustive).toBe(false);
    expect(bounded.choices).toBe(0);
    expect(covered(groups, bounded.selected)).toBe(2);
  });

  it("agrees with exhaustive enumeration on 400 seeded single/double conflict graphs", () => {
    const rng = new SeededRandom("clue-maximum-parity");
    for (let trial = 0; trial < 400; trial += 1) {
      const groups: ClueGroup[] = Array.from({ length: 1 + rng.int(6) }, () => {
        const double = rng.next() < 0.5;
        return {
          directions: double ? [6, 8] : [6],
          options: Array.from({ length: rng.int(4) }, () => {
            const a = rng.int(6);
            const b = (a + 1 + rng.int(5)) % 6;
            return double ? option(String(a), String(b)) : option(String(a));
          }),
        };
      });
      const result = matchClueGroups(groups);
      expect(result.exhaustive).toBe(true);
      expect(covered(groups, result.selected)).toBe(bruteForce(groups));
      const full = matchClueGroups(groups, 100_000, true);
      expect(full.selected.size === groups.length).toBe(
        bruteForce(groups) === groups.reduce((sum, g) => sum + g.directions.length, 0),
      );
    }
  });
});

describe("template diversity", () => {
  it("rejects near copies even when canonical orientation changes", () => {
    const rows = Array.from({ length: 20 }, (_, r) =>
      Array.from({ length: 20 }, (_, c) => ((r + 2 * c) % 7 === 0 ? "#" : "*")).join(""),
    );
    const original = rows.join("/");
    const changed = [...rows];
    changed[10] = `${changed[10].slice(0, 10)}${changed[10][10] === "#" ? "*" : "#"}${changed[10].slice(11)}`;
    const reflected = changed
      .map((r) => [...r].reverse().join(""))
      .reverse()
      .join("/");
    expect(geometryDistance(original, reflected)).toBeGreaterThan(0);
    expect(isDiverseGeometry(reflected, [original])).toBe(false);
    expect(geometryDistance(original, rows.map((r) => [...r].reverse().join("")).join("/"))).toBe(0);
    expect(
      isDiverseGeometry(rows.map((r) => [...r].map((c) => (c === "#" ? "*" : "#")).join("")).join("/"), [original]),
    ).toBe(true);
    expect(geometryDistance(original, "#*#/*#*")).toBe(1);
  });

  it("does not call different arrow codes different geometry", () => {
    const grid = {
      rows: 2,
      cols: 3,
      data: ["#→*", "*↓#"],
      codes: [
        [0, 24, 0],
        [0, 25, 0],
      ],
    };
    expect(geometryFingerprint(grid)).toBe(geometryFingerprint({ ...grid, data: ["#↓*", "*→#"] }));
  });

  it("produces reproducible distinct mask families while preserving photos and cutouts", () => {
    const request = {
      rows: 30,
      cols: 30,
      resultCount: 1,
      pictures: { mode: "auto" as const, count: 3 },
      cutoutPresetId: "corner" as const,
      seed: "mask-families",
    };
    const masks = MASK_FAMILIES.map((family) => {
      const first = buildMask(request, new SeededRandom(request.seed), undefined, family);
      expect(first).not.toBeNull();
      expect(first).toEqual(buildMask(request, new SeededRandom(request.seed), undefined, family));
      if (!first) throw new Error("mask family did not produce a fixture");
      return first;
    });
    expect(new Set(masks.map((m) => m.mask.map((row) => row.join("")).join("/"))).size).toBe(3);
    for (const mask of masks) {
      expect(mask.pictures).toEqual(masks[0].pictures);
      mask.mask.forEach((row, r) => {
        row.forEach((cell, c) => {
          expect(cell === "%").toBe(masks[0].mask[r][c] === "%");
        });
      });
      for (const p of mask.pictures)
        for (let r = p.row; r < p.row + p.height; r += 1)
          for (let c = p.col; c < p.col + p.width; c += 1) expect(mask.mask[r][c]).toBe("#");
    }
  });
});

describe("shared geometry quality", () => {
  function quality(data: string[]) {
    const grid: Grid = { rows: data.length, cols: data[0].length, data, codes: data.map((r) => [...r].map(() => 0)) };
    return evaluateTemplateQuality(grid, [], verifyTemplateInvariants(grid));
  }
  it("penalizes spatial concentration relative to available quadrant areas", () => {
    const balanced = quality([
      "#***#***",
      "********",
      "********",
      "********",
      "#***#***",
      "********",
      "********",
      "********",
    ]);
    const concentrated = quality([
      "#*#*****",
      "********",
      "#*#*****",
      "********",
      "********",
      "********",
      "********",
      "********",
    ]);
    expect(balanced.spatialImbalance).toBe(0);
    expect(concentrated.spatialImbalance).toBeGreaterThan(0.5);
    expect(concentrated.qualityScore).toBeGreaterThan(balanced.qualityScore);
  });
  it("detects diagonal repetition above background clue density", () => {
    const periodic = quality(
      Array.from({ length: 20 }, (_, r) =>
        Array.from({ length: 20 }, (_, c) => ((r + 2 * c) % 5 === 0 ? "#" : "*")).join(""),
      ),
    );
    const rng = new SeededRandom("non-periodic");
    const irregular = quality(
      Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => (rng.next() < 0.2 ? "#" : "*")).join("")),
    );
    expect(periodic.repetition).toBeGreaterThan(0.9);
    expect(irregular.repetition).toBeLessThan(0.4);
  });

  it("counts single-crossing bridges in the word graph", () => {
    const grid: Grid = {
      rows: 5,
      cols: 5,
      data: ["#↓###", "→***#", "#*###", "#*###", "#####"],
      codes: [
        [0, 0x19, 0, 0, 0],
        [0x18, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    };
    const report = verifyTemplateInvariants(grid);
    expect(report.slotCount).toBe(2);
    expect(evaluateTemplateQuality(grid, [], report).bottleneckShare).toBe(1);
  });

  it("scores the photo centroid separately from ordinary clue density", () => {
    const grid: Grid = {
      rows: 12,
      cols: 12,
      data: Array(12).fill("************"),
      codes: Array.from({ length: 12 }, () => Array(12).fill(0)),
    };
    const report = verifyTemplateInvariants(grid);
    const centered = evaluateTemplateQuality(grid, [{ row: 4, col: 4, width: 4, height: 4 }], report);
    const corner = evaluateTemplateQuality(grid, [{ row: 0, col: 0, width: 4, height: 4 }], report);
    expect(centered.pictureImbalance).toBe(0);
    expect(corner.pictureImbalance).toBeGreaterThan(0.5);
    expect(corner.qualityScore).toBeGreaterThan(centered.qualityScore);
  });
});
