import { Grid, Slot, DIRS } from "../types";

export type ClueEntry = {
  arrowR: number;
  arrowC: number;
  clueR: number;
  clueC: number;
  cluePos: number;
  dir: "down" | "right";
  word: string;
  text: string;
};

const CLUE_MAP: Record<number, Array<{ cluePos: number; dirKey: number }>> = {
  0x01: [{ cluePos: 2, dirKey: 8 }],
  0x02: [{ cluePos: 1, dirKey: 8 }],
  0x03: [{ cluePos: 4, dirKey: 8 }],
  0x04: [{ cluePos: 7, dirKey: 8 }],
  0x05: [{ cluePos: 9, dirKey: 8 }],
  0x06: [{ cluePos: 6, dirKey: 8 }],
  0x07: [{ cluePos: 2, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x08: [{ cluePos: 2, dirKey: 6 }],
  0x0a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 2, dirKey: 6 }],
  0x0b: [{ cluePos: 2, dirKey: 6 }, { cluePos: 4, dirKey: 8 }],
  0x0d: [{ cluePos: 2, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x10: [{ cluePos: 1, dirKey: 6 }],
  0x11: [{ cluePos: 2, dirKey: 8 }, { cluePos: 1, dirKey: 6 }],
  0x13: [{ cluePos: 1, dirKey: 6 }, { cluePos: 2, dirKey: 8 }],
  0x15: [{ cluePos: 1, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x18: [{ cluePos: 4, dirKey: 6 }],
  0x19: [{ cluePos: 2, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1c: [{ cluePos: 2, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x1d: [{ cluePos: 4, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x20: [{ cluePos: 7, dirKey: 6 }],
  0x28: [{ cluePos: 9, dirKey: 6 }],
  0x29: [{ cluePos: 2, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x21: [{ cluePos: 2, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x23: [{ cluePos: 4, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x2a: [{ cluePos: 3, dirKey: 2 }, { cluePos: 7, dirKey: 6 }],
  0x2b: [{ cluePos: 4, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x2c: [{ cluePos: 7, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x30: [{ cluePos: 8, dirKey: 6 }],
  0x38: [{ cluePos: 3, dirKey: 6 }],
  0x39: [{ cluePos: 2, dirKey: 8 }, { cluePos: 3, dirKey: 6 }],
  0x3d: [{ cluePos: 3, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
};

const POS_OFFSETS: Record<number, [number, number]> = {
  1: [-1, -1],
  2: [-1, 0],
  3: [-1, 1],
  4: [0, -1],
  5: [0, 0],
  6: [0, 1],
  7: [1, -1],
  8: [1, 0],
  9: [1, 1],
};

function dirKeyFromSlot(slot: Slot): number {
  return slot.dir === DIRS.right ? 6 : 8;
}

function resolveClueCell(
  grid: Grid,
  slot: Slot,
  dirKey: number
): { clueR: number; clueC: number; cluePos: number } {
  const code = grid.codes[slot.r][slot.c];
  const mapping = CLUE_MAP[code] ?? [];
  const entry = mapping.find((item) => item.dirKey === dirKey);
  const cluePos = entry?.cluePos ?? 5;
  const [dr, dc] = POS_OFFSETS[cluePos] ?? [0, 0];

  let clueR = slot.r + dr;
  let clueC = slot.c + dc;
  if (
    clueR < 0 ||
    clueC < 0 ||
    clueR >= grid.rows ||
    clueC >= grid.cols
  ) {
    clueR = slot.r;
    clueC = slot.c;
    return { clueR, clueC, cluePos: 5 };
  }
  return { clueR, clueC, cluePos };
}

export function buildClueEntries(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>
): { down: ClueEntry[]; right: ClueEntry[] } {
  const down: ClueEntry[] = [];
  const right: ClueEntry[] = [];

  for (const slot of slots) {
    const word = slot.cells.map(([r, c]) => solved[r][c]).join("");
    const text = definitions.get(word.toUpperCase()) ?? "";
    const dirKey = dirKeyFromSlot(slot);
    const { clueR, clueC, cluePos } = resolveClueCell(grid, slot, dirKey);
    if (grid.data[clueR][clueC] !== "#") {
      continue;
    }
    const entry: ClueEntry = {
      arrowR: slot.r,
      arrowC: slot.c,
      clueR,
      clueC,
      cluePos,
      dir: slot.dir === DIRS.right ? "right" : "down",
      word,
      text,
    };

    if (entry.dir === "right") right.push(entry);
    else down.push(entry);
  }

  return { down, right };
}
