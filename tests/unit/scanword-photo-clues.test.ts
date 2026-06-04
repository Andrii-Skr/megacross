import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPhotoAreaBoundsBySlotId } from "@/lib/scanwordPhotoClues";
import { scanSlotsDetailed } from "@/utils/cross/grid";
import { parseFshBytes } from "@/utils/cross/parseFsh";
import { DIRS, type Grid, type Slot } from "@/utils/cross/types";

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

describe("buildPhotoAreaBoundsBySlotId", () => {
  it("marks only the anchor slot for an attached tail cluster", () => {
    const data = ["#####*", "#####*", "#####*", "#####*", "*↓#↓**", "*******"];
    const codes = createCodes(6, 6, 0x01);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        codes[row][col] = 0x02;
      }
    }
    codes[4][2] = 0x02;
    codes[4][3] = 0x03;
    const grid = buildGrid(data, codes);

    const slots: Slot[] = [
      {
        id: 1,
        r: 4,
        c: 1,
        dir: DIRS.down,
        len: 2,
        cells: [
          [4, 1],
          [5, 1],
        ],
      },
      {
        id: 2,
        r: 4,
        c: 3,
        dir: DIRS.down,
        len: 2,
        cells: [
          [4, 3],
          [5, 3],
        ],
      },
    ];
    const solved = ["#####*", "#####*", "#####*", "#####*", "*A#B**", "*C*D**"];
    const definitions = new Map<string, string>([
      ["AC", "Большая область"],
      ["BD", "Хвост"],
    ]);

    const photoBoundsBySlotId = buildPhotoAreaBoundsBySlotId(grid, slots, solved, definitions);

    expect(photoBoundsBySlotId.get(1)).toEqual({
      minRow: 0,
      minCol: 0,
      maxRow: 3,
      maxCol: 4,
    });
    expect(photoBoundsBySlotId.has(2)).toBe(false);
  });

  it("marks only slot (5,3) for sample 20.fsh even before definitions are filled", () => {
    const grid = parseFshBytes(readFileSync("../cross/server/sample/01/20.fsh"));
    const scan = scanSlotsDetailed(grid);

    const photoBoundsBySlotId = buildPhotoAreaBoundsBySlotId(grid, scan.slots, grid.data, new Map());

    expect(photoBoundsBySlotId.get(13)).toEqual({
      minRow: 0,
      minCol: 0,
      maxRow: 3,
      maxCol: 3,
    });
    expect(photoBoundsBySlotId.has(12)).toBe(false);
  });
});
