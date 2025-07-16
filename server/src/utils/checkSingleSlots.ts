import { ParsedFsh } from "./parseFsh";
import { extractSlots } from "./slots";


/**
 * Проверка: есть ли слоты длиной 1.
 * Печатает результат в консоль.
 */
export function checkSingleSlots(cross: ParsedFsh): void {
  const singles = extractSlots(cross.grid).filter(s => s.len === 1);

  // ---------- вывод ----------
  if (singles.length === 0) {
    console.log(`✔ ${cross.fileName}: слотов длиной 1 НЕ найдено`);
  } else {
    console.log(`❗ ${cross.fileName}: найдено ${singles.length} слотов длиной 1:`);
    singles.forEach(({ r, c, dir }) =>
      console.log(`   • (${r},${c}) направление ${dir}`)
    );
  }
}
