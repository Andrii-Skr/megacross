import { Grid, Slot, DIRS } from "../types";

const HEADER_SIZE = 0x40;
const HEADER_MAGIC = "CROSSWORD";
const HEADER_CONST_1 = 0x21030003;
const HEADER_CONST_2 = 0x35000000;

const ALPHABET_CP1251 = Buffer.from(
  "e0e1e2e3e4e5b8e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff",
  "hex"
);
const FOOTER = Buffer.from(
  "460000000000000000646464033030310031000a000000000000000000000000000009000000417269616c204379723100000000",
  "hex"
);

type CrwOptions = {
  dictPath?: string;
  templatePath?: string;
  lowerCaseWords?: boolean;
};

function encodeCp1251(input: string): Buffer {
  const bytes: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    if (code === 0x0401) { // Ё
      bytes.push(0xa8);
      continue;
    }
    if (code === 0x0451) { // ё
      bytes.push(0xb8);
      continue;
    }
    if (code >= 0x0410 && code <= 0x042f) { // А-Я
      bytes.push(code - 0x0410 + 0xc0);
      continue;
    }
    if (code >= 0x0430 && code <= 0x044f) { // а-я
      bytes.push(code - 0x0430 + 0xe0);
      continue;
    }
    if (code === 0x2116) { // №
      bytes.push(0xb9);
      continue;
    }
    throw new Error(`cp1251: unsupported char U+${code.toString(16).toUpperCase()}`);
  }
  return Buffer.from(bytes);
}

function encodeGridBlock(grid: Grid): Buffer {
  const marker = Buffer.from(grid.marker, "ascii");
  if (marker.length !== 3) {
    throw new Error(`bad marker length: ${marker.length}`);
  }
  const bytes: number[] = [];
  bytes.push(...marker);

  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      const ch = grid.data[row][col];
      if (ch === "*") {
        bytes.push(0x01);
      } else if (ch === "#") {
        bytes.push(0x02);
      } else {
        bytes.push(0x04, grid.codes[row][col]);
      }
    }
  }

  bytes.push(0x00, 0x00, 0x00, 0x00);
  return Buffer.from(bytes);
}

function coordChar(value: number): string {
  return String.fromCharCode(0x30 + value);
}

function buildLocString(slot: Slot, wordLen: number): string {
  const lenChar = coordChar(wordLen);
  const colChar = coordChar(slot.c);
  const rowChar = coordChar(slot.r);
  const dirChar = slot.dir === DIRS.right ? "6" : "2";
  const body = dirChar.repeat(wordLen - 1);
  return `${lenChar}${colChar}${rowChar}${body}1000`;
}

function buildWordBlock(slots: Slot[], solved: string[], lowerCase: boolean): Buffer {
  const dirOrder = (slot: Slot) => (slot.dir === DIRS.right ? 0 : 1);
  const ordered = [...slots].sort((a, b) => (
    a.r - b.r || a.c - b.c || dirOrder(a) - dirOrder(b)
  ));

  const chunks: Buffer[] = [];
  for (const slot of ordered) {
    const word = slot.cells.map(([r, c]) => solved[r][c]).join("");
    const finalWord = lowerCase ? word.toLowerCase() : word;
    const wordBuf = encodeCp1251(finalWord);
    const loc = buildLocString(slot, word.length);
    const locBuf = Buffer.from(loc, "ascii");

    const payloadLen = locBuf.length + 4 + wordBuf.length;
    const buf = Buffer.alloc(4 + payloadLen);
    buf.writeUInt32LE(payloadLen, 0);
    locBuf.copy(buf, 4);
    buf.writeUInt32LE(wordBuf.length, 4 + locBuf.length);
    wordBuf.copy(buf, 4 + locBuf.length + 4);
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

export function buildCrw(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  options: CrwOptions = {}
): Buffer {
  const dictPath = options.dictPath ?? "";
  const templatePath = options.templatePath ?? "";
  const lowerCase = options.lowerCaseWords ?? true;

  const dictPathBuf = encodeCp1251(dictPath);
  const templatePathBuf = encodeCp1251(templatePath);
  const gridBuf = encodeGridBlock(grid);
  const wordBuf = buildWordBlock(slots, solved, lowerCase);

  const header = Buffer.alloc(HEADER_SIZE);
  header.write(HEADER_MAGIC, 0, "ascii");
  header.write(grid.marker, 9, "ascii");
  header.writeUInt32LE(dictPathBuf.length, 0x0c);
  header.writeUInt32LE(gridBuf.length, 0x10);
  header.writeUInt32LE(wordBuf.length, 0x14);
  header.writeUInt32LE(templatePathBuf.length, 0x18);
  header.writeUInt32LE(HEADER_CONST_1, 0x1c);
  header.writeUInt32LE(HEADER_CONST_2, 0x20);

  return Buffer.concat([
    header,
    dictPathBuf,
    gridBuf,
    wordBuf,
    templatePathBuf,
    ALPHABET_CP1251,
    Buffer.from([0x00]),
    FOOTER,
  ]);
}
