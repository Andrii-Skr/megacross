import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildFsh,
  type Grid,
  markerFor,
  parseFshBytes,
  SlotCoverageError,
  scanSlotsDetailed,
  validateSlotCoverage,
} from "@megacross/cross-format";
import { describe, expect, it } from "vitest";
import { buildEntries } from "../../cross/server/src/services/fillJobTemplateService";

describe("cross format v2", () => {
  it.each([1, 2] as const)("round-trips single-byte dimension boundaries in version %i", (version) => {
    for (const [rows, cols] of [
      [1, 79],
      [1, 80],
      [80, 1],
      [1, 207],
      [207, 1],
    ]) {
      const grid: Grid = {
        rows,
        cols,
        marker: markerFor(rows, cols, version),
        formatVersion: version,
        data: Array.from({ length: rows }, () => "*".repeat(cols)),
        codes: Array.from({ length: rows }, () => Array<number>(cols).fill(1)),
      };
      const bytes = buildFsh(grid);
      expect(bytes.slice(9, 12)).toEqual(new Uint8Array([version === 2 ? 0x53 : 0x32, 0x30 + cols, 0x30 + rows]));
      const parsed = parseFshBytes(bytes);
      expect(parsed.rows).toBe(rows);
      expect(parsed.cols).toBe(cols);
      expect(parsed.data).toEqual(grid.data);
    }
  });

  it("round-trips an SXY cutout and stops a slot at it", () => {
    const grid: Grid = {
      rows: 3,
      cols: 7,
      marker: markerFor(3, 7, 2),
      formatVersion: 2,
      data: ["#######", "#→**%**", "#######"],
      codes: [
        [2, 2, 2, 2, 2, 2, 2],
        [2, 0x18, 1, 1, 0x25, 1, 1],
        [2, 2, 2, 2, 2, 2, 2],
      ],
    };
    const bytes = buildFsh(grid);
    const parsed = parseFshBytes(bytes);
    expect(parsed.marker.startsWith("S")).toBe(true);
    expect(parsed.data[1][4]).toBe("%");
    expect(scanSlotsDetailed(parsed, { mode: "arrow", minLen: 3 }).slots[0]?.len).toBe(3);
  });

  it("rejects a cutout in legacy FSH", () => {
    const grid: Grid = { rows: 1, cols: 1, marker: markerFor(1, 1, 1), data: ["%"], codes: [[0x25]] };
    expect(() => buildFsh(grid)).toThrow(/legacy/u);
  });
});

describe("slot coverage validation", () => {
  it("rejects previously saved broken templates before starting a fill job", () => {
    const result = buildEntries([
      {
        key: "broken",
        name: "41985",
        sourceName: "41985.fsh",
        order: 0,
        path: path.resolve("tests/fixtures/41985-missing-arrow.fsh"),
      },
    ]);
    expect(result.entries).toEqual([]);
    expect(result.lengths).toEqual([]);
    expect(result.invalid).toEqual([
      { key: "broken", name: "41985", error: "Letter cells do not belong to any word: (1,13), (3,13)" },
    ]);
  });
  it("detects both uncovered cells in the original 41985 template", () => {
    const grid = parseFshBytes(readFileSync(path.resolve("tests/fixtures/41985-missing-arrow.fsh")));
    const slots = scanSlotsDetailed(grid).slots;
    try {
      validateSlotCoverage(grid, slots);
      expect.fail("Expected uncovered cells");
    } catch (error) {
      expect(error).toBeInstanceOf(SlotCoverageError);
      expect((error as SlotCoverageError).cells).toEqual([
        [0, 12],
        [2, 12],
      ]);
      expect((error as Error).message).toContain("(1,13), (3,13)");
    }
    grid.data[0] = `${grid.data[0].slice(0, 12)}↓${grid.data[0].slice(13)}`;
    grid.codes[0][12] = 0x03;
    expect(() => validateSlotCoverage(grid, scanSlotsDetailed(grid).slots)).not.toThrow();
  });

  it("accepts classic word runs, blocks and cutouts without arrows", () => {
    const grid: Grid = {
      rows: 1,
      cols: 7,
      marker: markerFor(1, 7),
      data: ["**#%***"],
      codes: [[1, 1, 2, 0x25, 1, 1, 1]],
    };
    expect(() => validateSlotCoverage(grid, scanSlotsDetailed(grid).slots)).not.toThrow();
  });

  it("rejects an isolated classic letter cell", () => {
    const grid: Grid = { rows: 1, cols: 4, marker: markerFor(1, 4), data: ["**#*"], codes: [[1, 1, 2, 1]] };
    expect(() => validateSlotCoverage(grid, scanSlotsDetailed(grid).slots)).toThrow("(1,4)");
  });
});
