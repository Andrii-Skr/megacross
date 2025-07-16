import { readFileSync } from "node:fs";
import { COLS, ROWS, Cell } from "../types";

const HEADER_BYTES = 12;
const down  = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
const right = new Set([0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38]);
const diag  = new Set([0x07, 0x0d, 0x19, 0x1a, 0x1c, 0x1d, 0x29, 0x2b]);

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

export function parseFsh(path: string): string[] {
  const buf = readFileSync(path);
  let idx   = HEADER_BYTES;

  const grid: Cell[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("*"));

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const [c, next] = readCell(buf, idx);
      grid[row][col] = c;
      idx = next;
    }
  }
  return grid.map(r => r.join(""));
}

export { validate } from "./grid";
