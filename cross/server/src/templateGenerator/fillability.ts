import type { Grid } from "../types";
import { buildSolverRows, slotsForSolver } from "./generator";

/** AC-3 rejects impossible crossing domains; only the full solver proves a fill. */
export function analyzeFillability(grid: Grid, dictionary: ReadonlyMap<number, readonly string[]>) {
  const slots = slotsForSolver(grid);
  const domains = slots.map((slot) => [...(dictionary.get(slot.len) ?? [])]);
  const fixedRows = buildSolverRows(grid).map((row) => [...row]);
  const versions = slots.map(() => 0);
  const supports = slots.map(() => new Map<number, { version: number; letters: Set<string> }>());
  const membership = new Map<string, Array<{ slot: number; offset: number }>>();
  slots.forEach((slot, id) => slot.cells.forEach(([r, c], offset) => {
    const key = `${r},${c}`;
    membership.set(key, [...(membership.get(key) ?? []), { slot: id, offset }]);
  }));
  const arcs: Array<{ from: number; to: number; fromOffset: number; toOffset: number }> = [];
  for (const members of membership.values()) for (const a of members) for (const b of members) if (a.slot !== b.slot) arcs.push({ from: a.slot, to: b.slot, fromOffset: a.offset, toOffset: b.offset });
  const incoming = slots.map(() => [] as number[]);
  arcs.forEach((arc, id) => incoming[arc.to].push(id));
  const queue = arcs.map((_, id) => id);
  const pending = new Set(queue);
  let operations = 0;
  let converged = true;
  const singletonQueue = slots.flatMap((_, id) => domains[id].length === 1 ? [id] : []);
  const singletonWords = new Set<string>();
  let singletonCursor = 0;
  const failure = (slot: number) => ({ feasible: false, converged: true, constrainedShare: 1, bottleneckSlots: [slot], operations, fixedRows: fixedRows.map((row) => row.join("")) });
  const changed = (slot: number) => {
    versions[slot] += 1;
    for (const next of incoming[slot]) if (!pending.has(next)) { queue.push(next); pending.add(next); }
    if (domains[slot].length === 1) singletonQueue.push(slot);
  };
  let cursor = 0;
  while (cursor < queue.length || singletonCursor < singletonQueue.length) {
    if (operations > 5_000_000) { converged = false; break; }
    if (singletonCursor < singletonQueue.length) {
      const owner = singletonQueue[singletonCursor++];
      const word = domains[owner][0];
      if (singletonWords.has(word)) continue;
      singletonWords.add(word);
      for (let slot = 0; slot < slots.length; slot += 1) {
        if (slot === owner || slots[slot].len !== word.length) continue;
        operations += domains[slot].length;
        const filtered = domains[slot].filter((candidate) => candidate !== word);
        if (filtered.length === domains[slot].length) continue;
        domains[slot] = filtered;
        if (!filtered.length) return failure(slot);
        changed(slot);
      }
      continue;
    }
    const id = queue[cursor++]; pending.delete(id);
    const arc = arcs[id];
    let cached = supports[arc.to].get(arc.toOffset);
    if (!cached || cached.version !== versions[arc.to]) {
      cached = { version: versions[arc.to], letters: new Set(domains[arc.to].map((word) => word[arc.toOffset])) };
      supports[arc.to].set(arc.toOffset, cached);
      operations += domains[arc.to].length;
    }
    const supported = cached.letters;
    operations += domains[arc.from].length;
    const filtered = domains[arc.from].filter((word) => supported.has(word[arc.fromOffset]));
    if (filtered.length === domains[arc.from].length) continue;
    domains[arc.from] = filtered;
    if (!filtered.length) return failure(arc.from);
    changed(arc.from);
  }
  slots.forEach((slot, id) => slot.cells.forEach(([r, c], offset) => {
    const first = domains[id][0]?.[offset];
    if (first && domains[id].every((word) => word[offset] === first)) fixedRows[r][c] = first;
  }));
  const bottleneckSlots = domains.flatMap((domain, id) => domain.length < 10 ? [id] : []);
  return { feasible: domains.every((domain) => domain.length > 0), converged, constrainedShare: bottleneckSlots.length / Math.max(1, slots.length), bottleneckSlots, operations, fixedRows: fixedRows.map((row) => row.join("")) };
}
