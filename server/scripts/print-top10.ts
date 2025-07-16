// scripts/show-colgrid.ts
import { join } from "path";
import { parseFsh } from "../src/utils/parseFsh";

const PRINT_ALL = false;            // true → печатаем все 31 столбец

/* ---------- файл .fsh ---------- */
const file = join(process.cwd(), "sample", "3_ Сканворд.fsh");
const { grid, rows, cols, fileName } = parseFsh(file);   // grid[col][row]

console.log(`\n${fileName} — column-major ${rows}×${cols}`);
console.log(`показываю ${PRINT_ALL ? cols : 10} столбцов:\n`);

/* ---------- вывод ---------- */
const limit = PRINT_ALL ? cols : Math.min(10, cols);

for (let c = 0; c < limit; c++) {
  console.log(`col ${c.toString().padStart(2)} : ${grid[c].join("")}`);
}
