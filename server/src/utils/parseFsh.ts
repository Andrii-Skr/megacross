
/* поддерживаемые маркеры => размеры сетки */
// const TEMPLATE_MAP: Record<string, { cols: number; rows: number }> = {
//   "2GO": { cols: 23, rows: 31 },   // 32 47 4F
//   "2@G": { cols: 16, rows: 23 },   // 32 40 47
//   "2PF": { cols: 32, rows: 22 },   // 32 50 46
//   "2@?": { cols: 16, rows: 15 },   // 32 40 3F
//   "2?;": { cols: 15, rows: 11 },   // 32 3F 3B
// };

// // ── вспом. таблицы для кода клеток ─────────────────────────
// const down  = new Set([0x01,0x02,0x03,0x04,0x05,0x06]);
// const right = new Set([0x08,0x10,0x18,0x20,0x28,0x30,0x38]);
// const diag  = new Set([0x07,0x11,0x0d,0x19,0x1a,0x1c,0x1d,0x29,0x39,0x2a,0x2b]);

import { readFileSync } from "node:fs";
import { Cell, Grid }   from "../types";

// ── константы ───────────────────────────────────────────────
const HEADER = Buffer.from("SHABLON  ", "ascii");
// значения ниже читаются после байта 0x04 и не являются самостоятельными кодами
const down  = new Set([0x01,0x02,0x03,0x04,0x05,0x06,0x3d]);
const right = new Set([0x08,0x10,0x18,0x20,0x28,0x30,0x38]);
const diag  = new Set([0x07,0x11,0x13,0x15,0x0a,0x0b,0x0d,0x19,0x1a,0x1c,0x1d,0x29,0x39,0x2a,0x2b,0x2c]);

// ── helpers ────────────────────────────────────────────────
function readCell(buf: Buffer, i: number): [Cell, number, number] {
  const b = buf[i];
  if (b === 0x01) return ["*", i + 1, b];
  if (b === 0x02) return ["#", i + 1, b];

  if (b === 0x04) {
    const dir = buf[i + 1];
    if (down.has(dir))  return ["↓", i + 2, dir];
    if (right.has(dir)) return ["→", i + 2, dir];
    if (diag.has(dir))  return ["↘", i + 2, dir];
    throw new Error(`unknown direction byte 0x${dir.toString(16)}`);
  }
  throw new Error(`unexpected byte 0x${b.toString(16)} at ${i}`);
}

function dimsFromMarker(marker: Buffer) {
  // marker = [0x32, X, Y]  → cols = X-0x30, rows = Y-0x30
  const cols = marker[1] - 0x30;
  const rows = marker[2] - 0x30;
  if (cols <= 0 || rows <= 0) {
    throw new Error(
      `bad dimensions from marker ${marker.toString("hex")}: ${cols}×${rows}`
    );
  }
  return { cols, rows, marker: marker.toString("ascii") };
}

// ── main ───────────────────────────────────────────────────
export function parseFsh(path: string): Grid {
  const buf = readFileSync(path);

  // 1. сигнатура «SHABLON  »
  if (!buf.subarray(0, HEADER.length).equals(HEADER)) {
    throw new Error("file is not SHABLON format");
  }

  // 2. размеры из 3-байтного маркера
  const markerBuf = buf.subarray(HEADER.length, HEADER.length + 3);
  const { cols: COLS, rows: ROWS, marker } = dimsFromMarker(markerBuf);

  // 3. читаем клетки по столбцам
  let idx = HEADER.length + 3;
  const grid: Cell[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("*"));
  const codes: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const [ch, next, code] = readCell(buf, idx);
      grid[row][col] = ch;
      codes[row][col] = code;
      idx = next;
    }
  }

  return {
    rows: ROWS,
    cols: COLS,
    marker,
    data: grid.map(r => r.join("")),
    codes,
  };
}
