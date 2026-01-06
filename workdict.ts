#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import iconv from "iconv-lite";

const DEFAULT_ALPHABET = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const ALPHABETS = [
  DEFAULT_ALPHABET,
  "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя",
];

// Формат как в твоём примере
const HEADER_SIZE = 0x100;
const ALPHABET_OFFSET = 0x100;
const VERSION = 3;          // пишется как 0x0300 (version << 8)
const UNK_WORD = 0x50bd;     // метка маски (BD50)
const MASK_FLAG = 0x0007;    // метка маски (0700)
const MAX_LEN = 48;

// ---------- utils ----------
function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function readFile(p: string): Buffer {
  return fs.readFileSync(p);
}

function writeFile(p: string, data: Buffer) {
  fs.writeFileSync(p, data);
}

function countTailCRLF(buf: Buffer): number {
  let count = 0;
  for (let i = buf.length; i >= 2; i -= 2) {
    if (buf[i - 2] === 0x0d && buf[i - 1] === 0x0a) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function decodeText(buf: Buffer): { text: string; encoding: "utf8" | "cp1251" } {
  const utf8 = buf.toString("utf8");
  if (Buffer.from(utf8, "utf8").equals(buf)) {
    const text = utf8.startsWith("\ufeff") ? utf8.slice(1) : utf8;
    return { text, encoding: "utf8" };
  }
  return { text: iconv.decode(buf, "cp1251"), encoding: "cp1251" };
}

function onlyCRLF(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    if (b !== 0x0d && b !== 0x0a) return false;
  }
  return true;
}

function isMetaBlock(buf: Buffer, pos: number): boolean {
  if (pos + 13 > buf.length) return false;
  const lenPlus = buf[pos]!;
  if (lenPlus < 9 || lenPlus > 9 + MAX_LEN) return false;
  if (buf[pos + 1] !== 0 || buf[pos + 2] !== 0 || buf[pos + 3] !== 0 || buf[pos + 4] !== 0) {
    return false;
  }
  if (buf[pos + 9] !== 0 || buf[pos + 10] !== 0 || buf[pos + 11] !== 0 || buf[pos + 12] !== 0) {
    return false;
  }
  const mid = buf.readUInt32LE(pos + 5);
  if (mid % 2 !== 0) return false;
  return true;
}

function parseArgs(argv: string[]) {
  const args = {
    cmd: argv[2] ?? "",
    input: argv[3] ?? "",
    output: argv[4] ?? "",
    alphabetFrom: "" as string | "",
    headerFrom: "" as string | "",
  };

  for (let i = 5; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--alphabetFrom") {
      args.alphabetFrom = argv[i + 1] ?? "";
      i++;
    } else if (a === "--headerFrom") {
      args.headerFrom = argv[i + 1] ?? "";
      i++;
    } else if (a.startsWith("--alphabetFrom=")) {
      args.alphabetFrom = a.split("=", 2)[1] ?? "";
    } else if (a.startsWith("--headerFrom=")) {
      args.headerFrom = a.split("=", 2)[1] ?? "";
    }
  }

  return args;
}

// ---------- TXT handling ----------
function readTxtWords(txtPath: string): string[] {
  const raw = fs.readFileSync(txtPath);
  const { text } = decodeText(raw);

  const words: string[] = [];
  for (const line0 of text.split(/\r?\n/)) {
    let line = line0.trim();
    if (!line) continue;

    // формат "слово /" -> берём часть до "/"
    const slash = line.indexOf("/");
    if (slash !== -1) line = line.slice(0, slash).trim();
    if (!line) continue;

    words.push(line.toLowerCase());
  }

  // dedupe
  return Array.from(new Set(words));
}

function sortWords(words: string[], alphabet: string): string[] {
  const order = new Map<string, number>();
  for (let idx = 0; idx < alphabet.length; idx++) {
    order.set(alphabet.charAt(idx), idx);
  }

  function key(w: string): { len: number; seq: number[] } {
    const seq: number[] = [];
    for (let i = 0; i < w.length; i++) {
      const ch = w.charAt(i);
      seq.push(order.get(ch) ?? 1_000_000_000);
    }
    return { len: w.length, seq };
  }

  return [...words].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka.len !== kb.len) return ka.len - kb.len;

    const n = Math.max(ka.seq.length, kb.seq.length);
    for (let i = 0; i < n; i++) {
      const va = ka.seq[i] ?? -1;
      const vb = kb.seq[i] ?? -1;
      if (va !== vb) return va - vb;
    }
    return 0;
  });
}

function detectAlphabet(words: string[], alphabets: string[]) {
  const lettersSet = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    for (let j = 0; j < w.length; j++) {
      lettersSet.add(w.charAt(j));
    }
  }
  const letters = Array.from(lettersSet);

  let bestAlphabet = alphabets[0] ?? DEFAULT_ALPHABET;
  let bestMissing: string[] = [];
  let bestMissingCount = Number.POSITIVE_INFINITY;

  for (let i = 0; i < alphabets.length; i++) {
    const alphabet = alphabets[i]!;
    const alphabetSet = new Set<string>();
    for (let j = 0; j < alphabet.length; j++) {
      alphabetSet.add(alphabet.charAt(j));
    }

    const missing: string[] = [];
    for (let j = 0; j < letters.length; j++) {
      const ch = letters[j]!;
      if (!alphabetSet.has(ch)) missing.push(ch);
    }

    if (
      missing.length < bestMissingCount ||
      (missing.length === bestMissingCount && alphabet.length < bestAlphabet.length)
    ) {
      bestAlphabet = alphabet;
      bestMissing = missing;
      bestMissingCount = missing.length;
    }
  }

  return { alphabet: bestAlphabet, missing: bestMissing };
}

// ---------- WorkDict read/write ----------
export function readWorkDict(binPath: string): { alphabet: string; words: string[] } {
  const b = readFile(binPath);
  if (b.length < HEADER_SIZE) die("Файл слишком маленький для WorkDict.");

  const sig = b.subarray(0, 8).toString("ascii");
  if (sig !== "WorkDict") die("Нет сигнатуры 'WorkDict' — не похоже на WorkDict.");

  const alphabetLen = b.readUInt16LE(10);
  let alphabetBytes: Buffer;
  let i = 0;
  if (alphabetLen > 0 && ALPHABET_OFFSET + alphabetLen <= b.length) {
    alphabetBytes = b.subarray(ALPHABET_OFFSET, ALPHABET_OFFSET + alphabetLen);
    i = ALPHABET_OFFSET + alphabetLen;
  } else {
    const term = b.indexOf(0x0d, ALPHABET_OFFSET); // 0x0D завершает алфавит (fallback)
    if (term === -1) die("Не найден конец алфавита (0x0D) после 0x100.");
    alphabetBytes = b.subarray(ALPHABET_OFFSET, term);
    i = term + 1;
  }
  const alphabet = iconv.decode(alphabetBytes, "cp1251");
  if (i < b.length && b[i] === 0x0d) i++;

  // в примере после алфавита идут нули (обычно 12, но пропустим любые)
  while (i < b.length && b[i] === 0x00) i++;

  const words: string[] = [];

  while (i < b.length) {
    const rest = b.subarray(i);
    if (onlyCRLF(rest)) break;

    while (isMetaBlock(b, i)) {
      i += 13;
      if (i >= b.length) break;
    }
    if (i >= b.length) break;
    if (onlyCRLF(b.subarray(i))) break;

    const j = b.indexOf(Buffer.from([0x0d, 0x0a]), i); // \r\n
    if (j === -1) break;

    const wBytes = b.subarray(i, j);
    if (wBytes.length === 0) break;

    const w = iconv.decode(wBytes, "cp1251");
    words.push(w);
    i = j + 2; // после \r\n
  }

  return { alphabet, words };
}

type WorkDictHeader = {
  versionRaw: number;
  unk: number;
  maskFlag: number;
  maxLen: number;
};

function readWorkDictHeader(binPath: string): { header: WorkDictHeader; tailCRLFCount: number } {
  const b = readFile(binPath);
  if (b.length < HEADER_SIZE) die("Файл слишком маленький для WorkDict.");
  const sig = b.subarray(0, 8).toString("ascii");
  if (sig !== "WorkDict") die("Нет сигнатуры 'WorkDict' — не похоже на WorkDict.");

  const header: WorkDictHeader = {
    versionRaw: b.readUInt16LE(8),
    unk: b.readUInt16LE(14),
    maskFlag: b.readUInt16LE(16),
    maxLen: b.readUInt16LE(22),
  };
  const tailCRLFCount = countTailCRLF(b);

  return { header, tailCRLFCount };
}

export function writeWorkDict(
  wordsInput: string[],
  outPath: string,
  alphabet: string,
  opts?: { header?: WorkDictHeader; tailCRLFCount?: number }
) {
  const words = sortWords(wordsInput, alphabet);

  // Заголовок 0x100
  const header = Buffer.alloc(HEADER_SIZE, 0);
  header.write("WorkDict", 0, "ascii");

  // поля как в примере
  header.writeUInt16LE(opts?.header?.versionRaw ?? (VERSION << 8), 8);
  header.writeUInt16LE(alphabet.length, 10);
  header.writeUInt16LE(opts?.header?.unk ?? UNK_WORD, 14);
  header.writeUInt16LE(opts?.header?.maskFlag ?? MASK_FLAG, 16);
  header.writeUInt16LE(opts?.header?.maxLen ?? MAX_LEN, 22);

  const chunks: Buffer[] = [];
  chunks.push(header);

  // алфавитный блок: alphabet(cp1251)
  const alphabetBuf = iconv.encode(alphabet, "cp1251");
  chunks.push(alphabetBuf);

  // метаданные + слова
  for (let idx = 0; idx < words.length; idx++) {
    const w = words[idx]!;
    const lenPlus = w.length + 9;
    const one = Buffer.from([lenPlus]);
    const meta = Buffer.alloc(12);
    meta.writeUInt32LE(0, 0);
    meta.writeUInt32LE(2 * idx, 4);
    meta.writeUInt32LE(0, 8);
    chunks.push(one, meta);
    chunks.push(iconv.encode(w, "cp1251"));
    chunks.push(Buffer.from([0x0d, 0x0a])); // \r\n
  }

  // хвост: как в оригинале обычно words.length + 1 строк
  const tailCount = opts?.tailCRLFCount ?? (words.length + 1);
  chunks.push(Buffer.from("\r\n".repeat(tailCount), "ascii"));

  writeFile(outPath, Buffer.concat(chunks));
}

// ---------- commands ----------
function cmdToTxt(binPath: string, outTxt: string): number {
  const { words, alphabet } = readWorkDict(binPath);
  const sorted = sortWords(words, alphabet);
  // сохраняем как cp1251, строки "слово /"
  const text = sorted.map((w) => `${w} / \r\n`).join("");
  writeFile(outTxt, iconv.encode(text, "cp1251"));
  return sorted.length;
}

function cmdFromTxt(
  txtPath: string,
  outBin: string,
  alphabetFrom?: string,
  headerFrom?: string
): number {
  const words = readTxtWords(txtPath);

  let alphabet = DEFAULT_ALPHABET;
  let header: WorkDictHeader | undefined;
  let tailCRLFCount: number | undefined;
  if (alphabetFrom) {
    alphabet = readWorkDict(alphabetFrom).alphabet;
  } else {
    const detected = detectAlphabet(words, ALPHABETS);
    alphabet = detected.alphabet;
    if (detected.missing.length > 0) {
      console.warn(
        "Предупреждение: часть символов не найдена в известных алфавитах:",
        detected.missing.join("")
      );
    }
  }

  const headerSource = headerFrom || alphabetFrom;
  if (headerSource) {
    const meta = readWorkDictHeader(headerSource);
    header = meta.header;
    tailCRLFCount = meta.tailCRLFCount;
  }

  writeWorkDict(words, outBin, alphabet, { header, tailCRLFCount });
  return words.length;
}

function cmdCompare(originalTxt: string, convertedTxt: string) {
  function readWordsAny(p: string) {
    const b = readFile(p);
    if (b.length >= 8 && b.subarray(0, 8).toString("ascii") === "WorkDict") {
      return readWorkDict(p).words;
    }
    return readTxtWords(p);
  }

  const original = readWordsAny(originalTxt);
  const converted = readWordsAny(convertedTxt);
  const originalSet = new Set(original);
  const convertedSet = new Set(converted);

  const missing: string[] = [];
  for (let i = 0; i < original.length; i++) {
    const w = original[i]!;
    if (!convertedSet.has(w)) missing.push(w);
  }

  const extra: string[] = [];
  for (let i = 0; i < converted.length; i++) {
    const w = converted[i]!;
    if (!originalSet.has(w)) extra.push(w);
  }

  return {
    originalCount: originalSet.size,
    convertedCount: convertedSet.size,
    missing,
    extra,
  };
}

// ---------- main ----------
(function main() {
  const args = parseArgs(process.argv);

  if (!args.cmd || !args.input || !args.output) {
    die(
      [
        "Использование:",
        "  tsx workdict.ts toTxt <inputWorkDict> <outputTxt>",
        "  tsx workdict.ts fromTxt <inputTxt> <outputWorkDict> [--alphabetFrom <existingWorkDict>] [--headerFrom <existingWorkDict>]",
        "  tsx workdict.ts compare <originalTxt> <convertedTxt|workDict>",
      ].join("\n")
    );
  }

  const cmd = args.cmd.toLowerCase();
  if (cmd === "totxt") {
    const count = cmdToTxt(args.input, args.output);
    console.log("OK:", cmd, "=>", path.resolve(args.output));
    console.log("Слов:", count);
  } else if (cmd === "fromtxt") {
    const count = cmdFromTxt(
      args.input,
      args.output,
      args.alphabetFrom || undefined,
      args.headerFrom || undefined
    );
    console.log("OK:", cmd, "=>", path.resolve(args.output));
    console.log("Слов:", count);
  } else if (cmd === "compare") {
    const res = cmdCompare(args.input, args.output);
    console.log(
      "OK:",
      cmd,
      "=>",
      path.resolve(args.input),
      "vs",
      path.resolve(args.output)
    );
    console.log("Оригинал:", res.originalCount);
    console.log("Сконвертировано:", res.convertedCount);
    console.log("Нет в сконвертированном:", res.missing.length);
    if (res.missing.length > 0) {
      console.log("Примеры:", res.missing.slice(0, 10).join(", "));
    }
    console.log("Лишние в сконвертированном:", res.extra.length);
    if (res.extra.length > 0) {
      console.log("Примеры:", res.extra.slice(0, 10).join(", "));
    }
  } else {
    die("Неизвестная команда. Используй: toTxt | fromTxt | compare");
  }
})();
