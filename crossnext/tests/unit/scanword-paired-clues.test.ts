import { readFileSync } from "node:fs";
import path from "node:path";
import { buildClueLayouts, buildPhotoAreaBoundsBySlotId } from "@megacross/cross-clues";
import { type Grid, parseFshBytes, scanSlotsDetailed } from "@megacross/cross-format";
import { describe, expect, it } from "vitest";

const examples = [
  { name: "41686", horizontal: ["0,1", "16,4"], vertical: ["1,14"] },
  { name: "41687", horizontal: ["1,9", "8,6"], vertical: ["5,7"] },
  { name: "41688", horizontal: ["13,0", "13,2"], vertical: ["11,0"] },
  { name: "41689", horizontal: ["0,10", "13,1"], vertical: ["1,2"] },
  { name: "41690", horizontal: ["14,9", "14,12"], vertical: ["9,11"] },
] as const;

describe("paired scanword definitions", () => {
  it.each([
    {
      direction: "horizontal",
      data: ["##→*", "↓↓##", "**##", "**##"],
      codes: [
        [2, 2, 0x18, 1],
        [1, 1, 2, 2],
        [1, 1, 2, 2],
        [1, 1, 2, 2],
      ],
      solved: ["##AB", "CF##", "DG##", "EH##"],
      doubleKey: "0,1",
      doubleCell: [0, 1],
    },
    {
      direction: "vertical",
      data: ["#→**", "#→**", "↓###", "*###"],
      codes: [
        [2, 0x18, 1, 1],
        [2, 0x18, 1, 1],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
      ],
      solved: ["#CDE", "#FGH", "A###", "B###"],
      doubleKey: "1,0",
      doubleCell: [1, 0],
    },
  ])("keeps neighboring single and double clues separate in a $direction pair", (example) => {
    const grid: Grid = {
      rows: 4,
      cols: 4,
      data: example.data,
      codes: example.codes,
      marker: "",
      templateType: "scanword",
    };
    const slots = scanSlotsDetailed(grid).slots;
    for (const filled of [false, true]) {
      const layouts = buildClueLayouts(
        grid,
        slots,
        filled ? example.solved : grid.data,
        filled
          ? new Map([
              ["AB", "Первая"],
              ["CDE", "Вторая"],
              ["FGH", "Третья"],
            ])
          : new Map(),
        { anchorFromSlotIdsWhenNoDefinitions: true },
      );
      expect(layouts).toHaveLength(2);
      const single = layouts.find((layout) => layout.key === "0,0");
      const double = layouts.find((layout) => layout.key === example.doubleKey);
      expect(single?.slotIds).toHaveLength(1);
      expect(single?.areaCells).toEqual([[0, 0]]);
      expect(single?.areaKind).toBeUndefined();
      expect(double?.slotIds).toHaveLength(2);
      expect(double?.areaCells).toEqual([example.doubleCell]);
      expect(double?.areaKind).toBeUndefined();
    }
  });

  it.each(examples)("pairs clues in legacy template $name without touching photos", ({
    name,
    horizontal,
    vertical,
  }) => {
    const file = path.join(process.cwd(), "tests", "fixtures", "legacy-photo-areas", "15x21", `${name}.fsh`);
    const grid = parseFshBytes(readFileSync(file));
    const slots = scanSlotsDetailed(grid).slots;
    const layouts = buildClueLayouts(grid, slots, grid.data, new Map(), {
      anchorFromSlotIdsWhenNoDefinitions: true,
    });
    const byKey = new Map(layouts.map((layout) => [layout.key, layout]));
    const photos = [...buildPhotoAreaBoundsBySlotId(grid, slots, grid.data, new Map()).values()];
    const used = new Set<string>();

    for (const layout of layouts.filter((item) => item.areaKind === "paired")) {
      expect(layout.areaCells).toHaveLength(2);
      expect(layout.slotIds).toHaveLength(1);
      const [[firstRow, firstCol], [secondRow, secondCol]] = layout.areaCells;
      expect(Math.abs(firstRow - secondRow) + Math.abs(firstCol - secondCol)).toBe(1);
      for (const [row, col] of layout.areaCells) {
        const key = `${row},${col}`;
        expect(grid.data[row]?.[col]).toBe("#");
        expect(grid.codes[row]?.[col]).toBe(0x02);
        expect(used.has(key)).toBe(false);
        expect(
          photos.some(
            (photo) => row >= photo.minRow && row <= photo.maxRow && col >= photo.minCol && col <= photo.maxCol,
          ),
        ).toBe(false);
        used.add(key);
      }
      expect(layout.areaCells.filter(([row, col]) => byKey.has(`${row},${col}`))).toHaveLength(1);
    }

    for (const key of horizontal) {
      const layout = byKey.get(key);
      expect(layout?.areaKind).toBe("paired");
      expect(layout?.areaCells[0]?.[0]).toBe(layout?.areaCells[1]?.[0]);
    }
    for (const key of vertical) {
      const layout = byKey.get(key);
      expect(layout?.areaKind).toBe("paired");
      expect(layout?.areaCells[0]?.[1]).toBe(layout?.areaCells[1]?.[1]);
    }
    if (name === "41688") {
      expect(byKey.get("13,0")?.areaCells).toEqual([
        [13, 0],
        [13, 1],
      ]);
      expect(byKey.get("13,2")?.areaCells).toEqual([
        [13, 2],
        [13, 3],
      ]);
    }
  });

  it.each([3, 4])("keeps a %ix%i photo separate from an attached two-cell clue", (size) => {
    const data =
      size === 3
        ? ["###**", "####*", "####*", "*↓*↓*", "*****"]
        : ["####**", "####**", "#####*", "#####*", "*↓**↓*", "******"];
    const codes = data.map((row) => Array.from(row, (cell) => (cell === "#" ? 0x02 : 0x01)));
    const grid: Grid = {
      rows: data.length,
      cols: data[0]?.length ?? 0,
      data,
      codes,
      marker: "",
      templateType: "scanword",
    };
    const slots = scanSlotsDetailed(grid).slots;
    const photoBounds = buildPhotoAreaBoundsBySlotId(grid, slots, grid.data, new Map());
    expect([...photoBounds]).toEqual([[0, { minRow: 0, minCol: 0, maxRow: size - 1, maxCol: size - 1 }]]);

    const solved =
      size === 3
        ? ["###AA", "####A", "####A", "*A*B*", "*C*D*"]
        : ["####AA", "####AA", "#####A", "#####A", "*A**B*", "*C**D*"];
    const layouts = buildClueLayouts(
      grid,
      slots,
      solved,
      new Map([
        ["AC", "Фото"],
        ["BD", "Текст"],
      ]),
    );
    const photo = layouts.find((layout) => layout.definitionSlotIds.includes(0));
    const pair = layouts.find((layout) => layout.definitionSlotIds.includes(1));
    expect(photo?.areaCells).toHaveLength(size * size);
    expect(pair?.areaKind).toBe("paired");
    expect(pair?.areaCells).toHaveLength(2);
    expect(pair?.areaCells.every(([, col]) => col === size)).toBe(true);
    expect(photo?.areaCells.some(([row, col]) => pair?.areaCells.some(([r, c]) => r === row && c === col))).toBe(false);
  });
});
