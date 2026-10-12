import { CLUE_MAP, findArrowCode } from "@megacross/cross-format";
import { describe, expect, it } from "vitest";
import { firstArrowCode } from "../../../cross/server/src/templateGenerator/arrowOptions";
import {
  assignArrows,
  maximalRuns,
  SeededRandom,
  verifyTemplateInvariants,
} from "../../../cross/server/src/templateGenerator/generator";
import { type MaskRun, MaskRunIndex, selectConnectedRuns } from "../../../cross/server/src/templateGenerator/topology";
import type { Cell } from "../../../cross/server/src/types";

function referenceRuns(mask: Cell[][], minLength: number): MaskRun[] {
  return [
    ...maximalRuns(mask, "right", minLength).map((run) => ({ ...run, direction: "right" as const })),
    ...maximalRuns(mask, "down", minLength).map((run) => ({ ...run, direction: "down" as const })),
  ];
}

// Independent string-map implementation of the former topology evaluation.
function referenceSelection(mask: Cell[][], input: MaskRun[]) {
  let short = 0;
  const runs = input.filter((run) => run.cells.length !== 2 || short++ === 0);
  const membership = new Map<string, number[]>();
  runs.forEach((run, id) => {
    for (const [r, c] of run.cells) {
      const key = `${r},${c}`;
      membership.set(key, [...(membership.get(key) ?? []), id]);
    }
  });
  const counts = runs.map(() => 0);
  for (const ids of membership.values()) if (ids.length > 1) for (const id of ids) counts[id] += 1;
  const eligible = new Set(counts.flatMap((count, id) => (count >= 2 ? [id] : [])));
  const graph = new Map([...eligible].map((id) => [id, new Set<number>()]));
  for (const ids of membership.values())
    for (const a of ids)
      for (const b of ids) {
        if (a !== b && eligible.has(a) && eligible.has(b)) graph.get(a)?.add(b);
      }
  const seen = new Set<number>();
  const components: number[][] = [];
  for (const root of eligible) {
    if (seen.has(root)) continue;
    const component = [root];
    seen.add(root);
    for (let i = 0; i < component.length; i += 1)
      for (const next of graph.get(component[i]) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          component.push(next);
        }
      }
    components.push(component);
  }
  const selected = new Set(components.sort((a, b) => b.length - a.length)[0] ?? []);
  if (!selected.size) return null;
  for (let r = 0; r < mask.length; r += 1)
    for (let c = 0; c < mask[0].length; c += 1) {
      if (mask[r][c] !== "#" && mask[r][c] !== "%" && !membership.get(`${r},${c}`)?.some((id) => selected.has(id)))
        return null;
    }
  let intersections = 0;
  const actualCounts = runs.map(() => 0);
  for (const ids of membership.values()) {
    const included = ids.filter((id) => selected.has(id));
    if (included.length < 2) continue;
    intersections += 1;
    included.forEach((id) => {
      actualCounts[id] += 1;
    });
  }
  return {
    runs: runs.filter((_, id) => selected.has(id)),
    intersections,
    intersectionSum: intersections * 2,
    valid: [...selected].every((id) => actualCounts[id] >= 2),
  };
}

describe("incremental template topology", () => {
  it("matches the full scanner through trial, rollback and committed paired flips", () => {
    const rng = new SeededRandom("incremental-topology");
    for (const minLength of [2, 3])
      for (const [rows, cols] of [
        [5, 7],
        [23, 31],
        [40, 40],
      ]) {
        const mask = Array.from({ length: rows }, () =>
          Array.from({ length: cols }, (): Cell => rng.pick(["#", "*", "*", "*", "%"])),
        );
        const index = new MaskRunIndex(mask, minLength);
        for (let step = 0; step < 80; step += 1) {
          expect(index.runs()).toEqual(referenceRuns(mask, minLength));
          const changed = [
            [rng.int(rows), rng.int(cols)],
            [rng.int(rows), rng.int(cols)],
          ] as const;
          const saved = changed.map(([r, c]) => mask[r][c]);
          changed.forEach(([r, c]) => {
            mask[r][c] = mask[r][c] === "#" ? "*" : "#";
          });
          expect(index.runs(changed)).toEqual(referenceRuns(mask, minLength));
          if (step % 2) index.commit(changed);
          else
            changed.forEach(([r, c], id) => {
              mask[r][c] = saved[id];
            });
        }
      }
  });

  it("agrees with the old component, coverage and crossing rules on seeded masks", () => {
    const rng = new SeededRandom("topology-parity");
    let valid = 0;
    for (let seed = 0; seed < 600; seed += 1) {
      const rows = 5 + rng.int(seed % 4 === 0 ? 7 : 16);
      const cols = 5 + rng.int(seed % 4 === 0 ? 7 : 16);
      const mask = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c): Cell => {
          if (seed % 4 === 0) return r === 0 || c === 0 ? "#" : "*";
          if (seed % 3 === 0) return r === 0 || c === 0 || (r + 2 * c) % 7 === 0 ? "#" : "*";
          return rng.next() < 0.2 ? "#" : "*";
        }),
      );
      const runs = referenceRuns(mask, seed % 2 ? 2 : 3);
      const selected = selectConnectedRuns(mask, runs);
      expect(selected).toEqual(referenceSelection(mask, runs));
      const grid = assignArrows(mask, seed % 2 ? 2 : 3);
      if (grid) {
        if (!selected) throw new Error("an arrow grid must have a selected component");
        const report = verifyTemplateInvariants(grid);
        expect(report.valid).toBe(selected?.valid);
        expect(report.intersections).toBe(selected?.intersections);
        expect(report.averageIntersections).toBe(selected.intersectionSum / selected.runs.length);
        valid += Number(report.valid);
      }
    }
    expect(valid).toBeGreaterThan(10);
  });

  it("keeps all supported single/double arrow choices identical to the format resolver", () => {
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    for (let bits = 0; bits < 256; bits += 1) {
      const mask = Array.from({ length: 3 }, () => Array<Cell>(3).fill("*"));
      offsets.forEach(([dr, dc], id) => {
        if (bits & (1 << id)) mask[1 + dr][1 + dc] = "#";
      });
      const grid = { rows: 3, cols: 3, data: mask.map((row) => row.join("")) };
      for (const directions of [["right"], ["down"], ["right", "down"]] as const) {
        const code = firstArrowCode(
          grid,
          1,
          1,
          directions.map((dir) => (dir === "right" ? 6 : 8)),
        );
        expect(code).toBe(findArrowCode(grid, 1, 1, directions));
        if (code !== null) expect(CLUE_MAP[code]).toHaveLength(directions.length);
      }
    }
  });
});
