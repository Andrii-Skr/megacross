/* -----------------------------------------------------------
   src/utils/slots.ts
   Работает с column-major сеткой (grid[col][row])
------------------------------------------------------------ */

import { Cell } from "./parseFsh";

export type ColumnGrid = Cell[][];      // grid[col][row]
export type Dir = "down" | "right";

export interface Slot {
  id:  number;
  r:   number;   // стартовая строка (row)
  c:   number;   // стартовый столбец (col)
  dir: Dir;      // направление
  len: number;   // длина слова (≥2)
}

/** Возвращает все слоты кроссворда */
export function extractSlots(grid: ColumnGrid): Slot[] {
  const cols = grid.length;         // 31
  const rows = grid[0].length;      // 23
  const slots: Slot[] = [];
  let id = 1;

  /* вспомогательный регистратор */
  const push = (r: number, c: number, dir: Dir) => {
    let len = 0, cc = c, rr = r;
    while (cc < cols && rr < rows && grid[cc][rr] !== "#") {
      len++;
      if (dir === "right") cc++; else rr++;
    }
    if (len >= 2) slots.push({ id: id++, r, c, dir, len });
  };

  /* внешний цикл — по столбцам, внутри — по строкам */
  for (let c = 0; c < cols; c++) {
    const col = grid[c];
    for (let r = 0; r < rows; r++) {
      const cell = col[r];
      if (cell === "⬇")        push(r, c, "down");
      else if (cell === "➡")   push(r, c, "right");
      else if (cell === "↘") { push(r, c, "down"); push(r, c, "right"); }
    }
  }
  return slots;
}
