import { buildClueLayouts, buildPhotoAreaBoundsBySlotId } from "@megacross/cross-clues";
import { type Grid, scanSlotsDetailed } from "@megacross/cross-format";
import { describe, expect, it, vi } from "vitest";
import { buildAnswersOnlySvg } from "../../../cross/server/scripts/answer-only-svg";
import { buildCrosswordSvg } from "../../../cross/server/scripts/crossword-svg";
import { convertMmToCorelUnits } from "../../../cross/server/scripts/svg-theme";

vi.mock("../../../cross/server/scripts/svg-font-metrics", () => ({
  getBundledArimoFontResource: () => null,
  shouldUseBundledArimo: () => false,
  createFontTextWidthMeasure: () => undefined,
}));

describe("answer SVG cutouts", () => {
  it.each([false, true])("leaves photo regions empty when an image is selected: %s", (withPhoto) => {
    const data = ["###**", "####*", "####*", "*↓*↓*", "*****"];
    const grid: Grid = {
      rows: 5,
      cols: 5,
      marker: "",
      templateType: "scanword",
      data,
      codes: data.map((row) => Array.from(row, (cell) => (cell === "#" ? 2 : 1))),
    };
    const solved = ["###AA", "####A", "####A", "AAAAA", "AAAAA"];
    const slots = scanSlotsDetailed(grid).slots;
    const definitions = new Map(slots.map((slot) => [slot.cells.map(([r, c]) => solved[r][c]).join(""), "Clue"]));
    const layouts = buildClueLayouts(grid, slots, solved, definitions);
    const photoLayout = layouts.find((layout) => (layout.clusterCells?.length ?? 0) > 1 || layout.areaCells.length > 2);
    expect(photoLayout).toBeDefined();
    if (!photoLayout) throw new Error("Photo layout is missing");
    const photos = [...buildPhotoAreaBoundsBySlotId(grid, slots, solved, definitions).values()];
    expect(photos).toContainEqual({ minRow: 0, minCol: 0, maxRow: 2, maxCol: 2 });
    const ordinary = buildCrosswordSvg(grid, slots, solved, definitions, {
      style: "corel",
      arrowMode: "export",
      arrowScale: 0.8,
      templateCellSizeMm: 10,
      type0CellSizeMm: 10,
      photoClues: withPhoto ? [{ clueKey: photoLayout.key, href: "data:image/png;base64,AA==" }] : [],
    });
    expect(ordinary.svg.includes("<image ")).toBe(withPhoto);
    const svg = buildAnswersOnlySvg(grid, solved, 10, { familyName: "Test Font" }, { slots, definitions });
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    const cell = convertMmToCorelUnits(10);
    const rects = [...document.querySelectorAll("rect")];
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      // All cells in the 3x3 photo region must be absent, including strokes.
      expect(Number(rect.getAttribute("x")) < 3 * cell && Number(rect.getAttribute("y")) < 3 * cell).toBe(false);
    }
    expect(document.querySelector("image")).toBeNull();
    expect(document.querySelector("svg")?.getAttribute("font-family")).toBe("Test Font");
    expect(document.querySelectorAll("text")).toHaveLength(14);
    expect(rects.filter((rect) => rect.getAttribute("stroke") === "#000000")).toHaveLength(rects.length / 2);
    // The attached paired definition is not a photo cutout.
    expect(
      rects.some(
        (rect) =>
          Number(rect.getAttribute("x")) > 3 * cell &&
          Number(rect.getAttribute("y")) < 2 * cell &&
          rect.getAttribute("fill") === "#000000",
      ),
    ).toBe(true);
  });

  it("omits unanchored edge areas using the ordinary SVG geometry", () => {
    const grid: Grid = {
      rows: 2,
      cols: 4,
      marker: "",
      templateType: "scanword",
      data: ["####", "****"],
      codes: [
        [2, 2, 2, 2],
        [1, 1, 1, 1],
      ],
    };
    const svg = buildAnswersOnlySvg(grid, ["####", "АБВГ"], 10, undefined, { slots: [], definitions: new Map() });
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(document.querySelectorAll("rect")).toHaveLength(8);
    expect(
      [...document.querySelectorAll("rect")].every(
        (rect) => Number(rect.getAttribute("y")) > convertMmToCorelUnits(10),
      ),
    ).toBe(true);
    expect([...document.querySelectorAll("text")].map((element) => element.textContent)).toEqual(["А", "Б", "В", "Г"]);
  });

  it("omits cutouts while preserving black blocks, clue cells and letters", () => {
    const svg = buildAnswersOnlySvg(
      {
        rows: 1,
        cols: 4,
        marker: "S41",
        data: ["%#→*"],
        codes: [[0x25, 2, 0x18, 1]],
      },
      ["###А"],
      10,
    );
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    const rectangles = [...document.querySelectorAll("rect")];
    expect(rectangles).toHaveLength(6);
    expect(new Set(rectangles.map((rectangle) => rectangle.getAttribute("x"))).size).toBe(3);
    expect(rectangles.filter((rectangle) => rectangle.getAttribute("fill") === "#000000")).toHaveLength(1);
    expect([...document.querySelectorAll("text")].map((element) => element.textContent)).toEqual(["А"]);
  });
});
