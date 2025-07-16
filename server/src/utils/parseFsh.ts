// grid[col][row]      ← column-major 31 × 23

import { readFileSync } from "fs";
import { basename } from "path";
import { getGridSize } from "../config/templates";

export type Cell = "*" | "#" | "⬇" | "➡" | "↘";
export type ColumnGrid = Cell[][];           // grid[col][row]

export interface ParsedFsh {
  fileName: string;
  rows:     number;   // 23
  cols:     number;   // 31
  grid:     ColumnGrid;   // column-major
}

/* код-направление → символ */
const DIR: Record<number, Cell> = {
  0x01:"⬇",0x02:"⬇",0x03:"⬇",0x04:"⬇",0x05:"⬇",0x06:"⬇",
  0x07:"↘",0x0d:"↘",0x19:"↘",0x1a:"↘",0x1c:"↘",0x1d:"↘",0x29:"↘",0x2b:"↘",
  0x08:"➡",0x10:"➡",0x18:"➡",0x20:"➡",0x28:"➡",0x30:"➡",0x38:"➡",
};

export function parseFsh(fullPath: string): ParsedFsh {
  const buf = readFileSync(fullPath);

  /* 1. «SHABLON  » */
  const sig = buf.indexOf("SHABLON  ");
  if (sig === -1) throw new Error(`${fullPath}: подпись SHABLON не найдена`);

  /* 2. размеры 23×31 по ID шаблона */
  const tplId = buf.toString("ascii", sig + 9, sig + 12);
  const { rows, cols } = getGridSize(tplId);
  const need = rows * cols;

  /* 3. первый байт 01 / 02 / 04 */
  let i = sig + 12;
  while (i < buf.length && ![0x01, 0x02, 0x04].includes(buf[i])) i++;
  if (i === buf.length) throw new Error(`${fullPath}: начало сетки не найдено`);

  /* 4. читаем ячейки */
  const cells: Cell[] = [];
  while (cells.length < need && i < buf.length) {
    const b = buf[i++];
    if (b === 0x01) cells.push("*");
    else if (b === 0x02) cells.push("#");
    else if (b === 0x04) {
      const d = buf[i++]!;
      const cell = DIR[d];
      if (!cell) throw new Error(`неизв. код 0x${d.toString(16)} в ${fullPath}`);
      cells.push(cell);
    } else break;                      // хвост/паддинг
  }
  if (cells.length !== need)
    throw new Error(`${fullPath}: ожидалось ${need}, получено ${cells.length}`);

  /* 5. column-major grid[col][row] */
  const grid: ColumnGrid = Array.from({ length: cols }, () =>
    Array<Cell>(rows)
  );

  let idx = 0;
  for (let r = 0; r < rows; r++)
  for (let c = 0; c < cols; c++)          // ← порядок как в файле
      grid[c][r] = cells[idx++];

  return { fileName: basename(fullPath, ".fsh"), rows, cols, grid };
}
