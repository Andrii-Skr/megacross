import { buildFsh, type Grid, markerFor, parseFshBytes, scanSlotsDetailed } from "@megacross/cross-format";
import { describe, expect, it } from "vitest";

describe("cross format v2", () => {
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
