#!/usr/bin/env tsx
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFsh } from "../src/utils/parseFsh";
import { scanSlots, scanSlotsDetailed } from "../src/utils/grid";
import type { Grid } from "../src/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLASSIC_ROWS = [
  "#********#*#********#",
  "*#*#*#*#*****#*#*#*#*",
  "*#*#*****#*#*****#*#*",
  "*****#*#*****#*#*****",
  "*#*#*****#*#*****#*#*",
  "*****##*******##*****",
  "#*#*****#*#*#*****#*#",
  "****###*******###****",
  "#*#*****#*#*#*****#*#",
  "*****##*******##*****",
  "*#*#*****#*#*****#*#*",
  "*****#*#*****#*#*****",
  "*#*#*****#*#*****#*#*",
  "*#*#*#*#*****#*#*#*#*",
  "#********#*#********#",
];

function buildClassicFixture(): Grid {
  const rows = CLASSIC_ROWS.length;
  const cols = CLASSIC_ROWS[0]?.length ?? 0;
  const codes = Array.from({ length: rows }, () => Array(cols).fill(0));
  return {
    rows,
    cols,
    data: CLASSIC_ROWS,
    marker: "0E?",
    codes,
  };
}

function testClassicMode(): void {
  const grid = buildClassicFixture();
  const detailed = scanSlotsDetailed(grid);

  assert.equal(detailed.mode, "classic");
  assert.equal(detailed.slots.length, 63);
  assert.equal(detailed.starts.length, 63);
  assert.equal(scanSlots(grid).length, 63);

  const first = detailed.starts[0];
  assert.ok(first);
  assert.equal(first.number, 1);
  assert.equal(first.r, 0);
  assert.equal(first.c, 1);
  assert.equal(first.dir, "right");

  const last = detailed.starts[detailed.starts.length - 1];
  assert.ok(last);
  assert.equal(last.number, 61);
  assert.equal(last.r, 14);
  assert.equal(last.c, 12);
  assert.equal(last.dir, "right");

  assert.equal(
    detailed.starts.some((item) => item.r === 0 && item.c === 12 && item.dir === "down"),
    true
  );
  assert.equal(
    detailed.starts.some((item) => item.r === 9 && item.c === 0 && item.dir === "down"),
    true
  );
}

function testArrowModeWithDiagonal(): void {
  const grid: Grid = {
    rows: 3,
    cols: 3,
    data: ["↘**", "*#*", "***"],
    marker: "000",
    codes: [
      [0x07, 0x01, 0x01],
      [0x01, 0x02, 0x01],
      [0x01, 0x01, 0x01],
    ],
  };

  const detailed = scanSlotsDetailed(grid);
  assert.equal(detailed.mode, "arrow");
  assert.equal(detailed.slots.length, 2);
  assert.equal(
    detailed.starts.some((item) => item.r === 0 && item.c === 0 && item.dir === "right"),
    true
  );
  assert.equal(
    detailed.starts.some((item) => item.r === 0 && item.c === 0 && item.dir === "down"),
    true
  );
}

function testArrowSampleSmoke(): void {
  const grid = parseFsh(path.join(__dirname, "..", "sample", "49.fsh"));
  const detailed = scanSlotsDetailed(grid);
  assert.equal(detailed.mode, "arrow");
  assert.equal(scanSlots(grid).length, 61);
  assert.equal(detailed.slots.length, 61);
}

function main(): void {
  testClassicMode();
  testArrowModeWithDiagonal();
  testArrowSampleSmoke();
  console.log("grid smoke checks passed");
}

main();
