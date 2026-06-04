#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { buildClueEntries, buildClueLayouts } from "@megacross/cross-clues";
import { DIRS, type Grid, type Slot } from "../src/types";

function createCodes(rows: number, cols: number, value = 0x01): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(value));
}

function buildGrid(data: string[], codes: number[][]): Grid {
  return {
    rows: data.length,
    cols: data[0]?.length ?? 0,
    data,
    marker: "000",
    codes,
  };
}

function buildFixture(): { grid: Grid; slots: Slot[]; solved: string[]; definitions: Map<string, string> } {
  const data = ["##***", "#↓→**", "#****", "*****"];
  const codes = createCodes(4, 5, 0x01);
  codes[0][0] = 0x02;
  codes[0][1] = 0x02;
  codes[1][0] = 0x02;
  codes[2][0] = 0x02;
  codes[1][1] = 0x02;
  codes[1][2] = 0x10;
  const grid = buildGrid(data, codes);

  const slots: Slot[] = [
    {
      id: 1,
      r: 1,
      c: 1,
      dir: DIRS.down,
      len: 3,
      cells: [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    },
    {
      id: 2,
      r: 1,
      c: 2,
      dir: DIRS.right,
      len: 3,
      cells: [
        [1, 2],
        [1, 3],
        [1, 4],
      ],
    },
  ];

  return {
    grid,
    slots,
    solved: ["##AAA", "#CDEF", "#GAAA", "AHAAA"],
    definitions: new Map<string, string>([
      ["CGH", "Первое"],
      ["DEF", "Второе"],
    ]),
  };
}

function runBuildClueEntriesCompatibilitySmoke(): void {
  const { grid, slots, solved, definitions } = buildFixture();
  const entries = buildClueEntries(grid, slots, solved, definitions);
  assert.equal(entries.down.length, 1);
  assert.equal(entries.right.length, 1);
  assert.equal(entries.down[0]?.text, "Первое");
  assert.equal(entries.right[0]?.text, "Второе");
}

function runBuildClueLayoutsCompatibilitySmoke(): void {
  const { grid, slots, solved, definitions } = buildFixture();
  const layouts = buildClueLayouts(grid, slots, solved, definitions);
  assert.equal(layouts.length, 2);

  const first = layouts.find((layout) => layout.key === "0,0");
  const second = layouts.find((layout) => layout.key === "0,1");
  assert.ok(first, "layout 0,0 not found");
  assert.ok(second, "layout 0,1 not found");
  assert.equal(first.text, "Первое");
  assert.equal(second.text, "Второе");
}

function main(): void {
  runBuildClueEntriesCompatibilitySmoke();
  runBuildClueLayoutsCompatibilitySmoke();
  console.log("clue direction compatibility smoke checks passed");
}

main();
