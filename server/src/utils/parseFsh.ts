import { readFileSync } from "fs";
import { basename } from "path";
import { getGridSize } from "../config/templates";

export type Cell = "*" | "#" | "⬇" | "➡" | "↘";
export type Grid = Cell[][];          // [row][col] (row-major)

const DIR_TO_CELL: Record<number, Cell> = {
  0x01: "⬇", 0x02: "⬇", 0x03: "⬇", 0x04: "⬇", 0x05: "⬇", 0x06: "⬇",
  0x07: "↘", 0x0d: "↘", 0x19: "↘", 0x1a: "↘", 0x1c: "↘", 0x1d: "↘",
  0x29: "↘", 0x2b: "↘",
  0x08: "➡", 0x10: "➡", 0x18: "➡",0x20: "➡", 0x28: "➡", 0x30: "➡", 0x38: "➡",
};

export interface ParsedFsh {
  fileName: string;
  rows: number;
  cols: number;
  grid: Grid;
}

export function parseFsh(fullPath: string): ParsedFsh {
  const buf = readFileSync(fullPath);
  const magicPos = buf.indexOf("SHABLON  ");
  if (magicPos === -1) throw new Error(`${fullPath}: подписи SHABLON не найдено`);
  const tplId = buf.toString("ascii", magicPos + 9, magicPos + 12);
  const { rows, cols } = getGridSize(tplId);

  const cells: Cell[] = [];
  let i = magicPos + 12;
  while (cells.length < rows * cols) {
    const b = buf[i++];
    if (b === 0x01) cells.push("*");
    else if (b === 0x02) cells.push("#");
    else if (b === 0x04) {
      const dir = DIR_TO_CELL[buf[i++]!];
      if (!dir) throw new Error(`Неизвестное направление в ${fullPath}`);
      cells.push(dir);
    } else throw new Error(`Неожиданный байт 0x${b.toString(16)} в ${fullPath}`);
  }

  // row-major
  const grid: Grid = Array.from({ length: rows }, (_, r) =>
    cells.slice(r * cols, (r + 1) * cols) as Cell[]
  );

  return { fileName: basename(fullPath, ".fsh"), rows, cols, grid };
}
