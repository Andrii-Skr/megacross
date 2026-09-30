import type { Grid, Slot } from "../types";

export function isCrosswordTemplate(grid: Grid): boolean {
  return grid.templateTypeCode === "0" || grid.templateTypeCode === "<";
}

export function buildStartNumberByCell(slots: readonly Slot[]): Map<string, number> {
  const starts = new Map<string, { row: number; col: number }>();
  for (const slot of slots) {
    const key = `${slot.r},${slot.c}`;
    if (!starts.has(key)) starts.set(key, { row: slot.r, col: slot.c });
  }

  const ordered = [...starts.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  return new Map(ordered.map((start, index) => [`${start.row},${start.col}`, index + 1]));
}

export function buildCrosswordTextFiles(
  grid: Grid,
  slots: readonly Slot[],
  solved: readonly string[],
  definitions: ReadonlyMap<string, string>,
): { words: string; clues: string } | null {
  if (!isCrosswordTemplate(grid)) return null;

  const numberByCell = buildStartNumberByCell(slots);
  const entries = slots.map((slot) => {
    const word = slot.cells.map(([row, col]) => solved[row]?.[col] ?? "").join("");
    return {
      number: numberByCell.get(`${slot.r},${slot.c}`) ?? 0,
      direction: slot.dir.dr === 0 ? "right" : "down",
      word,
      clue: (definitions.get(word.toUpperCase()) ?? "").replace(/\s+/gu, " ").trim(),
    };
  });

  const format = (field: "word" | "clue") => {
    const section = (direction: "right" | "down", heading: string) => [
      heading,
      ...entries
        .filter((entry) => entry.direction === direction)
        .sort((a, b) => a.number - b.number)
        .map((entry) => `${entry.number}. ${entry[field]}`),
    ].join("\n");
    return `${section("right", "По горизонтали:")}\n\n${section("down", "По вертикали:")}\n`;
  };

  return { words: format("word"), clues: format("clue") };
}
