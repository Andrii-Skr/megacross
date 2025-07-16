import { Cell, Slot, ROWS, COLS } from "../types";

const EMPTY = "." as const;

export function solve(
  rawRows: string[],
  slots: Slot[],
  dict: Map<number,string[]>
): string[] | null {

  // делаем мутируемую копию сетки
  const grid: Cell[][] = rawRows.map(row =>
    [...row].map(ch => (ch === "#" ? "#" : EMPTY))
  ) as Cell[][];

  // быстр. проверка: все длины присутствуют в словаре
  const missing = slots
    .filter(s => !(dict.get(s.len)?.length))
    .map(s => s.len);
  if (missing.length) {
    console.warn("нет слов длины:", [...new Set(missing)].join(", "));
    return null;
  }

  const backtrack = (idx: number): boolean => {
    if (idx === slots.length) return true;

    const slot = slots[idx];
    const pattern = slot.cells.map(([r,c]) => grid[r][c]).join("");

    const candidates = (dict.get(slot.len)!)
      .filter(w => pattern.split("").every((g,i) =>
        g === EMPTY || g === w[i]));

    for (const w of candidates) {
      const written: [number,number,Cell][] = [];
      for (let i = 0; i < slot.len; i++) {
        const [r,c] = slot.cells[i];
        written.push([r,c,grid[r][c]]);
        grid[r][c] = w[i] as Cell;
      }
      if (backtrack(idx + 1)) return true;
      written.forEach(([r,c,prev]) => grid[r][c] = prev);
    }
    return false;
  };

  if (!backtrack(0)) return null;

  // вернуть итоговые строки
  return grid.map(r => r.join(""));
}
