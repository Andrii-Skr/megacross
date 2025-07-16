// scripts/slots-full-report.ts
import { join } from "path";
import { parseFsh, Cell } from "../src/utils/parseFsh";
import { extractSlots, Dir } from "../src/utils/slots";

/* получить символ ячейки (column-major) */
const cell = (g: Cell[][], r: number, c: number) => g[c][r];

/* «сырая» строка ячеек вдоль слота */
function slotString(
  grid: Cell[][],
  r: number,
  c: number,
  dir: Dir,
  len: number
): string {
  const dc = dir === "right" ? 1 : 0;
  const dr = dir === "down" ? 1 : 0;
  let s = "";
  for (let i = 0; i < len; i++, c += dc, r += dr) s += cell(grid, r, c);
  return s;
}

/* ---------- основной код ---------- */
const file = join(process.cwd(), "sample", "3_ Сканворд.fsh");
const { grid } = parseFsh(file);          // column-major Cell[][]
const slots = extractSlots(grid);         // column-major

/* массив вида [строка_ячеек, длина] */
const list: [string, number][] = slots.map(s => [
  slotString(grid, s.r, s.c, s.dir, s.len),
  s.len,
]);

/* подсчёт слов по длинам */
const stat = new Map<number, number>();
for (const [, len] of list) stat.set(len, (stat.get(len) ?? 0) + 1);

/* ---------- вывод ---------- */
console.log("\n=== Список всех слотов ===");
console.table(list);                      // удобно смотреть в табличном виде

console.log("\n=== Статистика по длинам ===");
[...stat.keys()].sort((a, b) => a - b).forEach(len =>
  console.log(`длина ${len.toString().padStart(2)} : ${stat.get(len)}`)
);

console.log(`\nВсего слов : ${list.length}\n`);
