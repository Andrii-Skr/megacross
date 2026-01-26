import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cell } from "../src/types";

const base = join(__dirname, "../src/arrows");

type ArrowAsset = {
  body: string;
  width: number;
  height: number;
};

const readArrow = (name: string): ArrowAsset => {
  const raw = readFileSync(join(base, name), "utf8");
  const svgMatch = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const bodyRaw = svgMatch ? svgMatch[1] : raw;
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/i);
  let width = 100;
  let height = 100;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((v) => Number.parseFloat(v));
    if (parts.length === 4 && parts.every((v) => Number.isFinite(v))) {
      width = parts[2] ?? width;
      height = parts[3] ?? height;
    }
  } else {
    const widthMatch = raw.match(/width="([^"]+)"/i);
    const heightMatch = raw.match(/height="([^"]+)"/i);
    if (widthMatch) width = Number.parseFloat(widthMatch[1]) || width;
    if (heightMatch) height = Number.parseFloat(heightMatch[1]) || height;
  }
  const body = bodyRaw.replace(/\s+id="[^"]*"/g, "").trim();
  return { body, width, height };
};

const IMG: Record<number, ArrowAsset> = {
  0x01: readArrow("01.svg"),
  0x02: readArrow("02.svg"),
  0x03: readArrow("03.svg"),
  0x04: readArrow("04.svg"),
  0x05: readArrow("05.svg"),
  0x06: readArrow("06.svg"),
  0x08: readArrow("08.svg"),
  0x10: readArrow("10.svg"),
  0x18: readArrow("18.svg"),
  0x20: readArrow("20.svg"),
  0x28: readArrow("28.svg"),
  0x30: readArrow("30.svg"),
  0x38: readArrow("38.svg"),
};

interface Arrow {
  asset: ArrowAsset;
  ax: number;
  ay: number;
}

type PosFn = (x: number, y: number, size: number, cell: number) => Arrow[];

const exportMap: Record<number, PosFn> = {
  0x30: (x, y, s, c) => [{ asset: IMG[0x30], ax: x, ay: y }],
  0x18: (x, y, s, c) => [{ asset: IMG[0x18], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x28: (x, y, s, c) => [{ asset: IMG[0x28], ax: x + c / 2 - s / 2, ay: y + c - s }],
  0x01: (x, y, s, c) => [{ asset: IMG[0x01], ax: x + c / 2 - s / 2, ay: y }],
  0x02: (x, y, s, c) => [{ asset: IMG[0x02], ax: x, ay: y }],
  0x03: (x, y, s, c) => [{ asset: IMG[0x03], ax: x, ay: y + c / 2 - s / 2 }],
  0x04: (x, y, s, c) => [{ asset: IMG[0x04], ax: x, ay: y + c - s }],
  0x05: (x, y, s, c) => [{ asset: IMG[0x05], ax: x + c - s, ay: y + c - s }],
  0x06: (x, y, s, c) => [{ asset: IMG[0x06], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x08: (x, y, s, c) => [{ asset: IMG[0x08], ax: x + c / 2 - s / 2, ay: y }],
  0x10: (x, y, s, c) => [{ asset: IMG[0x10], ax: x + c - s, ay: y }],
  0x20: (x, y, s, c) => [{ asset: IMG[0x20], ax: x + c - s, ay: y + c - s }],
  0x38: (x, y, s, c) => [{ asset: IMG[0x38], ax: x + c - s, ay: y }],
  0x29: (x, y, s, c) => [
    { asset: IMG[0x01], ax: x + c / 2 - s / 2, ay: y },
    { asset: IMG[0x28], ax: x + c / 2 - s / 2, ay: y + c - s },
  ],
};

const batchMap: Record<number, PosFn> = {
  0x30: (x, y, s, c) => [{ asset: IMG[0x30], ax: x + c / 2 - s / 2 + 2, ay: y + c - s }],
  0x18: (x, y, s, c) => [{ asset: IMG[0x18], ax: x, ay: y + c / 2 - s / 2 + 1 }],
  0x28: (x, y, s, c) => [{ asset: IMG[0x28], ax: x + c - s + 2, ay: y + c - s }],
  0x01: (x, y, s, c) => [{ asset: IMG[0x01], ax: x + c / 2 - s / 2, ay: y }],
  0x02: (x, y, s, c) => [{ asset: IMG[0x02], ax: x, ay: y }],
  0x03: (x, y, s, c) => [{ asset: IMG[0x03], ax: x, ay: y + c / 2 - s / 2 }],
  0x04: (x, y, s, c) => [{ asset: IMG[0x04], ax: x, ay: y + c - s }],
  0x05: (x, y, s, c) => [{ asset: IMG[0x05], ax: x + c - s, ay: y + c - s }],
  0x06: (x, y, s, c) => [{ asset: IMG[0x06], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x08: (x, y, s, c) => [{ asset: IMG[0x08], ax: x + c / 2 - s / 2, ay: y }],
  0x10: (x, y, s, c) => [{ asset: IMG[0x10], ax: x, ay: y }],
  0x20: (x, y, s, c) => [{ asset: IMG[0x20], ax: x, ay: y + c - s }],
  0x38: (x, y, s, c) => [{ asset: IMG[0x38], ax: x + c - s, ay: y }],
  0x29: (x, y, s, c) => [
    { asset: IMG[0x01], ax: x + c / 2 - s / 2, ay: y },
    { asset: IMG[0x28], ax: x + c - s + 2, ay: y + c - s },
  ],
};

export function arrowSvg(
  variant: "export" | "batch",
  code: number,
  orig: Cell,
  x: number,
  y: number,
  cell: number,
  size: number
): string {
  if ([0x01, 0x02, 0x03, 0x04, 0x05, 0x06].includes(code) && orig !== "↓") {
    return "";
  }
  const map = variant === "export" ? exportMap : batchMap;
  const fn = map[code];
  if (!fn) return "";
  return fn(x, y, size, cell)
    .map(({ asset, ax, ay }) => {
      const w = asset.width || size;
      const h = asset.height || size;
      const scale = Math.min(size / w, size / h);
      const dx = ax + (size - w * scale) / 2;
      const dy = ay + (size - h * scale) / 2;
      const tx = Math.round(dx * 1000) / 1000;
      const ty = Math.round(dy * 1000) / 1000;
      const sc = Math.round(scale * 1000) / 1000;
      return `<g transform="translate(${tx} ${ty}) scale(${sc})">${asset.body}</g>`;
    })
    .join("");
}
