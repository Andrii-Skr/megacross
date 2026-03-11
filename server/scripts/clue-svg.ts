import Hypher from "hypher";
import ru from "hyphenation.ru";
import { ClueEntry } from "../src/utils/clues";

type ClueCell = {
  dir: "down" | "right";
  text: string;
};

const MIN_CLUE_FONT_SIZE = 8;

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
  const minFloor = MIN_CLUE_FONT_SIZE;
  const baseMin = Math.max(minFloor, Math.floor(cell * 0.12));
  const minFontSize = normalized.length <= 30
    ? Math.max(minFloor, Math.floor(cell * 0.1))
    : baseMin;
  let currentSize = Math.max(fontSize, minFontSize);
  let lineHeight = Math.round(currentSize * 1.0 * 10) / 10;
  let maxChars = Math.max(1, Math.floor((cell - padding * 2) / (currentSize * 0.6)));
  let maxLines = Math.max(1, Math.floor((cell - padding * 2) / lineHeight));
  const words = normalized ? normalized.split(" ") : [];
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
  let breakWords = false;
  let lines = wrapText(normalized, maxChars, breakWords);

  while ((lines.length > maxLines || (!breakWords && longestWord > maxChars)) && currentSize > minFontSize) {
    currentSize -= 1;
    lineHeight = Math.round(currentSize * 1.0 * 10) / 10;
    maxChars = Math.max(1, Math.floor((cell - padding * 2) / (currentSize * 0.6)));
    maxLines = Math.max(1, Math.floor((cell - padding * 2) / lineHeight));
    lines = wrapText(normalized, maxChars, breakWords);
  }

  if (!breakWords && longestWord > maxChars) {
    breakWords = true;
    lines = wrapText(normalized, maxChars, breakWords);
    while (lines.length > maxLines && currentSize > minFontSize) {
      currentSize -= 1;
      lineHeight = Math.round(currentSize * 1.0 * 10) / 10;
      maxChars = Math.max(1, Math.floor((cell - padding * 2) / (currentSize * 0.6)));
      maxLines = Math.max(1, Math.floor((cell - padding * 2) / lineHeight));
      lines = wrapText(normalized, maxChars, breakWords);
    }
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    if (last.length > 3 && maxChars > 3) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 3))}...`;
    }
  }

  const textBlockHeight = lineHeight * Math.max(1, lines.length);
  const innerHeight = cell - padding * 2;
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
        return `<text x="${textX}" y="${lineY}" font-size="${currentSize}" text-anchor="middle" dominant-baseline="alphabetic" fill="${fill}">${escapeXml(line)}</text>`;
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
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const textSvg = `<text x="${textX}" y="${textY}" font-size="${currentSize}" text-anchor="middle" dominant-baseline="hanging"${useClip ? ` clip-path="url(#${clipId})"` : ""} fill="${fill}">${tspan}</text>`;

  return { defs, text: textSvg };
}
