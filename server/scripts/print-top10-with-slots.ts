import { join } from "path";
import { parseFsh, Cell } from "../src/utils/parseFsh";
import { extractSlots, Dir } from "../src/utils/slots";

/* ——— выберите нужную строку (0‥22) ——— */
const ROW = 0;                         // ← поменяйте при необходимости

/* ——— читаем .fsh (column-major) ——— */
const { grid, cols, rows, fileName } = parseFsh(
  join(process.cwd(), "sample", "3_ Сканворд.fsh")
);

if (ROW >= rows) throw new Error(`В сетке только ${rows} строк (0-${rows-1})`);

/* ——— строка ROW (собираем из столбцов) ——— */
let line = "";
for (let c = 0; c < cols; c++) line += grid[c][ROW];
console.log(`\n${fileName} — строка ${ROW}:\n${line}\n`);

/* ——— все слоты, начинающиеся в этой строке ——— */
const slots = extractSlots(grid).filter(s => s.r === ROW);

/* helper: собрать «сырую» последовательность ячеек слота */
function slotRaw(r: number, c: number, dir: Dir, len: number): string {
  const dc = dir === "right" ? 1 : 0;
  const dr = dir === "down" ? 1 : 0;
  let s = "";
  for (let i = 0; i < len; i++, c += dc, r += dr) s += grid[c][r];
  return s;
}

console.log("Слоты этой строки:");
if (slots.length === 0) {
  console.log("  (нет стартов слов)");
} else {
  slots.forEach(s => {
    const raw = slotRaw(s.r, s.c, s.dir, s.len);
    const arrow = s.dir === "right" ? "➡" : "⬇";
    console.log(`  ${arrow}  len=${s.len}  ${raw}`);
  });
}
console.log();
