import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";

/** ---------------------------
 * Template registry
 * ----------------------------
 * Maps ASCII codes found in the header (e.g. "2GO") → grid dimensions.
 * Extend the map when встретите новые типы шаблонов.
 */
const TEMPLATE_MAP: Record<string, { rows: number; cols: number }> = {
  /** «2GO» → 23 × 31 */
  "2GO": { rows: 23, cols: 31 },
  // Добавляйте новые сигнатуры ↓
  // "3GO": { rows: 31, cols: 39 },
};

/** Символьное представление ячеек */
enum CellChar {
  White = "*",
  Black = "#",
  Down = "⬇",
  Right = "➡",
  DownRight = "↘",
}

/** Байты‑направления для старт‑ячеек */
const DIR_TO_CHAR: Record<number, CellChar> = {
  // ↓
  0x01: CellChar.Down,
  0x02: CellChar.Down,
  0x03: CellChar.Down,
  0x04: CellChar.Down,
  0x05: CellChar.Down,
  0x06: CellChar.Down,
  // ↘
  0x07: CellChar.DownRight,
  0x0d: CellChar.DownRight,
  0x19: CellChar.DownRight,
  0x20: CellChar.DownRight,
  0x1a: CellChar.DownRight,
  0x1c: CellChar.DownRight,
  0x1d: CellChar.DownRight,
  0x29: CellChar.DownRight,
  0x2b: CellChar.DownRight,
  // →
  0x08: CellChar.Right,
  0x10: CellChar.Right,
  0x18: CellChar.Right,
  0x28: CellChar.Right,
  0x30: CellChar.Right,
  0x38: CellChar.Right,
} as const;

/** Полный результат разбора одного файла */
export interface ParsedCrossword {
  filename: string;
  rows: number;
  cols: number;
  /** column‑major: cols.length === cols, cols[i].length === rows */
  colsData: string[];
}

/** Обнаружить тип шаблона по заголовку */
function detectTemplate(buf: Buffer): { rows: number; cols: number } {
  // Находим ASCII‑подстроку, заканчивающуюся «GO» внутри первых 64 байт
  const headerStr = buf.subarray(0, 64).toString("ascii");
  for (const [sig, dims] of Object.entries(TEMPLATE_MAP)) {
    if (headerStr.includes(sig)) return dims;
  }
  throw new Error("Неизвестный тип шаблона (header signature not recognised)");
}

/** Пропустить заголовок и вернуть offset первой ячейки */
function findGridStart(buf: Buffer): number {
  // Ищем первый байт 0×01 | 0×02 | 0×04 после сигнатуры "GO"
  const idx = buf.findIndex((b, i) => {
    if (i < 12) return false; // первые 12 байт — «SHABLON  2GO» (фиксированная часть)
    return b === 0x01 || b === 0x02 || b === 0x04;
  });
  if (idx === -1) throw new Error("Grid payload not found");
  return idx;
}

/** Собственно разбор одного .fsh */
export function parseFsh(filePath: string): ParsedCrossword {
  const buf = readFileSync(filePath);

  // 1. Определяем размеры сетки
  const { rows, cols } = detectTemplate(buf);

  // 2. Находим начало массива ячеек
  const start = findGridStart(buf);

  // 3. Читаем ячейки
  const cells: CellChar[] = [];
  for (let i = start; cells.length < rows * cols; ) {
    const byte = buf[i++];
    if (byte === 0x01) {
      cells.push(CellChar.White);
    } else if (byte === 0x02) {
      cells.push(CellChar.Black);
    } else if (byte === 0x04) {
      const dir = buf[i++];
      const ch = DIR_TO_CHAR[dir];
      if (!ch) throw new Error(`Unknown direction 0x${dir.toString(16)} in ${filePath}`);
      cells.push(ch);
    } else {
      throw new Error(`Unexpected byte 0x${byte.toString(16)} at pos ${i - 1} in ${filePath}`);
    }
  }

  // 4. Перевод в column‑major
  const colsData: string[] = Array.from({ length: cols }, () => "");
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      colsData[c] += cells[r * cols + c];
    }
  }

  return { filename: filePath, rows, cols, colsData };
}

/**
 * Прочитать все .fsh файлы из указанной папки (по умолчанию «./sample»)
 * и вывести по 10 первых столбцов для каждого.
 */
export function loadSample(dir = join(__dirname, "sample")) {
  const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === ".fsh");
  if (!files.length) {
    console.warn(`В папке ${dir} нет .fsh файлов.`);
    return;
  }

  files.forEach((f) => {
    const abs = join(dir, f);
    const parsed = parseFsh(abs);
    console.log("\n======", f, `(${parsed.rows}×${parsed.cols})`, "======");
    console.log(parsed.colsData.slice(0, 10));
  });
}

/** --- CLI --- */
if (require.main === module) {
  const dirFromCli = process.argv[2];
  loadSample(dirFromCli ? join(process.cwd(), dirFromCli) : undefined);
}
