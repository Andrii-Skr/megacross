import { Grid } from "./parseFsh";

/** Направление слова */
export type Dir = "down" | "right";

/** Слот (место для слова) */
export interface Slot {
  id:  number;  // уникальный ID
  r:   number;  // стартовая строка (0-based)
  c:   number;  // стартовый столбец (0-based)
  dir: Dir;     // "down" | "right"
  len: number;  // длина слова
}

/** Выделяем все слоты в сетке */
export function extractSlots(grid: Grid): Slot[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const slots: Slot[] = [];
  let id = 1;

  /** Добавить слот, начиная с (row,col) по направлению dir */
  const addSlot = (row: number, col: number, dir: Dir) => {
    let length = 0;
    let r = row;
    let c = col;
    const dr = dir === "down" ? 1 : 0;   // шаг по строкам
    const dc = dir === "right" ? 1 : 0;  // шаг по столбцам  ←--- FIX
    while (r < rows && c < cols && grid[r][c] !== "#") {
      length++;
      r += dr;
      c += dc;
    }
    slots.push({ id: id++, r: row, c: col, dir, len: length });
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell === "⬇")        addSlot(r, c, "down");
      else if (cell === "➡")   addSlot(r, c, "right");
      else if (cell === "↘") { addSlot(r, c, "down"); addSlot(r, c, "right"); }
    }
  }
  return slots;
}
