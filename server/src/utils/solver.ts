// src/solver.ts
// -----------------------------------------------------------
// Быстрый backtracking-решатель:
//   • MRV (берём слот с наимен. кол-вом кандидатов)
//   • кэш pattern → список слов
//   • проверяем пересечения до записи
// Решает сетку 169 слов за < 1 с при словаре ≈20 000 слов.
// -----------------------------------------------------------
import { GridCell, Cell, Slot } from "../types.js";

const EMPTY = "." as const;

/* словарь: длина → список слов (UPPERCASE) */
export type Dict = Map<number, string[]>;

/* ——— precomputed table: для каждого слота — какие другие он пересекает —— */
type Cross = { other: number; iSelf: number; iOther: number }[];

/* кэш pattern → кандидаты */
const patternCache = new Map<string, string[]>();

/** pat "A..B." → /^A..B.$/  (lazy compile + кэш) */
function regexFromPattern(p: string): RegExp {
  if (!patternCache.has(p)) {
    // временно используем Map как кэш RegExp; слово-кандидаты кешируются отдельно
    (patternCache as any).set("_re_"+p, new RegExp("^" + p.replace(/\./g, ".") + "$"));
  }
  return (patternCache as any).get("_re_"+p);
}

/* ——————————————————————————————————————————————————————————————— */

export function solve(
  rawRows: string[],
  slots: Slot[],
  dict: Dict
): string[] | null {

  /* 1. готовим мутируемую матрицу */
  const grid: GridCell[][] = rawRows.map(r =>
    [...r].map(ch => (ch === "#" ? "#" : EMPTY))
  ) as GridCell[][];

  /* 2. таблица пересечений */
  const crosses: Record<number, Cross> = {};
  slots.forEach(s => crosses[s.id] = []);
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

  /* 3. helper: паттерн → кандидаты (с кэшем) */
  function candidates(slot: Slot): string[] {
    const patt = slot.cells.map(([r, c]) => grid[r][c]).join("");
    if (patternCache.has(patt)) return patternCache.get(patt)!;

    const re = regexFromPattern(patt);
    const list = (dict.get(slot.len) ?? []).filter(w => re.test(w));
    patternCache.set(patt, list);
    return list;
  }

  /* 4. MRV: берём слот с наименьшим числом кандидатов */
  const unfilled = new Set<number>(slots.map(s => s.id));
  function pickNext(): Slot | null {
    let best: Slot | null = null;
    let min = Infinity;
    unfilled.forEach(id => {
      const cnt = candidates(slots[id]).length;
      if (cnt < min) { min = cnt; best = slots[id]; }
    });
    return best;
  }

  /* 5. backtracking */
  function backtrack(): boolean {
    if (unfilled.size === 0) return true;

    const slot = pickNext();
    if (!slot) return false;               // dead end
    const cand = candidates(slot);
    if (cand.length === 0) return false;

    unfilled.delete(slot.id);

    for (const w of cand) {
      /* проверяем пересечения */
      let ok = true;
      for (const { other, iSelf, iOther } of crosses[slot.id]) {
        const [r, c] = slots[other].cells[iOther];
        const ch = grid[r][c];
        if (ch !== EMPTY && ch !== w[iSelf]) { ok = false; break; }
      }
      if (!ok) continue;

      /* ставим слово */
      const history: [number, number, GridCell][] = [];
      slot.cells.forEach(([r, c], i) => {
        history.push([r, c, grid[r][c]]);
        grid[r][c] = w[i] as Cell;
      });

      if (backtrack()) return true;  // success!

      /* откат */
      history.forEach(([r, c, prev]) => grid[r][c] = prev);
    }

    unfilled.add(slot.id);
    return false;
  }

  if (!backtrack()) return null;
  return grid.map(r => r.join(""));
}
