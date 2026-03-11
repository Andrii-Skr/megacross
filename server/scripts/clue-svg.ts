import Hypher from "hypher";
import ru from "hyphenation.ru";
import { ClueEntry } from "../src/utils/clues";
import { COREL_UNITS_PER_MM } from "./svg-theme";

type ClueCell = {
  dir: "down" | "right";
  text: string;
};

export const MIN_CLUE_FONT_SIZE = 7;
const MIN_CLUE_FONT_SIZE_PT = 7;
const MM_PER_PT = 25.4 / 72;
const MIN_COREL_CLUE_FONT_SIZE =
  Math.round(MIN_CLUE_FONT_SIZE_PT * MM_PER_PT * COREL_UNITS_PER_MM * 1000) / 1000;
const CLUE_MAX_LINES = 4;
const CLUE_TARGET_CHARS_PER_LINE = 8;
const CLUE_CHAR_WIDTH_FACTOR = 0.56;
const CLUE_TEXT_CONDENSE_RATIO = 0.88;
const CLUE_CONDENSE_TRIGGER_RATIO = 0.96;
const CLUE_LINE_HEIGHT_FACTOR = 1.0;
const CLUE_MIN_LINE_HEIGHT_FACTOR = 0.85;

export function resolveMinClueFontSize(mode: "default" | "corel"): number {
  return mode === "corel" ? MIN_COREL_CLUE_FONT_SIZE : MIN_CLUE_FONT_SIZE;
}

function buildCondensedTextAttrs(line: string, fontSize: number, availableWidth: number): string {
  if (!line || availableWidth <= 0) return "";
  const estimatedWidth = Math.max(1, line.length * fontSize * CLUE_CHAR_WIDTH_FACTOR);
  if (line.length < CLUE_TARGET_CHARS_PER_LINE) return "";
  if (estimatedWidth < availableWidth * CLUE_CONDENSE_TRIGGER_RATIO) return "";
  const condensedWidth = Math.min(availableWidth, estimatedWidth * CLUE_TEXT_CONDENSE_RATIO);
  const textLength = Math.round(condensedWidth * 1000) / 1000;
  return ` textLength="${textLength}" lengthAdjust="spacingAndGlyphs"`;
}

function resolveLineHeight(fontSize: number, innerHeight: number): number {
  const rawLineHeight = fontSize * CLUE_LINE_HEIGHT_FACTOR;
  const targetLineHeightForMaxLines = innerHeight / CLUE_MAX_LINES;
  const minLineHeight = fontSize * CLUE_MIN_LINE_HEIGHT_FACTOR;
  return Math.max(minLineHeight, Math.min(rawLineHeight, targetLineHeightForMaxLines));
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const hypher = new Hypher(ru);

function splitLongWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const parts: string[] = [];
  let i = 0;
  while (word.length - i > maxChars) {
    let take = maxChars;
    const remaining = word.length - (i + take);
    if (remaining > 0 && remaining < 3 && take > 3) {
      take -= 3 - remaining;
    }
    parts.push(word.slice(i, i + take));
    i += take;
  }
  if (i < word.length) parts.push(word.slice(i));
  return parts;
}

function splitWordWithHyphenation(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  if (maxChars < 2) return splitLongWord(word, maxChars);
  const parts = hypher.hyphenate(word);
  if (parts.length <= 1) return splitLongWord(word, maxChars);

  const breaks: number[] = [];
  let offset = 0;
  for (let i = 0; i < parts.length - 1; i += 1) {
    offset += parts[i]?.length ?? 0;
    if (offset > 0) breaks.push(offset);
  }

  const lines: string[] = [];
  let start = 0;
  while (word.length - start > maxChars) {
    const limit = maxChars - 1;
    let breakPos = -1;
    for (const pos of breaks) {
      if (pos > start && pos - start <= limit) {
        breakPos = pos;
      }
    }
    if (breakPos === -1) {
      lines.push(...splitLongWord(word.slice(start), maxChars));
      return lines;
    }
    lines.push(`${word.slice(start, breakPos)}-`);
    start = breakPos;
  }
  if (start < word.length) lines.push(word.slice(start));
  return lines;
}

function splitWord(word: string, maxChars: number, breakWords: boolean): string[] {
  if (word.length <= maxChars) return [word];
  if (!breakWords) return [word];
  return splitWordWithHyphenation(word, maxChars);
}

function wrapText(text: string, maxChars: number, breakWords: boolean): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      if (word.length > maxChars) {
        lines.push(...splitWord(word, maxChars, breakWords));
        continue;
      }
      line = word;
      continue;
    }

    if (line.length + 1 + word.length <= maxChars) {
      line = `${line} ${word}`;
      continue;
    }

    lines.push(line);
    if (word.length > maxChars) {
      lines.push(...splitWord(word, maxChars, breakWords));
      line = "";
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export function buildClueTextMap(
  entries: ClueEntry[]
): Map<string, string> {
  const map = new Map<string, ClueCell[]>();
  for (const entry of entries) {
    const text = entry.text.trim();
    if (!text) continue;
    const key = `${entry.clueR},${entry.clueC}`;
    const list = map.get(key) ?? [];
    list.push({ dir: entry.dir, text });
    map.set(key, list);
  }

  const out = new Map<string, string>();
  for (const [key, list] of map) {
    list.sort((a, b) => (a.dir === "right" ? 0 : 1) - (b.dir === "right" ? 0 : 1));
    out.set(key, list.map((item) => item.text).join(" / "));
  }
  return out;
}

export function renderClueText(
  x: number,
  y: number,
  cell: number,
  fontSize: number,
  text: string,
  clipId: string,
  fill = "#000",
  options: { mode?: "default" | "corel" } = {}
): { defs: string; text: string } {
  const mode = options.mode ?? "default";
  const padding = 1;
  const normalized = text.replace(/\s+/g, " ").trim();
  const softMinFloor = resolveMinClueFontSize(mode);
  const baseSoftMin = Math.max(softMinFloor, Math.floor(cell * 0.12));
  const softMinFontSize = normalized.length <= 30
    ? Math.max(softMinFloor, Math.floor(cell * 0.1))
    : baseSoftMin;
  const innerHeight = cell - padding * 2;
  let currentSize = Math.max(fontSize, softMinFontSize);
  let lineHeight = resolveLineHeight(currentSize, innerHeight);
  let maxChars = Math.max(1, Math.floor((cell - padding * 2) / (currentSize * CLUE_CHAR_WIDTH_FACTOR)));
  let maxLinesByHeight = Math.max(1, Math.floor((innerHeight + 0.0001) / lineHeight));
  let maxLines = Math.min(CLUE_MAX_LINES, maxLinesByHeight);
  const words = normalized ? normalized.split(" ") : [];
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  let breakWords = false;
  let lines = wrapText(normalized, maxChars, breakWords);

  const recalcLayout = () => {
    lineHeight = resolveLineHeight(currentSize, innerHeight);
    maxChars = Math.max(1, Math.floor((cell - padding * 2) / (currentSize * CLUE_CHAR_WIDTH_FACTOR)));
    maxLinesByHeight = Math.max(1, Math.floor((innerHeight + 0.0001) / lineHeight));
    maxLines = Math.min(CLUE_MAX_LINES, maxLinesByHeight);
    lines = wrapText(normalized, maxChars, breakWords);
  };

  const shrinkUntil = (targetSize: number) => {
    while (
      (lines.length > maxLines ||
        maxChars < CLUE_TARGET_CHARS_PER_LINE ||
        (!breakWords && longestWord > maxChars)) &&
      currentSize > targetSize
    ) {
      currentSize -= 1;
      recalcLayout();
    }
  };

  shrinkUntil(softMinFontSize);

  if (!breakWords && longestWord > maxChars) {
    breakWords = true;
    recalcLayout();
    shrinkUntil(softMinFontSize);
  }

  if (lines.length > maxLines) {
    shrinkUntil(softMinFontSize);
  }

  if (!breakWords && longestWord > maxChars && currentSize > softMinFontSize) {
    breakWords = true;
    recalcLayout();
    shrinkUntil(softMinFontSize);
  }

  if (lines.length > maxLines && breakWords) {
    shrinkUntil(softMinFontSize);
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    if (last.length > 3 && maxChars > 3) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 3))}...`;
    }
  }

  const textBlockHeight = lineHeight * Math.max(1, lines.length);
  const offsetY = Math.max(0, (innerHeight - textBlockHeight) / 2);
  const textX = x + cell / 2;
  const textY = y + padding + offsetY;

  const useClip = mode !== "corel";
  const defs = useClip
    ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${cell}" height="${cell}"/></clipPath>`
    : "";

  if (mode === "corel") {
    const ascent = Math.round(currentSize * 0.8 * 10) / 10;
    const baseY = Math.round((textY + ascent) * 10) / 10;
    const textLines = lines
      .map((line, idx) => {
        const lineY = Math.round((baseY + idx * lineHeight) * 10) / 10;
        const condenseAttrs = buildCondensedTextAttrs(line, currentSize, cell - padding * 2);
        return `<text x="${textX}" y="${lineY}" font-size="${currentSize}" text-anchor="middle" dominant-baseline="alphabetic"${condenseAttrs} fill="${fill}">${escapeXml(line)}</text>`;
      })
      .join("");
    const textSvg = useClip
      ? `<g clip-path="url(#${clipId})">${textLines}</g>`
      : `<g>${textLines}</g>`;
    return { defs, text: textSvg };
  }

  const tspan = lines
    .map((line, idx) => {
      const dy = idx === 0 ? 0 : lineHeight;
      const condenseAttrs = buildCondensedTextAttrs(line, currentSize, cell - padding * 2);
      return `<tspan x="${textX}" dy="${dy}"${condenseAttrs}>${escapeXml(line)}</tspan>`;
    })
    .join("");
  const textSvg = `<text x="${textX}" y="${textY}" font-size="${currentSize}" text-anchor="middle" dominant-baseline="hanging"${useClip ? ` clip-path="url(#${clipId})"` : ""} fill="${fill}">${tspan}</text>`;

  return { defs, text: textSvg };
}
