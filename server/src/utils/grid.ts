// src/grid.ts
// -----------------------------------------------------------
// • validate(...)  – проверяем размеры и символы сетки
// • scanSlots(...) – находим ВСЕ слова-слоты:
//       ↓  →  и   ↘  (↘ даёт СРАЗУ два слота: вниз И вправо)
// • lengthStats(...) – выдаём «длина → количество» + total
// -----------------------------------------------------------
import { Cell, Slot, ROWS, COLS, DIRS } from "../types";

/* допустимые символы в .fsh */
const ALLOWED = new Set<Cell>(["*", "#", "↓", "→", "↘"]);

/* ------------------ 1. ВАЛИДАЦИЯ ------------------------- */
export function validate(rows: string[]): void {
  if (rows.length !== ROWS) {
    throw new Error(`bad row count: ${rows.length} (expect ${ROWS})`);
  }
  rows.forEach((row, i) => {
    if (row.length !== COLS) {
      throw new Error(`row ${i} length ${row.length} (expect ${COLS})`);
    }
    for (const ch of row) {
      if (!ALLOWED.has(ch as Cell)) {
        throw new Error(`invalid char '${ch}' in row ${i}`);
      }
    }
  });
}

/* ------------------ 2. ПОИСК СЛОТОВ ---------------------- */
// ↘ стартер порождает два направления (down + right).
const dirListFrom = (ch: Cell) =>
  ch === "↓" ? [DIRS.down] :
  ch === "→" ? [DIRS.right] :
  ch === "↘" ? [DIRS.down, DIRS.right] :
  [];

/** Проверяем, что перед стрелкой стенка (или край), иначе это не старт */
const isStart = (rows: string[], r: number, c: number, dir: typeof DIRS[keyof typeof DIRS]): boolean => {
  const at = (row: number, col: number) => rows[row][col] as Cell;
  if (dir === DIRS.right) return c === 0 || at(r, c - 1) === "#";
  if (dir === DIRS.down)  return r === 0 || at(r - 1, c) === "#";
  return false; // DIRS.diag не используем как отдельное направление
};

/** Находит все слоты, пропуская «однобуквенные» */
export function scanSlots(rows: string[]): Slot[] {
  const at = (r: number, c: number) => rows[r][c] as Cell;
  const slots: Slot[] = [];
  let id = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dirs = dirListFrom(at(r, c));
      if (!dirs.length) continue;

      for (const dir of dirs) {
        if (!isStart(rows, r, c, dir)) continue;

        const cells: [number, number][] = [[r, c]];
        for (
          let nr = r + dir.dr, nc = c + dir.dc;
          nr < ROWS && nc < COLS && at(nr, nc) !== "#";
          nr += dir.dr, nc += dir.dc
        ) {
          cells.push([nr, nc]);
        }

        if (cells.length > 1) {              // пропускаем 1-буквенные
          slots.push({ id: id++, r, c, dir, len: cells.length, cells });
        }
      }
    }
  }
  return slots;
}

/* ------------------ 3. СТАТИСТИКА ------------------------ */
export function lengthStats(slots: Slot[]): Record<string, number> {
  const stats: Record<string, number> = { total: slots.length };
  for (const { len } of slots) {
    stats[len] = (stats[len] ?? 0) + 1;
  }
  return stats;
}
