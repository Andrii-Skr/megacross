import { readFileSync } from "fs";
import { basename } from "path";
import { getGridSize } from "../config/templates";

export type CellChar = "*" | "#" | "⬇" | "➡" | "↘";
export type ColumnMajorGrid = string[]; // строка = один столбец

// ↓, →, ↘ – соответствие byte ⇒ символ
const DIR_TO_CHAR: Record<number, CellChar> = {
  // ↓
  0x01: "⬇", 0x02: "⬇", 0x03: "⬇", 0x04: "⬇", 0x05: "⬇", 0x06: "⬇",
  // ↘
  0x07: "↘", 0x0d: "↘", 0x19: "↘", 0x1a: "↘", 0x1c: "↘", 0x1d: "↘",
  0x29: "↘", 0x2b: "↘",
  // →
  0x08: "➡", 0x10: "➡", 0x18: "➡",0x20: "➡", 0x28: "➡", 0x30: "➡", 0x38: "➡",
};

/**
 * Сигнатура "SHABLON  2GO" в ASCII (0x53 0x48 ... 0x32 0x47 0x4F)
 * Последние 3 байта ("2GO") = ID шаблона.
 */
const SHABLON_MAGIC = Buffer.from("SHABLON  2GO", "ascii");
const MAGIC_LEN = "SHABLON  2".length + 1; // первые 10 байт до буквы G

export interface ParsedFsh {
  fileName: string;
  templateId: string;
  rows: number;
  cols: number;
  grid: ColumnMajorGrid; // column‑major
}

export function parseFshFile(fullPath: string): ParsedFsh {
  const buf = readFileSync(fullPath);

  // Найти начало подписи "SHABLON  2??"
  const shablonPos = buf.indexOf("SHABLON  ");
  if (shablonPos === -1) {
    throw new Error(`Файл ${fullPath}: подпись \"SHABLON  \" не найдена`);
  }

  // Шаблон ID – 3 байта после пробела: "2GO", "3XY" и т. п.
  const templateId = buf.toString("ascii", shablonPos + 9, shablonPos + 12);
  const { rows, cols } = getGridSize(templateId);

  // Смещаемся на конец подписи
  let i = shablonPos + 12;
  const cells: CellChar[] = [];

  while (cells.length < rows * cols) {
    const byte = buf[i++];
    switch (byte) {
      case 0x01:
        cells.push("*");
        break;
      case 0x02:
        cells.push("#");
        break;
      case 0x04: {
        const dirByte = buf[i++];
        const ch = DIR_TO_CHAR[dirByte];
        if (!ch) throw new Error(`Неизвестное направление 0x${dirByte.toString(16)}`);
        cells.push(ch);
        break;
      }
      default:
        throw new Error(`Неожиданный байт 0x${byte.toString(16)} в ${fullPath}`);
    }
  }

  // Преобразуем в column‑major массив строк
  const columns: ColumnMajorGrid = Array.from({ length: cols }, () => "");
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      columns[col] += cells[row * cols + col];
    }
  }

  return {
    fileName: basename(fullPath),
    templateId,
    rows,
    cols,
    grid: columns,
  };
}
