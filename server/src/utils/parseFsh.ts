// src/parseFsh.ts
// -----------------------------------------------------------
import { readFileSync } from "node:fs";
import { Cell, Grid }  from "../types.js";

// первые 12 байт — ASCII «SHABLON␠␠»
const HEADER = Buffer.from("SHABLON  ", "ascii");

/* поддерживаемые маркеры => размеры сетки */
const TEMPLATE_MAP: Record<string, { cols: number; rows: number }> = {
  "2GO": { cols: 23, rows: 31 },   // 32 47 4F
  "2@G": { cols: 16, rows: 23 },   // 32 40 47
  "2PF": { cols: 32, rows: 22 },   // 32 50 46
  "2@?": { cols: 16, rows: 15 },   // 32 40 3F
  "2?;": { cols: 15, rows: 11 },   // 32 3F 3B
};

// ── вспом. таблицы для кода клеток ─────────────────────────
const down  = new Set([0x01,0x02,0x03,0x04,0x05,0x06]);
const right = new Set([0x08,0x10,0x18,0x20,0x28,0x30,0x38]);
const diag  = new Set([0x07,0x11,0x0d,0x19,0x1a,0x1c,0x1d,0x29,0x39,0x2a,0x2b]);

function readCell(buf: Buffer, i: number): [Cell, number] {
  const b = buf[i];
  if (b === 0x01) return ["*", i + 1];
  if (b === 0x02) return ["#", i + 1];

  if (b === 0x04) {
    const dir = buf[i + 1];
    if (down.has(dir))  return ["↓", i + 2];
    if (right.has(dir)) return ["→", i + 2];
    if (diag.has(dir))  return ["↘", i + 2];
    throw new Error(`unknown direction byte 0x${dir.toString(16)}`);
  }
  throw new Error(`unexpected byte 0x${b.toString(16)} at ${i}`);
}

/** Парсит .fsh → объект Grid {rows, cols, marker, data[]} */
export function parseFsh(path: string): Grid {
  const buf = readFileSync(path);

  /* 1. сигнатура «SHABLON␠␠» */
  if (!buf.subarray(0, HEADER.length).equals(HEADER)) {
    throw new Error("file is not SHABLON format");
  }

  /* 2. 3-байтовый маркер (позиции 10-12) */
  const marker = buf.subarray(HEADER.length, HEADER.length + 3).toString("ascii");
  const size   = TEMPLATE_MAP[marker];
  if (!size) {
    throw new Error(`unknown template marker "${marker}" — add it to TEMPLATE_MAP`);
  }
  const { cols: COLS, rows: ROWS } = size;

  /* 3. читаем клетки по-столбцам */
  let idx = HEADER.length + 3;
  const grid: Cell[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("*"));

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const [ch, next] = readCell(buf, idx);
      grid[row][col] = ch;
      idx = next;
    }
  }

  return { rows: ROWS, cols: COLS, marker, data: grid.map(r => r.join("")) };
}
