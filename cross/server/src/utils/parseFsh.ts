
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
import { Cell, Grid, type TemplateType, type TemplateTypeCode } from "../types";

// ── константы ───────────────────────────────────────────────
const HEADER = Buffer.from("SHABLON  ", "ascii");
// значения ниже читаются после байта 0x04 и не являются самостоятельными кодами
//123
//456
//789
const down = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);

const right = new Set([0x08,0x10,0x18,0x20,0x28,0x30,0x38]);
const diag = new Set([0x07, 0x11, 0x13, 0x15, 0x0a, 0x0b, 0x0d, 0x19, 0x1a, 0x1c, 0x1d, 0x29, 0x21, 0x23, 0x39, 0x2a, 0x2b, 0x2c, 0x3d, 0x2f]);

const TEMPLATE_TYPES: Record<string, { type: TemplateType; supported: boolean }> = {
  "2": { type: "scanword", supported: true },
  "0": { type: "crossword", supported: true },
  "<": { type: "crossword_variant", supported: true },
  "3": { type: "chainword", supported: false },
  "9": { type: "honeycomb", supported: false },
  "F": { type: "circular", supported: false },
};

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

function resolveTemplateType(typeCode: string): {
  templateTypeCode: TemplateTypeCode;
  templateType: TemplateType;
  supported: boolean;
} {
  const resolved = TEMPLATE_TYPES[typeCode];
  if (!resolved) {
    return {
      templateTypeCode: typeCode,
      templateType: "unknown",
      supported: true,
    };
  }

  return {
    templateTypeCode: typeCode,
    templateType: resolved.type,
    supported: resolved.supported,
  };
}

function dimsFromMarker(marker: Buffer) {
  if (marker.length < 3) {
    throw new Error(`truncated marker: expected 3 bytes, got ${marker.length}`);
  }

  // marker = [Type, X, Y]  → cols = X-0x30, rows = Y-0x30
  const templateTypeCode = String.fromCharCode(marker[0]);
  const { templateType, supported } = resolveTemplateType(templateTypeCode);
  const cols = marker[1] - 0x30;
  const rows = marker[2] - 0x30;

  if (cols <= 0 || rows <= 0) {
    throw new Error(
      `bad dimensions from marker ${marker.toString("hex")}: ${cols}×${rows}`
    );
  }

  return {
    cols,
    rows,
    marker: marker.toString("ascii"),
    templateTypeCode,
    templateType,
    supported,
  };
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
  const {
    cols: COLS,
    rows: ROWS,
    marker,
    templateTypeCode,
    templateType,
    supported,
  } = dimsFromMarker(markerBuf);

  if (!supported) {
    throw new Error(`unsupported template type '${templateTypeCode}' in marker '${marker}'`);
  }

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
    templateTypeCode,
    templateType,
    data: grid.map(r => r.join("")),
    codes,
  };
}
