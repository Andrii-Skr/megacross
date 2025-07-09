import { Grid } from "./parseFsh";
import { Slot, extractSlots } from "./slots";

export interface SolveResult {
  filled: string[][];
  used: string[];
}

/** ---------- НАСТРОЙКИ ---------- */
const UNIQUE_WORDS = false;      // ← можно ставить true/false
const SHUFFLE_WORDS = true;      // ← перемешивать варианты одной длины
const SHOW_PROGRESS = true;      // ← лог слотов и слов при неудаче
/** -------------------------------- */

export function solve(grid: Grid, dict: Map<number, string[]>): SolveResult {
  const rows = grid.length, cols = grid[0].length;

  // пустая сетка букв
  const charG: string[][] = grid.map(row => row.map(c => (c === "#" ? "#" : "")));

  // собираем слоты (сортируем по длине – меньшие раньше)
  const slots = extractSlots(grid).sort((a, b) => a.len - b.len);

  // карта длина → список слов (копия, можно перемешать)
  const pool = new Map<number, string[]>();
  for (const [len, arr] of dict) {
    pool.set(len, SHUFFLE_WORDS ? shuffle([...arr]) : [...arr]);
  }

  const used = new Set<string>();
  const dirs = { down: [1, 0] as const, right: [0, 1] as const };

  const canPlace = (word: string, s: Slot): boolean => {
    const [dr, dc] = dirs[s.dir];
    let r = s.r, c = s.c;
    for (let i = 0; i < s.len; i++, r += dr, c += dc) {
      const ch = charG[r][c];
      if (ch && ch !== word[i]) return false;
    }
    return true;
  };

  const write = (word: string, s: Slot, put: boolean) => {
    const [dr, dc] = dirs[s.dir];
    let r = s.r, c = s.c;
    for (let i = 0; i < s.len; i++, r += dr, c += dc) {
      charG[r][c] = put ? word[i] : "";
    }
  };

  function backtrack(idx: number): boolean {
    if (idx === slots.length) return true;
    const slot = slots[idx];
    const words = pool.get(slot.len);
    if (!words || !words.length) return false;

    for (const w of words) {
      if (UNIQUE_WORDS && used.has(w)) continue;
      if (!canPlace(w, slot)) continue;

      write(w, slot, true);
      used.add(w);

      if (backtrack(idx + 1)) return true;

      write(w, slot, false);
      if (UNIQUE_WORDS) used.delete(w);
    }
    // если ни одно слово не подошло
    return false;
  }

  if (!backtrack(0)) {
    if (SHOW_PROGRESS) {
      console.error("---- Не удалось решить. Состояние сетки ----");
      console.table(charG.map(r => r.join("")));
    }
    throw new Error("Не удалось заполнить сканворд имеющимся словарём");
  }

  return { filled: charG, used: [...used] };
}

/** Fisher-Yates */
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
