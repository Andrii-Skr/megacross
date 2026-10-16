import type { Grid } from "../types";
import { buildSolverRows, slotsForSolver } from "./generator";

type LetterIndex = { letter: string; words: Uint32Array };
type LengthIndex = { words: string[]; ids: Map<string, number>; positions: LetterIndex[][]; full: Uint32Array };
const dictionaryIndexes = new WeakMap<ReadonlyMap<number, readonly string[]>, Map<number, LengthIndex>>();
function indexDictionary(dictionary: ReadonlyMap<number, readonly string[]>) {
  const cached = dictionaryIndexes.get(dictionary);
  if (cached) return cached;
  const index = new Map<number, LengthIndex>();
  for (const [length, source] of dictionary) {
    const words = [...new Set(source.filter((word) => word.length === length))];
    const blocks = Math.ceil(words.length / 32);
    const positions = Array.from({ length }, () => new Map<string, Uint32Array>());
    const full = new Uint32Array(blocks);
    const ids = new Map<string, number>();
    words.forEach((word, id) => {
      ids.set(word, id);
      full[id >>> 5] |= 1 << (id & 31);
      for (let offset = 0; offset < length; offset += 1) {
        let bits = positions[offset].get(word[offset]);
        if (!bits) { bits = new Uint32Array(blocks); positions[offset].set(word[offset], bits); }
        bits[id >>> 5] |= 1 << (id & 31);
      }
    });
    index.set(length, { words, ids, full, positions: positions.map((position) => [...position].map(([letter, bits]) => ({ letter, words: bits }))) });
  }
  dictionaryIndexes.set(dictionary, index);
  return index;
}
function popcount(value: number): number {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Sound AC-3 plus singleton uniqueness; only the full solver proves a fill.
 * Word domains use bitsets, and immutable dictionary indexes are reused between candidates.
 */
export function analyzeFillability(grid: Grid, dictionary: ReadonlyMap<number, readonly string[]>, maxOperations = 20_000_000) {
  const slots = slotsForSolver(grid);
  const index = indexDictionary(dictionary);
  const lengths = slots.map((slot) => index.get(slot.len));
  const domains = lengths.map((entry) => entry?.full.slice() ?? new Uint32Array());
  const sizes = lengths.map((entry) => entry?.words.length ?? 0);
  const fixedRows = buildSolverRows(grid).map((row) => [...row]);
  const versions = slots.map(() => 0);
  const supports = slots.map(() => new Map<number, { version: number; letters: Set<string> }>());
  const membership = new Map<number, Array<{ slot: number; offset: number }>>();
  slots.forEach((slot, id) => slot.cells.forEach(([r, c], offset) => {
    const key = r * grid.cols + c;
    const members = membership.get(key) ?? [];
    members.push({ slot: id, offset });
    membership.set(key, members);
  }));
  const arcs: Array<{ from: number; to: number; fromOffset: number; toOffset: number }> = [];
  for (const members of membership.values()) for (const a of members) for (const b of members) if (a.slot !== b.slot) arcs.push({ from: a.slot, to: b.slot, fromOffset: a.offset, toOffset: b.offset });
  const incoming = slots.map(() => [] as number[]);
  arcs.forEach((arc, id) => incoming[arc.to].push(id));
  const queue = arcs.map((_, id) => id);
  const pending = new Uint8Array(arcs.length).fill(1);
  let operations = 0;
  let converged = true;
  const singletonQueue = slots.flatMap((_, id) => sizes[id] === 1 ? [id] : []);
  const singletonWords = new Set<string>();
  let singletonCursor = 0;
  const failure = (slot: number) => ({ feasible: false, converged: true, constrainedShare: 1, bottleneckSlots: [slot], operations, fixedRows: fixedRows.map((row) => row.join("")) });
  const empty = sizes.indexOf(0);
  if (empty >= 0) return failure(empty);
  const changed = (slot: number) => {
    versions[slot] += 1;
    for (const next of incoming[slot]) if (!pending[next]) { queue.push(next); pending[next] = 1; }
    if (sizes[slot] === 1) singletonQueue.push(slot);
  };
  const lettersAt = (slot: number, offset: number) => {
    const cached = supports[slot].get(offset);
    if (cached?.version === versions[slot]) return cached.letters;
    const letters = new Set<string>();
    for (const entry of lengths[slot]!.positions[offset]) {
      for (let block = 0; block < domains[slot].length; block += 1) {
        operations += 1;
        if (domains[slot][block] & entry.words[block]) { letters.add(entry.letter); break; }
      }
    }
    supports[slot].set(offset, { version: versions[slot], letters });
    return letters;
  };
  let cursor = 0;
  while (cursor < queue.length || singletonCursor < singletonQueue.length) {
    if (operations >= maxOperations) { converged = false; break; }
    if (singletonCursor < singletonQueue.length) {
      const owner = singletonQueue[singletonCursor++];
      const block = domains[owner].findIndex((bits) => bits !== 0);
      const wordId = block * 32 + 31 - Math.clz32(domains[owner][block]);
      const word = lengths[owner]!.words[wordId];
      if (singletonWords.has(word)) continue;
      singletonWords.add(word);
      for (let slot = 0; slot < slots.length; slot += 1) {
        if (slot === owner || slots[slot].len !== word.length) continue;
        const id = lengths[slot]!.ids.get(word)!;
        const blockId = id >>> 5; const bit = 1 << (id & 31);
        operations += 1;
        if (!(domains[slot][blockId] & bit)) continue;
        domains[slot][blockId] &= ~bit;
        sizes[slot] -= 1;
        if (!sizes[slot]) return failure(slot);
        changed(slot);
      }
      continue;
    }
    const id = queue[cursor++]; pending[id] = 0;
    const arc = arcs[id];
    const supported = lettersAt(arc.to, arc.toOffset);
    const entries = lengths[arc.from]!.positions[arc.fromOffset];
    // All letters supported: the domain cannot change, so avoid allocating a union.
    if (entries.every((entry) => supported.has(entry.letter))) continue;
    const allowed = new Uint32Array(domains[arc.from].length);
    for (const entry of entries) if (supported.has(entry.letter)) {
      for (let block = 0; block < allowed.length; block += 1) { allowed[block] |= entry.words[block]; operations += 1; }
    }
    let size = 0;
    for (let block = 0; block < allowed.length; block += 1) {
      domains[arc.from][block] &= allowed[block];
      size += popcount(domains[arc.from][block]);
      operations += 1;
    }
    if (size === sizes[arc.from]) continue;
    sizes[arc.from] = size;
    if (!size) return failure(arc.from);
    changed(arc.from);
  }
  slots.forEach((slot, id) => slot.cells.forEach(([r, c], offset) => {
    const letters = lettersAt(id, offset);
    if (letters.size === 1) fixedRows[r][c] = letters.values().next().value!;
  }));
  const bottleneckSlots = sizes.flatMap((size, id) => size < 10 ? [id] : []);
  return { feasible: true, converged, constrainedShare: bottleneckSlots.length / Math.max(1, slots.length), bottleneckSlots, operations, fixedRows: fixedRows.map((row) => row.join("")) };
}
