import { ParsedFsh } from "./parseFsh";
import { extractSlots } from "./slots";

/**
 * Проверяет, есть ли слоты длиной 1 и выводит их координаты.
 * Если таких слотов нет — пишет «OK».
 */
export function checkSingleSlots(cross: ParsedFsh): void {
  /** 1. column-major (string[]) → row-major (string[][]) */
  const { grid, rows, cols } = cross;
  const rowMajor: string[][] = Array.from({ length: rows }, () => Array(cols).fill("#"));

  for (let col = 0; col < cols; col++) {
    const colStr = grid[col];          // строка-столбец, типа "*#⬇…"
    for (let row = 0; row < rows; row++) {
      rowMajor[row][col] = colStr[row];
    }
  }

  /** 2. ищем слоты длиной 1 */
  const singles = extractSlots(rowMajor as any)  // cast, т.к. extractSlots ждёт Cell[][]
    .filter(s => s.len === 1);

  if (singles.length === 0) {
    console.log(`✔ ${cross.fileName}: слоты длиной 1 отсутствуют`);
  } else {
    console.log(`❗ ${cross.fileName}: найдено ${singles.length} слотов длиной 1:`);
    singles.forEach(({ r, c, dir }) =>
      console.log(`   • (${r},${c}) направление ${dir}`)
    );
  }
}
