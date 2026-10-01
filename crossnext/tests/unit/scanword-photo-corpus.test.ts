import { readFileSync } from "node:fs";
import path from "node:path";
import { buildClueLayouts } from "@megacross/cross-clues";
import { parseFshBytes, scanSlotsDetailed } from "@megacross/cross-format";
import { describe, expect, it } from "vitest";
import { buildPhotoAreaBoundsBySlotId } from "@/lib/scanwordPhotoClues";

type ExpectedPhoto = readonly [slotId: number, minRow: number, minCol: number, maxRow: number, maxCol: number];
type TemplateCase = {
  name: string;
  group: "15x21" | "23x31";
  reason: string;
  photos: readonly ExpectedPhoto[];
  checkFilledLayout?: boolean;
};

// Coordinates are zero-based. Each fixture is an original FSH file, and the
// expected photo rectangles were checked against its 0x02 cell geometry.
const templates: TemplateCase[] = [
  { group: "15x21", name: "41683", reason: "no photo", photos: [] },
  { group: "15x21", name: "41686", reason: "paired clues without photos", photos: [] },
  {
    group: "15x21",
    name: "41687",
    reason: "two recognized 4x4 squares",
    photos: [
      [26, 8, 11, 11, 14],
      [27, 9, 1, 12, 4],
    ],
  },
  {
    group: "15x21",
    name: "41688",
    reason: "missed square at the top edge",
    checkFilledLayout: true,
    photos: [
      [9, 0, 6, 3, 9],
      [49, 17, 6, 20, 9],
    ],
  },
  {
    group: "15x21",
    name: "41689",
    reason: "missed square inside connected clues",
    checkFilledLayout: true,
    photos: [
      [24, 4, 4, 7, 7],
      [38, 13, 7, 16, 10],
    ],
  },
  {
    group: "15x21",
    name: "41690",
    reason: "paired clues beside two 4x4 photos",
    photos: [
      [17, 4, 7, 7, 10],
      [38, 13, 4, 16, 7],
    ],
  },
  {
    group: "15x21",
    name: "41692",
    reason: "missed square beside clue cells",
    checkFilledLayout: true,
    photos: [
      [24, 4, 6, 7, 9],
      [39, 13, 5, 16, 8],
    ],
  },
  {
    group: "15x21",
    name: "41700",
    reason: "two formerly missed squares",
    checkFilledLayout: true,
    photos: [
      [31, 9, 0, 12, 3],
      [36, 8, 11, 11, 14],
    ],
  },
  {
    group: "15x21",
    name: "41702",
    reason: "two formerly missed edge squares",
    checkFilledLayout: true,
    photos: [
      [13, 0, 11, 3, 14],
      [57, 17, 0, 20, 3],
    ],
  },
  {
    group: "15x21",
    name: "42040",
    reason: "4x5 and 4x4 rectangles",
    photos: [
      [23, 7, 0, 11, 3],
      [41, 10, 11, 13, 14],
    ],
  },
  {
    group: "15x21",
    name: "42902",
    reason: "4x4 and 5x4 rectangles",
    photos: [
      [34, 8, 11, 11, 14],
      [35, 9, 0, 12, 4],
    ],
  },
  {
    group: "23x31",
    name: "43994",
    reason: "three 5x5 squares",
    photos: [
      [7, 0, 18, 4, 22],
      [22, 0, 0, 4, 4],
      [144, 26, 0, 30, 4],
    ],
  },
  {
    group: "23x31",
    name: "44380",
    reason: "four 6x4 edge rectangles",
    photos: [
      [0, 0, 0, 3, 5],
      [6, 0, 17, 3, 22],
      [124, 27, 17, 30, 22],
      [134, 27, 0, 30, 5],
    ],
  },
  {
    group: "23x31",
    name: "44443",
    reason: "two 4x3 edge rectangles",
    photos: [
      [0, 0, 0, 2, 3],
      [143, 28, 19, 30, 22],
    ],
  },
  {
    group: "23x31",
    name: "44444",
    reason: "two 3x4 edge rectangles",
    photos: [
      [27, 0, 20, 3, 22],
      [148, 27, 0, 30, 2],
    ],
  },
  {
    group: "23x31",
    name: "44454",
    reason: "small 4x3 and large 7x9 areas",
    photos: [
      [57, 7, 4, 9, 7],
      [118, 11, 8, 19, 14],
    ],
  },
  {
    group: "23x31",
    name: "44639",
    reason: "two 4x4 squares in a larger grid",
    photos: [
      [15, 0, 10, 3, 13],
      [135, 27, 10, 30, 13],
    ],
  },
];

describe("legacy FSH photo-area corpus", () => {
  it.each(templates)("recognizes $group/$name: $reason", ({ group, name, photos, checkFilledLayout }) => {
    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "legacy-photo-areas", group, `${name}.fsh`);
    const grid = parseFshBytes(readFileSync(fixturePath));
    expect([grid.cols, grid.rows]).toEqual(group.split("x").map(Number));

    const slots = scanSlotsDetailed(grid).slots;
    const bounds = buildPhotoAreaBoundsBySlotId(grid, slots, grid.data, new Map());
    const actual = [...bounds]
      .map(([slotId, area]): ExpectedPhoto => [slotId, area.minRow, area.minCol, area.maxRow, area.maxCol])
      .sort((a, b) => a[0] - b[0]);
    expect(actual).toEqual([...photos].sort((a, b) => a[0] - b[0]));

    const layouts = buildClueLayouts(grid, slots, grid.data, new Map(), {
      expand02Area: true,
      anchorFromSlotIdsWhenNoDefinitions: true,
    });
    for (const [slotId, minRow, minCol, maxRow, maxCol] of photos) {
      expect(layouts.filter((layout) => layout.definitionSlotIds.includes(slotId))).toHaveLength(1);
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          expect([grid.data[row]?.[col], grid.codes[row]?.[col]]).toEqual(["#", 0x02]);
        }
      }
    }

    if (!checkFilledLayout) return;
    const solved = grid.data.map((row, rowIndex) =>
      [...row]
        .map((cell, colIndex) =>
          cell === "#" ? cell : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(rowIndex * 13 + colIndex * 7) % 26],
        )
        .join(""),
    );
    const definitions = new Map(
      slots.map((slot) => [
        slot.cells
          .map(([row, col]) => solved[row][col])
          .join("")
          .toUpperCase(),
        "definition",
      ]),
    );
    const filledLayouts = buildClueLayouts(grid, slots, solved, definitions, { expand02Area: true });
    for (const [slotId, minRow, minCol, maxRow, maxCol] of photos) {
      const layout = filledLayouts.find((item) => item.definitionSlotIds.includes(slotId));
      const cells = (layout?.clusterCells?.length ? layout.clusterCells : layout?.areaCells) ?? [];
      expect(cells.length).toBeGreaterThan(1);
      expect([
        Math.min(...cells.map(([row]) => row)),
        Math.min(...cells.map(([, col]) => col)),
        Math.max(...cells.map(([row]) => row)),
        Math.max(...cells.map(([, col]) => col)),
      ]).toEqual([minRow, minCol, maxRow, maxCol]);
    }
  });
});
