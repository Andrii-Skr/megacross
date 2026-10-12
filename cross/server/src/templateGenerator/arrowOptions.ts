import { CLUE_MAP, CLUE_POSITION_OFFSETS } from "@megacross/cross-format";
import type { Grid } from "../types";

// Compile once, retaining the format table's exact code/entry ordering.
const options = Object.entries(CLUE_MAP).map(([code, entries]) => ({
  code: Number(code),
  directions: entries.map((entry) => entry.dirKey),
  offsets: entries.map((entry) => CLUE_POSITION_OFFSETS[entry.cluePos] ?? [0, 0]),
}));

export function arrowOptions(directions: readonly number[]) {
  const key = [...new Set(directions)].sort((a, b) => a - b).join(",");
  return indexed.get(key) ?? [];
}

const indexed = new Map<string, typeof options>();
for (const option of options) {
  const key = [...new Set(option.directions)].sort((a, b) => a - b).join(",");
  const list = indexed.get(key) ?? [];
  list.push(option);
  indexed.set(key, list);
}

export function firstArrowCode(grid: Pick<Grid, "data">, row: number, col: number, directions: readonly number[]): number | null {
  for (const option of arrowOptions(directions)) {
    if (option.offsets.every(([dr, dc]) => grid.data[row + dr]?.[col + dc] === "#")) return option.code;
  }
  return null;
}
