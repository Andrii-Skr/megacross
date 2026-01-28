// src/solver.ts
// -----------------------------------------------------------------------------
// Заполняет сетку словами (backtracking / DLX).
// Поддерживает опциональные перемешивание, рестарты, уникальность слов.
// -----------------------------------------------------------------------------
import { GridCell, Cell, Slot } from "../types.js";
import { solveDlxNative } from "./nativeDlx";

const EMPTY = "." as const;
export type Dict = Map<number, string[]>;

/* ------------------ types -------------------------------------------------- */

export type SolveProgress = {
  label?: string;
  attempt: number;
  restarts: number;
  engine: "csp" | "dlx";
  nodes: number;
  elapsedMs: number;
  nodesPerSec: number;
  unfilled: number;
  depth: number;
  lastPick?: {
    id: number;
    len: number;
    degree: number;
    candidates: number;
    pattern: string;
  };
  stats: {
    rejectIntersect: number;
    rejectForward: number;
    zeroPick: number;
    backtracks: number;
  };
};

export type SolveFailInfo = {
  label?: string;
  attempt: number;
  engine: "csp" | "dlx";
  reason: "zero-pick" | "forward-check" | "aborted" | "no-solution";
  detail?: {
    slot?: {
      id: number;
      r: number;
      c: number;
      len: number;
      dir: "down" | "right";
    };
    pattern?: string;
    column?: {
      name: string;
      type: "slot" | "cell" | "word" | "other";
      slot?: {
        id: number;
        r: number;
        c: number;
        len: number;
        dir: "down" | "right";
      };
      cell?: { r: number; c: number };
      word?: string;
    };
    limit?: "maxMs" | "maxNodes";
  };
};

export type SolveOptions = {
  shuffle?: boolean;
  lcv?: boolean;
  restarts?: number;
  parallelRestarts?: number;
  uniqueWords?: boolean;
  engine?: "csp" | "dlx";
  splitComponents?: boolean;
  nativeDlx?: boolean;
  debugDlx?: boolean;
  maxMs?: number;
  maxNodes?: number;
  logEveryMs?: number;
  logEveryNodes?: number;
  label?: string;
  progressStdout?: boolean;
  failStdout?: boolean;
  onProgress?: (info: SolveProgress) => void;
  onFail?: (info: SolveFailInfo) => void;
};

type ResolvedOptions = {
  shuffle: boolean;
  lcv: boolean;
  restarts: number;
  parallelRestarts: number;
  uniqueWords: boolean;
  engine: "csp" | "dlx";
  splitComponents: boolean;
  nativeDlx: boolean;
  debugDlx: boolean;
  maxMs?: number;
  maxNodes?: number;
  logEveryMs: number;
  logEveryNodes: number;
  label?: string;
  onProgress?: (info: SolveProgress) => void;
  onFail?: (info: SolveFailInfo) => void;
};

/* ------------------ helpers ------------------------------------------------ */

type IndexCell = { list: number[]; set: Set<number> };

type WordIndex = {
  wordsByLen: Map<number, string[]>;
  posIndex: Map<number, Map<number, Map<string, IndexCell>>>;
};

function buildWordIndex(dict: Dict): WordIndex {
  const wordsByLen = new Map<number, string[]>();
  const posIndex = new Map<number, Map<number, Map<string, IndexCell>>>();
  for (const [len, wordsRaw] of dict) {
    const words = [...wordsRaw];
    wordsByLen.set(len, words);
    const posMap = new Map<number, Map<string, IndexCell>>();
    for (let i = 0; i < len; i++) posMap.set(i, new Map());
    words.forEach((word, idx) => {
      for (let i = 0; i < len; i++) {
        const ch = word[i];
        const letterMap = posMap.get(i)!;
        let cell = letterMap.get(ch);
        if (!cell) {
          cell = { list: [], set: new Set<number>() };
          letterMap.set(ch, cell);
        }
        cell.list.push(idx);
        cell.set.add(idx);
      }
    });
    posIndex.set(len, posMap);
  }
  return { wordsByLen, posIndex };
}

function getCandidates(
  pattern: string,
  len: number,
  index: WordIndex,
  cache: Map<string, string[]>
): string[] {
  const key = `${len}:${pattern}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const words = index.wordsByLen.get(len) ?? [];
  const posMap = index.posIndex.get(len);
  if (!posMap) {
    cache.set(key, []);
    return [];
  }
  let hasLetters = false;
  const constraints: IndexCell[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch !== ".") {
      hasLetters = true;
      const letterMap = posMap.get(i);
      const cell = letterMap?.get(ch);
      if (!cell) {
        cache.set(key, []);
        return [];
      }
      constraints.push(cell);
    }
  }
  if (!hasLetters) {
    cache.set(key, words);
    return words;
  }
  constraints.sort((a, b) => a.list.length - b.list.length);
  const base = constraints[0].list;
  const out: string[] = [];
  for (const idx of base) {
    let ok = true;
    for (let i = 1; i < constraints.length; i++) {
      if (!constraints[i].set.has(idx)) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(words[idx]);
  }
  cache.set(key, out);
  return out;
}

/** Fisher-Yates in-place shuffle */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function initGrid(rawRows: string[]): GridCell[][] {
  return rawRows.map(r => [...r].map(ch => (ch === "#" ? "#" : EMPTY))) as GridCell[][];
}

function buildCrossData(slots: Slot[]) {
  const crosses: Record<number, { other: number; iSelf: number; iOther: number }[]> = {};
  const crossByOther: Record<number, Record<number, { iSelf: number; iOther: number }[]>> = {};
  const adjacency = new Map<number, Set<number>>();
  const cellMap = new Map<string, { slotId: number; index: number; r: number; c: number }[]>();
  for (const slot of slots) {
    crosses[slot.id] = [];
    crossByOther[slot.id] = {};
    adjacency.set(slot.id, new Set());
    slot.cells.forEach(([r, c], index) => {
      const key = `${r},${c}`;
      const list = cellMap.get(key) ?? [];
      list.push({ slotId: slot.id, index, r, c });
      cellMap.set(key, list);
    });
  }
  const intersectionCells = new Set<string>();
  for (const [key, list] of cellMap.entries()) {
    if (list.length < 2) continue;
    intersectionCells.add(key);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        crosses[a.slotId].push({ other: b.slotId, iSelf: a.index, iOther: b.index });
        crosses[b.slotId].push({ other: a.slotId, iSelf: b.index, iOther: a.index });
        (crossByOther[a.slotId][b.slotId] ??= []).push({ iSelf: a.index, iOther: b.index });
        (crossByOther[b.slotId][a.slotId] ??= []).push({ iSelf: b.index, iOther: a.index });
        adjacency.get(a.slotId)!.add(b.slotId);
        adjacency.get(b.slotId)!.add(a.slotId);
      }
    }
  }
  return { crosses, crossByOther, adjacency, intersectionCells, cellMap };
}

function buildComponents(slots: Slot[], adjacency: Map<number, Set<number>>): number[][] {
  const seen = new Set<number>();
  const components: number[][] = [];
  for (const slot of slots) {
    if (seen.has(slot.id)) continue;
    const stack = [slot.id];
    seen.add(slot.id);
    const comp: number[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      const next = adjacency.get(id);
      if (!next) continue;
      for (const n of next) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

function remapSlots(slots: Slot[], ids: number[]): { slots: Slot[]; map: Map<number, number> } {
  const map = new Map<number, number>();
  const out: Slot[] = [];
  ids.forEach((id, idx) => map.set(id, idx));
  for (const id of ids) {
    const slot = slots.find(s => s.id === id);
    if (!slot) continue;
    const newSlot: Slot = {
      ...slot,
      id: map.get(slot.id)!,
    };
    out.push(newSlot);
  }
  return { slots: out, map };
}

/* ------------------ CSP solver -------------------------------------------- */

type CspAttemptResult = { solved: string[] | null; aborted: boolean };

function runAttemptCsp(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options: ResolvedOptions,
  attempt: number
): CspAttemptResult {
  const index = buildWordIndex(dict);
  const patternCache = new Map<string, string[]>();
  const grid = initGrid(rawRows);
  const { crosses, crossByOther } = buildCrossData(slots);

  const unfilled = new Set<number>(slots.map(s => s.id));
  const weights = new Map<number, number>();
  for (const s of slots) weights.set(s.id, 1);
  const usedWords = new Map<string, number>();

  let nodes = 0;
  let rejectIntersect = 0;
  let rejectForward = 0;
  let zeroPick = 0;
  let backtracks = 0;
  let abortReason: "maxMs" | "maxNodes" | null = null;
  let lastFail: SolveFailInfo | null = null;

  const slotRef = (slot: Slot): NonNullable<SolveFailInfo["detail"]>["slot"] => ({
    id: slot.id,
    r: slot.r,
    c: slot.c,
    len: slot.len,
    dir: slot.dir.dr === 1 ? "down" : "right",
  });

  const startedAt = Date.now();
  let aborted = false;
  let nextLogAt = options.logEveryMs > 0 ? startedAt + options.logEveryMs : Number.POSITIVE_INFINITY;
  let nextLogNode = options.logEveryNodes > 0 ? options.logEveryNodes : Number.POSITIVE_INFINITY;
  let lastPick: SolveProgress["lastPick"]; // for logging

  function maybeReport(depth: number): void {
    if (!options.onProgress) return;
    const now = Date.now();
    if (now < nextLogAt && nodes < nextLogNode) return;
    const elapsedMs = now - startedAt;
    const nodesPerSec = elapsedMs > 0 ? Math.round(nodes / (elapsedMs / 1000)) : nodes;
    options.onProgress({
      label: options.label,
      attempt,
      restarts: options.restarts,
      engine: "csp",
      nodes,
      elapsedMs,
      nodesPerSec,
      unfilled: unfilled.size,
      depth,
      lastPick,
      stats: { rejectIntersect, rejectForward, zeroPick, backtracks },
    });
    if (options.logEveryMs > 0) nextLogAt = now + options.logEveryMs;
    if (options.logEveryNodes > 0) nextLogNode = nodes + options.logEveryNodes;
  }

  function shouldAbort(): boolean {
    if (aborted) return true;
    if (options.maxMs !== undefined && Date.now() - startedAt >= options.maxMs) {
      abortReason = "maxMs";
      aborted = true;
      return true;
    }
    if (options.maxNodes !== undefined && nodes >= options.maxNodes) {
      abortReason = "maxNodes";
      aborted = true;
      return true;
    }
    return false;
  }

  function pickNext(): { slot: Slot; candidates: string[]; pattern: string; degree: number } | null {
    let best: Slot | null = null;
    let bestCandidates: string[] = [];
    let bestPattern = "";
    let bestScore = Infinity;
    let bestDegree = -1;

    for (const id of unfilled) {
      const slot = slots[id];
      const pattern = slot.cells.map(([r, c]) => grid[r][c]).join("");
      const candAll = getCandidates(pattern, slot.len, index, patternCache);
      const candidates = options.uniqueWords && usedWords.size > 0
        ? candAll.filter(w => !usedWords.has(w))
        : candAll;
      const count = candidates.length;
      const weight = weights.get(id) ?? 1;
      const score = count / weight;
      const degree = crosses[slot.id].length;
      if (score < bestScore || (score === bestScore && degree > bestDegree)) {
        bestScore = score;
        bestDegree = degree;
        best = slot;
        bestCandidates = candidates;
        bestPattern = pattern;
        if (count === 0) break;
      }
    }
    return best
      ? { slot: best, candidates: bestCandidates, pattern: bestPattern, degree: bestDegree }
      : null;
  }

  function scoreWord(slotId: number, word: string): number {
    const neighbors = crossByOther[slotId];
    let score = 0;
    for (const otherIdStr in neighbors) {
      const other = Number(otherIdStr);
      if (!unfilled.has(other)) continue;
      const otherSlot = slots[other];
      const base = otherSlot.cells.map(([r, c]) => grid[r][c]);
      for (const { iSelf, iOther } of neighbors[other]) {
        base[iOther] = word[iSelf] as GridCell;
      }
      const patt = base.join("");
      const candAll = getCandidates(patt, otherSlot.len, index, patternCache);
      const cand = options.uniqueWords && usedWords.size > 0
        ? candAll.filter(w => !usedWords.has(w))
        : candAll;
      if (cand.length === 0) return -1;
      score += cand.length;
    }
    return score;
  }

  function orderCandidates(slotId: number, candidates: string[]): string[] {
    if (candidates.length <= 1) return candidates;
    let ordered = candidates;
    if (options.shuffle || options.lcv) ordered = candidates.slice();
    if (options.lcv) {
      const scored = ordered.map((w, i) => ({
        word: w,
        score: scoreWord(slotId, w),
        tie: options.shuffle ? Math.random() : i,
      }));
      scored.sort((a, b) => (b.score - a.score) || (a.tie - b.tie));
      return scored.map(s => s.word);
    }
    if (options.shuffle) shuffleInPlace(ordered);
    return ordered;
  }

  function backtrack(depth = 0): boolean {
    if (unfilled.size === 0) return true;
    if (shouldAbort()) return false;
    maybeReport(depth);

    const choice = pickNext();
    if (!choice) return false;

    const { slot, candidates, pattern, degree } = choice;
    if (candidates.length === 0) {
      zeroPick++;
      lastFail = {
        label: options.label,
        attempt,
        engine: "csp",
        reason: "zero-pick",
        detail: { slot: slotRef(slot), pattern },
      };
      weights.set(slot.id, (weights.get(slot.id) ?? 1) + 1);
      return false;
    }
    const cand = orderCandidates(slot.id, candidates);

    unfilled.delete(slot.id);
    lastPick = {
      id: slot.id,
      len: slot.len,
      degree,
      candidates: candidates.length,
      pattern,
    };

    for (const word of cand) {
      if (shouldAbort()) break;
      if (options.uniqueWords && usedWords.has(word)) continue;
      let ok = true;
      for (const { other, iSelf, iOther } of crosses[slot.id]) {
        const [r, c] = slots[other].cells[iOther];
        const ch = grid[r][c];
        if (ch !== EMPTY && ch !== word[iSelf]) { ok = false; break; }
      }
      if (!ok) { rejectIntersect++; continue; }

      const hist: [number, number, GridCell][] = [];
      slot.cells.forEach(([r, c], i) => {
        hist.push([r, c, grid[r][c]]);
        grid[r][c] = word[i] as Cell;
      });
      if (options.uniqueWords) usedWords.set(word, (usedWords.get(word) ?? 0) + 1);
      nodes++;
      if (shouldAbort()) {
        hist.forEach(([r, c, prev]) => (grid[r][c] = prev));
        if (options.uniqueWords) {
          const count = (usedWords.get(word) ?? 1) - 1;
          if (count <= 0) usedWords.delete(word);
          else usedWords.set(word, count);
        }
        break;
      }

      for (const { other } of crosses[slot.id]) {
        if (!unfilled.has(other)) continue;
        const otherSlot = slots[other];
        const patt = otherSlot.cells.map(([r, c]) => grid[r][c]).join("");
        const candAll = getCandidates(patt, otherSlot.len, index, patternCache);
        const cand2 = options.uniqueWords && usedWords.size > 0
          ? candAll.filter(w => !usedWords.has(w))
          : candAll;
        if (cand2.length === 0) {
          lastFail = {
            label: options.label,
            attempt,
            engine: "csp",
            reason: "forward-check",
            detail: { slot: slotRef(otherSlot), pattern: patt },
          };
          ok = false;
          weights.set(other, (weights.get(other) ?? 1) + 1);
          break;
        }
      }

      if (!ok) { rejectForward++; }
      if (ok && backtrack(depth + 1)) return true;

      hist.forEach(([r, c, prev]) => (grid[r][c] = prev));
      if (options.uniqueWords) {
        const count = (usedWords.get(word) ?? 1) - 1;
        if (count <= 0) usedWords.delete(word);
        else usedWords.set(word, count);
      }
    }

    backtracks++;
    unfilled.add(slot.id);
    return false;
  }

  const solved = backtrack() ? grid.map(r => r.join("")) : null;
  if (!solved && options.onFail) {
    if (aborted && abortReason) {
      options.onFail({
        label: options.label,
        attempt,
        engine: "csp",
        reason: "aborted",
        detail: { limit: abortReason },
      });
    } else if (lastFail) {
      options.onFail(lastFail);
    } else {
      options.onFail({
        label: options.label,
        attempt,
        engine: "csp",
        reason: "no-solution",
      });
    }
  }
  return { solved, aborted };
}

/* ------------------ DLX solver (Algorithm X + colors) ---------------------- */

type DlxColumn = {
  name: string;
  size: number;
  left: DlxColumn;
  right: DlxColumn;
  up: DlxNode;
  down: DlxNode;
  primary: boolean;
  color: string | null;
  weight: number;
};

type DlxNode = {
  column: DlxColumn;
  left: DlxNode;
  right: DlxNode;
  up: DlxNode;
  down: DlxNode;
  rowId: number;
  color: string | null;
};

type DlxRow = { slotId: number; word: string };

type DlxAttemptResult = { solved: string[] | null; aborted: boolean };

function createColumn(name: string, primary: boolean): DlxColumn {
  const col = {
    name,
    size: 0,
    left: null as unknown as DlxColumn,
    right: null as unknown as DlxColumn,
    up: null as unknown as DlxNode,
    down: null as unknown as DlxNode,
    primary,
    color: null,
    weight: 1,
  };
  col.left = col;
  col.right = col;
  col.up = col as unknown as DlxNode;
  col.down = col as unknown as DlxNode;
  return col;
}

function linkColumn(header: DlxColumn, col: DlxColumn): void {
  col.right = header;
  col.left = header.left;
  header.left.right = col;
  header.left = col;
}

function cover(col: DlxColumn, debug = false): void {
  if (col.primary) {
    col.right.left = col.left;
    col.left.right = col.right;
  }
  for (let r = col.down; r !== (col as unknown as DlxNode); r = r.down) {
    for (let j = r.right; j !== r; j = j.right) {
      j.down.up = j.up;
      j.up.down = j.down;
      j.column.size--;
      if (debug && j.column.size < 0) {
        throw new Error(`DLX negative column size in cover: ${j.column.name} size=${j.column.size}`);
      }
    }
  }
}

function uncover(col: DlxColumn, debug = false): void {
  for (let r = col.up; r !== (col as unknown as DlxNode); r = r.up) {
    for (let j = r.left; j !== r; j = j.left) {
      j.column.size++;
      if (debug && j.column.size < 0) {
        throw new Error(`DLX negative column size in uncover: ${j.column.name} size=${j.column.size}`);
      }
      j.down.up = j;
      j.up.down = j;
    }
  }
  if (col.primary) {
    col.right.left = col;
    col.left.right = col;
  }
}

function purify(node: DlxNode, debug = false, removed?: DlxNode[]): boolean {
  if (!node.color) return false;
  const col = node.column;
  if (col.color !== null) return false;
  col.color = node.color;
  for (let r = col.down; r !== (col as unknown as DlxNode); r = r.down) {
    if (r.color !== col.color) {
      for (let j = r.right; j !== r; j = j.right) {
        if (j.down.up !== j || j.up.down !== j) continue;
        j.down.up = j.up;
        j.up.down = j.down;
        j.column.size--;
        if (removed) removed.push(j);
        if (debug && j.column.size < 0) {
          throw new Error(`DLX negative column size in purify: ${j.column.name} size=${j.column.size}`);
        }
      }
    }
  }
  return true;
}

function unpurify(node: DlxNode, removed?: DlxNode[], debug = false): void {
  if (!node.color) return;
  const col = node.column;
  if (col.color !== node.color) return;
  if (removed) {
    for (let i = removed.length - 1; i >= 0; i--) {
      const j = removed[i];
      j.column.size++;
      if (debug && j.column.size < 0) {
        throw new Error(`DLX negative column size in unpurify: ${j.column.name} size=${j.column.size}`);
      }
      j.down.up = j;
      j.up.down = j;
    }
  }
  col.color = null;
}

function runAttemptDlx(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options: ResolvedOptions,
  attempt: number
): DlxAttemptResult {
  const index = buildWordIndex(dict);
  const patternCache = new Map<string, string[]>();
  const { crosses, adjacency, intersectionCells } = buildCrossData(slots);
  const totalSlots = slots.length;
  const debugDlx = options.debugDlx ?? false;

  const header = createColumn("root", true);
  const slotCols = new Map<number, DlxColumn>();
  const cellCols = new Map<string, DlxColumn>();
  const wordCols = new Map<string, DlxColumn>();

  for (const slot of slots) {
    const col = createColumn(`slot:${slot.id}`, true);
    linkColumn(header, col);
    slotCols.set(slot.id, col);
  }

  for (const key of intersectionCells) {
    const col = createColumn(`cell:${key}`, false);
    cellCols.set(key, col);
  }

  const rows: DlxRow[] = [];

  function addRow(rowId: number, items: { col: DlxColumn; color: string | null }[]): void {
    const nodes: DlxNode[] = items.map(item => ({
      column: item.col,
      left: null as unknown as DlxNode,
      right: null as unknown as DlxNode,
      up: null as unknown as DlxNode,
      down: null as unknown as DlxNode,
      rowId,
      color: item.color,
    }));

    for (let i = 0; i < nodes.length; i++) {
      const prev = nodes[(i + nodes.length - 1) % nodes.length];
      const next = nodes[(i + 1) % nodes.length];
      nodes[i].left = prev;
      nodes[i].right = next;
    }

    for (const node of nodes) {
      const col = node.column;
      node.down = col as unknown as DlxNode;
      node.up = col.up;
      col.up.down = node;
      col.up = node;
      col.size++;
    }
  }

  function scoreWord(slotId: number, word: string): number {
    let score = 0;
    for (const { other, iSelf, iOther } of crosses[slotId]) {
      const otherSlot = slots[other];
      const base = otherSlot.cells.map(() => "." as GridCell);
      base[iOther] = word[iSelf] as GridCell;
      const patt = base.join("");
      const cand = getCandidates(patt, otherSlot.len, index, patternCache);
      if (cand.length === 0) return -1;
      score += cand.length;
    }
    return score;
  }

  for (const slot of slots) {
    const pattern = slot.cells.map(() => ".").join("");
    let candidates = getCandidates(pattern, slot.len, index, patternCache);
    if (options.lcv && candidates.length > 1) {
      const scored = candidates.map((w, i) => ({
        word: w,
        score: scoreWord(slot.id, w),
        tie: options.shuffle ? Math.random() : i,
      }));
      scored.sort((a, b) => (b.score - a.score) || (a.tie - b.tie));
      candidates = scored.map(s => s.word);
    } else if (options.shuffle && candidates.length > 1) {
      candidates = candidates.slice();
      shuffleInPlace(candidates);
    }

    for (const word of candidates) {
      const rowId = rows.length;
      rows.push({ slotId: slot.id, word });
      const items: { col: DlxColumn; color: string | null }[] = [];
      const slotCol = slotCols.get(slot.id)!;
      items.push({ col: slotCol, color: null });
      if (options.uniqueWords) {
        let wcol = wordCols.get(word);
        if (!wcol) {
          wcol = createColumn(`word:${word}`, false);
          wordCols.set(word, wcol);
        }
        items.push({ col: wcol, color: null });
      }
      slot.cells.forEach(([r, c], i) => {
        const key = `${r},${c}`;
        if (!cellCols.has(key)) return;
        items.push({ col: cellCols.get(key)!, color: word[i] });
      });
      addRow(rowId, items);
    }
  }

  let nodes = 0;
  let rejectIntersect = 0;
  const rejectForward = 0;
  let zeroPick = 0;
  let backtracks = 0;
  let abortReason: "maxMs" | "maxNodes" | null = null;
  let lastFail: SolveFailInfo | null = null;
  const startedAt = Date.now();
  let aborted = false;
  let nextLogAt = options.logEveryMs > 0 ? startedAt + options.logEveryMs : Number.POSITIVE_INFINITY;
  let nextLogNode = options.logEveryNodes > 0 ? options.logEveryNodes : Number.POSITIVE_INFINITY;
  let lastPick: SolveProgress["lastPick"];

  const solution: DlxNode[] = [];

  function maybeReport(depth: number, remaining: number): void {
    if (!options.onProgress) return;
    const now = Date.now();
    if (now < nextLogAt && nodes < nextLogNode) return;
    const elapsedMs = now - startedAt;
    const nodesPerSec = elapsedMs > 0 ? Math.round(nodes / (elapsedMs / 1000)) : nodes;
    options.onProgress({
      label: options.label,
      attempt,
      restarts: options.restarts,
      engine: "dlx",
      nodes,
      elapsedMs,
      nodesPerSec,
      unfilled: remaining,
      depth,
      lastPick,
      stats: { rejectIntersect, rejectForward, zeroPick, backtracks },
    });
    if (options.logEveryMs > 0) nextLogAt = now + options.logEveryMs;
    if (options.logEveryNodes > 0) nextLogNode = nodes + options.logEveryNodes;
  }

  function shouldAbort(): boolean {
    if (aborted) return true;
    if (options.maxMs !== undefined && Date.now() - startedAt >= options.maxMs) {
      abortReason = "maxMs";
      aborted = true;
      return true;
    }
    if (options.maxNodes !== undefined && nodes >= options.maxNodes) {
      abortReason = "maxNodes";
      aborted = true;
      return true;
    }
    return false;
  }

  const slotRef = (slot: Slot): NonNullable<SolveFailInfo["detail"]>["slot"] => ({
    id: slot.id,
    r: slot.r,
    c: slot.c,
    len: slot.len,
    dir: slot.dir.dr === 1 ? "down" : "right",
  });

  function parseColumn(col: DlxColumn): SolveFailInfo["detail"] {
    const name = col.name;
    if (name.startsWith("slot:")) {
      const id = Number(name.slice(5));
      const slot = slots.find((s) => s.id === id);
      return {
        column: {
          name,
          type: "slot",
          slot: slot ? slotRef(slot) : undefined,
        },
      };
    }
    if (name.startsWith("cell:")) {
      const coord = name.slice(5);
      const [rRaw, cRaw] = coord.split(",");
      const r = Number(rRaw);
      const c = Number(cRaw);
      return {
        column: {
          name,
          type: "cell",
          cell: Number.isFinite(r) && Number.isFinite(c) ? { r, c } : undefined,
        },
      };
    }
    if (name.startsWith("word:")) {
      const word = name.slice(5);
      return {
        column: {
          name,
          type: "word",
          word,
        },
      };
    }
    return { column: { name, type: "other" } };
  }

  function chooseColumn(): DlxColumn | null {
    let best: DlxColumn | null = null;
    let bestScore = Infinity;
    for (let c = header.right; c !== header; c = c.right) {
      const score = c.size / (c.weight || 1);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  function search(k: number): boolean {
    if (header.right === header) return true;
    if (shouldAbort()) return false;

    const col = chooseColumn();
    if (!col) return false;
    if (col.size === 0) {
      zeroPick++;
      lastFail = {
        label: options.label,
        attempt,
        engine: "dlx",
        reason: "zero-pick",
        detail: parseColumn(col),
      };
      return false;
    }
    cover(col, debugDlx);

    for (let r = col.down; r !== (col as unknown as DlxNode); r = r.down) {
      solution.push(r);
      nodes++;
      const slotId = rows[r.rowId]?.slotId ?? -1;
      const word = rows[r.rowId]?.word ?? "";
      lastPick = {
        id: slotId,
        len: word.length,
        degree: adjacency.get(slotId)?.size ?? 0,
        candidates: col.size,
        pattern: word,
      };
      maybeReport(k + 1, totalSlots - (k + 1));

      const purified: { node: DlxNode; removed: DlxNode[] }[] = [];
      let conflict = false;
      // 1) purify colored columns first to avoid double-removal
      for (let j = r.right; j !== r; j = j.right) {
        if (!j.color) continue;
        if (j.column.color && j.column.color !== j.color) {
          rejectIntersect++;
          conflict = true;
          break;
        }
        const removed: DlxNode[] = [];
        if (purify(j, debugDlx, removed)) purified.push({ node: j, removed });
      }

      if (conflict) {
        while (purified.length) {
          const item = purified.pop()!;
          unpurify(item.node, item.removed, debugDlx);
        }
        solution.pop();
        continue;
      }

      const covered: DlxColumn[] = [];
      // 2) cover non-colored columns after purify
      for (let j = r.right; j !== r; j = j.right) {
        if (j.color) continue;
        cover(j.column, debugDlx);
        covered.push(j.column);
      }

      if (!shouldAbort() && search(k + 1)) return true;

      while (covered.length) uncover(covered.pop()!, debugDlx);
      while (purified.length) {
        const item = purified.pop()!;
        unpurify(item.node, item.removed, debugDlx);
      }

      solution.pop();
    }

    backtracks++;
    col.weight += 1;
    uncover(col, debugDlx);
    return false;
  }

  const solved = search(0)
    ? (() => {
        const grid = initGrid(rawRows);
        for (const node of solution) {
          const { slotId, word } = rows[node.rowId];
          const slot = slots[slotId];
          slot.cells.forEach(([r, c], i) => {
            grid[r][c] = word[i] as Cell;
          });
        }
        return grid.map(r => r.join(""));
      })()
    : null;

  if (!solved && options.onFail) {
    if (aborted && abortReason) {
      options.onFail({
        label: options.label,
        attempt,
        engine: "dlx",
        reason: "aborted",
        detail: { limit: abortReason },
      });
    } else if (lastFail) {
      options.onFail(lastFail);
    } else {
      options.onFail({
        label: options.label,
        attempt,
        engine: "dlx",
        reason: "no-solution",
      });
    }
  }

  return { solved, aborted };
}

/* ------------------ orchestrator ------------------------------------------ */

export function solve(
  rawRows: string[],   // строки с '#↓→↘*'
  slots: Slot[],       // найденные в grid.ts
  dict: Dict,
  shuffleOrOptions: boolean | SolveOptions = false
): string[] | null {
  const optionsRaw =
    typeof shuffleOrOptions === "boolean" ? { shuffle: shuffleOrOptions, engine: "csp" as const } : shuffleOrOptions ?? {};

  const restartsRaw = optionsRaw.restarts;
  const restarts =
    Number.isFinite(restartsRaw) && restartsRaw && restartsRaw > 0 ? Math.floor(restartsRaw) : 1;
  const engine = optionsRaw.engine ?? "dlx";
  const shuffle = optionsRaw.shuffle ?? (restarts > 1);

  if (engine === "dlx" && optionsRaw.nativeDlx) {
    const nativeSolved = solveDlxNative(rawRows, slots, dict, optionsRaw);
    if (nativeSolved !== undefined) return nativeSolved;
  }

  const options: ResolvedOptions = {
    shuffle,
    lcv: optionsRaw.lcv ?? false,
    restarts,
    parallelRestarts: optionsRaw.parallelRestarts ?? 1,
    uniqueWords: optionsRaw.uniqueWords ?? true,
    engine,
    splitComponents: optionsRaw.splitComponents ?? true,
    nativeDlx: optionsRaw.nativeDlx ?? false,
    debugDlx: optionsRaw.debugDlx ?? false,
    maxMs: optionsRaw.maxMs,
    maxNodes: optionsRaw.maxNodes,
    logEveryMs: optionsRaw.logEveryMs ?? 0,
    logEveryNodes: optionsRaw.logEveryNodes ?? 0,
    label: optionsRaw.label,
    onProgress: optionsRaw.onProgress,
    onFail: optionsRaw.onFail,
  };

  const { adjacency } = buildCrossData(slots);
  const components = options.splitComponents ? buildComponents(slots, adjacency) : [slots.map(s => s.id)];

  for (let attempt = 1; attempt <= restarts; attempt++) {
    const grid = initGrid(rawRows);
    const usedGlobal = new Set<string>();
    let ok = true;

    for (const comp of components) {
      const { slots: subSlots } = remapSlots(slots, comp);
      let dictForComponent = dict;
      if (options.uniqueWords && usedGlobal.size > 0) {
        dictForComponent = new Map<number, string[]>();
        for (const [len, words] of dict) {
          const filtered = words.filter(w => !usedGlobal.has(w));
          dictForComponent.set(len, filtered);
        }
      }

      const result = options.engine === "dlx"
        ? runAttemptDlx(rawRows, subSlots, dictForComponent, options, attempt)
        : runAttemptCsp(rawRows, subSlots, dictForComponent, options, attempt);

      if (!result.solved) {
        ok = false;
        break;
      }

      // merge component solution into global grid + collect used words
      for (const slot of subSlots) {
        const word = slot.cells.map(([r, c]) => result.solved![r][c]).join("");
        if (options.uniqueWords) usedGlobal.add(word);
      }
      for (let r = 0; r < result.solved.length; r++) {
        const row = result.solved[r];
        for (let c = 0; c < row.length; c++) {
          const ch = row[c] as GridCell;
          if (ch !== EMPTY && ch !== "#") grid[r][c] = ch as Cell;
        }
      }
    }

    if (ok) return grid.map(r => r.join(""));
  }

  return null;
}
