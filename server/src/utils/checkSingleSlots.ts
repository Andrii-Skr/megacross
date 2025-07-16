import { ParsedFsh } from "./parseFsh";
import { Dir } from "./slots";

/** Координата и направление «единичного» слота */
interface SingleSlot {
  row: number;
  col: number;
  dir: Dir;
}

/**
 * Проверка: есть ли слоты длиной 1.
 * Печатает результат в консоль.
 */
export function checkSingleSlots({ fileName, grid, rows, cols }: ParsedFsh): void {
  const singles: SingleSlot[] = [];

  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  const isBlack   = (r: number, c: number) => grid[c][r] === "#";

  // ► для каждой старт-клетки проверяем «право» и «вниз»
  for (let col = 0; col < cols; col++) {
    const column = grid[col];

    for (let row = 0; row < rows; row++) {
      const cell = column[row];

      // горизонтали
      if ((cell === "➡" || cell === "↘") && inBounds(row, col + 1)) {
        if (isBlack(row, col + 1)) singles.push({ row, col, dir: "right" });
      }

      // вертикали
      if ((cell === "⬇" || cell === "↘") && inBounds(row + 1, col)) {
        if (isBlack(row + 1, col)) singles.push({ row, col, dir: "down" });
      }
    }
  }

  // ---------- вывод ----------
  if (singles.length === 0) {
    console.log(`✔ ${fileName}: слотов длиной 1 НЕ найдено`);
  } else {
    console.log(`❗ ${fileName}: найдено ${singles.length} слотов длиной 1:`);
    singles.forEach(({ row, col, dir }) =>
      console.log(`   • (${row},${col}) направление ${dir}`)
    );
  }
}
