// src/solver.ts
// -----------------------------------------------------------------------------
// Заполняет сетку словами (backtracking).
// Поддерживает опциональное перемешивание списка кандидатов для «разных вариантов»
//   solve(rawRows, slots, dict, /* shuffle = */ true)
// -----------------------------------------------------------------------------
//  • MRV – всегда берём слот с наименьшим числом кандидатов;
//  • кэш pattern → список кандидатов (и RegExp);
//  • проверяем пересечения ДО записи; откатываем при конфликте.
//
// Типовая сетка (≈170 слов) решается < секунды при словаре ~20 000 слов.
//
import { GridCell, Cell, Slot } from "../types.js";

const EMPTY = "." as const;
export type Dict = Map<number, string[]>;

/* ------------------ helpers ------------------------------------------------ */

/** кэш: pattern "A..Б." → список слов + компилированный RegExp */
const patternCache = new Map<string, string[]>();
const regexCache   = new Map<string, RegExp>();

function getCandidates(pattern: string, words: string[]): string[] {
  if (patternCache.has(pattern)) return patternCache.get(pattern)!;
  if (!regexCache.has(pattern))
    regexCache.set(pattern, new RegExp("^" + pattern.replace(/\./g, ".") + "$"));
  const re   = regexCache.get(pattern)!;
  const list = words.filter(w => re.test(w));
  patternCache.set(pattern, list);
  return list;
}

/** Fisher-Yates in-place shuffle */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ------------------ основная функция -------------------------------------- */

export function solve(
  rawRows: string[],   // строки с '#↓→↘*'
  slots: Slot[],       // найденные в grid.ts
  dict: Dict,
  shuffle = false      // ← если true — кандидаты перемешиваются
): string[] | null {

  /* 1. Мутируемая матрица для букв */
  const grid: GridCell[][] = rawRows.map(r =>
    [...r].map(ch => (ch === "#" ? "#" : EMPTY))
  ) as GridCell[][];

  /* 2. Вычисляем пересечения слотов один раз */
  const crosses: Record<number, { other: number; iSelf: number; iOther: number }[]> = {};
  slots.forEach(s => (crosses[s.id] = []));
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      slots[i].cells.forEach(([r1, c1], k1) => {
        slots[j].cells.forEach(([r2, c2], k2) => {
          if (r1 === r2 && c1 === c2) {
            crosses[slots[i].id].push({ other: slots[j].id, iSelf: k1, iOther: k2 });
            crosses[slots[j].id].push({ other: slots[i].id, iSelf: k2, iOther: k1 });
          }
        });
      });
    }
  }

  /* 3. MRV: слот с минимальным числом кандидатов */
  const unfilled = new Set<number>(slots.map(s => s.id));
  function pickNext(): Slot | null {
    let best: Slot | null = null;
    let min = Infinity;
    unfilled.forEach(id => {
      const patt   = slots[id].cells.map(([r,c]) => grid[r][c]).join("");
      const words  = dict.get(slots[id].len) ?? [];
      const count  = getCandidates(patt, words).length;
      if (count < min) { min = count; best = slots[id]; }
    });
    return best;
  }

  /* 4. backtracking */
  function backtrack(): boolean {
    if (unfilled.size === 0) return true;

    const slot = pickNext();
    if (!slot) return false;

    const patt  = slot.cells.map(([r,c]) => grid[r][c]).join("");
    let cand    = getCandidates(patt, dict.get(slot.len) ?? []);
    if (cand.length === 0) return false;
    if (shuffle && cand.length > 1) {
      cand = cand.slice();          // не портим кэш
      shuffleInPlace(cand);
    }

    unfilled.delete(slot.id);

    for (const word of cand) {
      /* проверяем пересечения */
      let ok = true;
      for (const { other, iSelf, iOther } of crosses[slot.id]) {
        const [r, c] = slots[other].cells[iOther];
        const ch = grid[r][c];
        if (ch !== EMPTY && ch !== word[iSelf]) { ok = false; break; }
      }
      if (!ok) continue;

      /* пишем слово + запоминаем для отката */
      const hist: [number, number, GridCell][] = [];
      slot.cells.forEach(([r,c], i) => {
        hist.push([r,c,grid[r][c]]);
        grid[r][c] = word[i] as Cell;
      });

      if (backtrack()) return true;

      /* откат */
      hist.forEach(([r,c,prev]) => (grid[r][c] = prev));
    }

    unfilled.add(slot.id);
    return false;
  }

  return backtrack() ? grid.map(r => r.join("")) : null;
}
