import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cell } from "../src/types";

const base = join(__dirname, "../src/arrows");

const b64 = (name: string) =>
  readFileSync(join(base, name)).toString("base64");

const IMG: Record<number, string> = {
  0x01: b64("01.svg"),
  0x02: b64("02.svg"),
  0x03: b64("03.svg"),
  0x04: b64("04.svg"),
  0x05: b64("05.svg"),
  0x06: b64("06.svg"),
  0x08: b64("08.svg"),
  0x10: b64("10.svg"),
  0x18: b64("18.svg"),
  0x20: b64("20.svg"),
  0x28: b64("28.svg"),
  0x30: b64("30.svg"),
  0x38: b64("38.svg"),
};

interface Arrow {
  img: string;
  ax: number;
  ay: number;
}

type PosFn = (x: number, y: number, size: number, cell: number) => Arrow[];

const exportMap: Record<number, PosFn> = {
  0x30: (x, y, s, c) => [{ img: IMG[0x30], ax: x, ay: y }],
  0x18: (x, y, s, c) => [{ img: IMG[0x18], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x28: (x, y, s, c) => [{ img: IMG[0x28], ax: x + c / 2 - s / 2, ay: y + c - s }],
  0x01: (x, y, s, c) => [{ img: IMG[0x01], ax: x + c / 2 - s / 2, ay: y }],
  0x02: (x, y, s, c) => [{ img: IMG[0x02], ax: x, ay: y }],
  0x03: (x, y, s, c) => [{ img: IMG[0x03], ax: x, ay: y + c / 2 - s / 2 }],
  0x04: (x, y, s, c) => [{ img: IMG[0x04], ax: x, ay: y + c - s }],
  0x05: (x, y, s, c) => [{ img: IMG[0x05], ax: x + c - s, ay: y + c - s }],
  0x06: (x, y, s, c) => [{ img: IMG[0x06], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x08: (x, y, s, c) => [{ img: IMG[0x08], ax: x + c / 2 - s / 2, ay: y }],
  0x10: (x, y, s, c) => [{ img: IMG[0x10], ax: x + c - s, ay: y }],
  0x20: (x, y, s, c) => [{ img: IMG[0x20], ax: x + c - s, ay: y + c - s }],
  0x38: (x, y, s, c) => [{ img: IMG[0x38], ax: x + c - s, ay: y }],
  0x29: (x, y, s, c) => [
    { img: IMG[0x01], ax: x + c / 2 - s / 2, ay: y },
    { img: IMG[0x28], ax: x + c / 2 - s / 2, ay: y + c - s },
  ],
};

const batchMap: Record<number, PosFn> = {
  0x30: (x, y, s, c) => [{ img: IMG[0x30], ax: x + c / 2 - s / 2 + 2, ay: y + c - s }],
  0x18: (x, y, s, c) => [{ img: IMG[0x18], ax: x, ay: y + c / 2 - s / 2 + 1 }],
  0x28: (x, y, s, c) => [{ img: IMG[0x28], ax: x + c - s + 2, ay: y + c - s }],
  0x01: (x, y, s, c) => [{ img: IMG[0x01], ax: x + c / 2 - s / 2, ay: y }],
  0x02: (x, y, s, c) => [{ img: IMG[0x02], ax: x, ay: y }],
  0x03: (x, y, s, c) => [{ img: IMG[0x03], ax: x, ay: y + c / 2 - s / 2 }],
  0x04: (x, y, s, c) => [{ img: IMG[0x04], ax: x, ay: y + c - s }],
  0x05: (x, y, s, c) => [{ img: IMG[0x05], ax: x + c - s, ay: y + c - s }],
  0x06: (x, y, s, c) => [{ img: IMG[0x06], ax: x + c - s, ay: y + c / 2 - s / 2 }],
  0x08: (x, y, s, c) => [{ img: IMG[0x08], ax: x + c / 2 - s / 2, ay: y }],
  0x10: (x, y, s, c) => [{ img: IMG[0x10], ax: x, ay: y }],
  0x20: (x, y, s, c) => [{ img: IMG[0x20], ax: x, ay: y + c - s }],
  0x38: (x, y, s, c) => [{ img: IMG[0x38], ax: x + c - s, ay: y }],
  0x29: (x, y, s, c) => [
    { img: IMG[0x01], ax: x + c / 2 - s / 2, ay: y },
    { img: IMG[0x28], ax: x + c - s + 2, ay: y + c - s },
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
    .map(({ img, ax, ay }) =>
      `<image href="data:image/svg+xml;base64,${img}" x="${ax}" y="${ay}" width="${size}" height="${size}"/>`
    )
    .join("");
}
