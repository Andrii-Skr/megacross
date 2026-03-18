import { existsSync } from "node:fs";
import path from "node:path";
import { parseFsh } from "../utils/parseFsh";
import { scanSlotsDetailed, type SlotStart, validate } from "../utils/grid";
import type { Grid, Slot } from "../types";

export type SnapshotFile = {
  name: string;
  key?: string;
  size?: number;
};

export type ResolvedTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  path?: string;
};

export type TemplateStats = {
  slots: number;
  letters: number;
  uniqueCells: number;
  intersections: number;
  density: number;
  maxDegree: number;
  avgDegree: number;
  degreeSqSum: number;
  pressure?: number;
};

export type TemplateEntry = {
  key: string;
  path: string;
  name: string;
  sourceName: string;
  order: number;
  grid: Grid;
  slots: Slot[];
  startNumberBySlotId: Map<number, number>;
  startPositions: SlotStart[];
  lenCounts: Map<number, number>;
  stats: TemplateStats;
};

export type TemplateError = {
  key: string;
  name: string;
  error: string;
};

export type IssuePathContext = {
  editionCode: string;
  issueLabel: string;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

export function sanitizeName(name: string): string {
  const base = path
    .basename(name)
    .replace(/[\r\n\t]/g, " ")
    .trim();
  const normalized = base.normalize("NFC");
  const safe = normalized.replace(/[^\p{L}\p{N}\p{M}\-_. ]+/gu, "_");
  return safe.replace(/_{2,}/g, "_").replace(/ {2,}/g, " ");
}

export function normalizeTemplateDisplayName(name: string): string {
  const sanitized = sanitizeName(name);
  const ext = path.extname(sanitized);
  const base = ext ? sanitized.slice(0, -ext.length) : sanitized;
  return base || sanitized;
}

export function getSamplesDir(): string {
  return (
    process.env.CROSS_SAMPLES_DIR ||
    path.resolve(process.cwd(), "var/crosswords/sample")
  );
}

export function getSamplesDirForIssue(issue: IssuePathContext): string {
  const base = getSamplesDir();
  const editionDir = sanitizeName(issue.editionCode);
  const issueDir = sanitizeName(issue.issueLabel);
  return path.join(base, editionDir, issueDir);
}

export function getOutputDir(): string {
  return (
    process.env.CROSS_OUTPUT_DIR ||
    path.resolve(process.cwd(), "var/crosswords/out")
  );
}

export function buildLenCounts(slots: Slot[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const slot of slots) {
    counts.set(slot.len, (counts.get(slot.len) ?? 0) + 1);
  }
  return counts;
}

function analyzeTemplate(slots: Slot[]): TemplateStats {
  const cellUse = new Map<string, number>();
  const cellSlots = new Map<string, number[]>();
  const adjacency = new Map<number, Set<number>>();
  for (const slot of slots) {
    adjacency.set(slot.id, new Set());
  }
  let letters = 0;
  for (const slot of slots) {
    letters += slot.len;
    for (const [r, c] of slot.cells) {
      const key = `${r},${c}`;
      cellUse.set(key, (cellUse.get(key) ?? 0) + 1);
      const list = cellSlots.get(key);
      if (list) {
        list.push(slot.id);
      } else {
        cellSlots.set(key, [slot.id]);
      }
    }
  }
  let intersections = 0;
  for (const list of cellSlots.values()) {
    if (list.length > 1) {
      intersections += 1;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          adjacency.get(list[i])?.add(list[j]);
          adjacency.get(list[j])?.add(list[i]);
        }
      }
    }
  }
  const uniqueCells = cellUse.size;
  const density = uniqueCells ? intersections / uniqueCells : 0;
  const degrees = slots.map((slot) => adjacency.get(slot.id)?.size ?? 0);
  const maxDegree = degrees.length ? Math.max(...degrees) : 0;
  const avgDegree = degrees.length
    ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length
    : 0;
  const degreeSqSum = degrees.reduce((sum, d) => sum + d * d, 0);
  return {
    slots: slots.length,
    letters,
    uniqueCells,
    intersections,
    density,
    maxDegree,
    avgDegree,
    degreeSqSum,
  };
}

export function computePressure(lenCounts: Map<number, number>, dictCounts: Map<number, number>): number {
  let pressure = 0;
  for (const [len, need] of lenCounts) {
    const have = dictCounts.get(len) ?? 0;
    if (have <= 0) return Number.POSITIVE_INFINITY;
    pressure += need / have;
  }
  return pressure;
}

export function compareByComplexity(a: TemplateStats, b: TemplateStats): number {
  if (a.avgDegree !== b.avgDegree) return b.avgDegree - a.avgDegree;
  if (a.degreeSqSum !== b.degreeSqSum) return b.degreeSqSum - a.degreeSqSum;
  const ap = a.pressure ?? 0;
  const bp = b.pressure ?? 0;
  if (ap !== bp) {
    if (!Number.isFinite(ap)) return -1;
    if (!Number.isFinite(bp)) return 1;
    return bp - ap;
  }
  if (b.slots !== a.slots) return b.slots - a.slots;
  if (b.intersections !== a.intersections) return b.intersections - a.intersections;
  if (b.letters !== a.letters) return b.letters - a.letters;
  return 0;
}

function extractTemplateNumber(value: string): number | null {
  const match = value.trim().match(/^(\d{1,6})(?=\D|$)/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function resolveTemplatePageNumber(template: ResolvedTemplate): number {
  const fromName = extractTemplateNumber(template.name);
  if (fromName !== null) return fromName;
  const fromSource = extractTemplateNumber(template.sourceName);
  if (fromSource !== null) return fromSource;
  return template.order + 1;
}

function resolveSpreadIndex(page: number): number {
  return Math.floor((page - 1) / 2);
}

export function buildTemplateNeighbors(templates: ResolvedTemplate[]): Map<string, Set<string>> {
  const spreadByKey = new Map<string, number>();
  const keysBySpread = new Map<number, string[]>();

  for (const template of templates) {
    const spread = resolveSpreadIndex(resolveTemplatePageNumber(template));
    spreadByKey.set(template.key, spread);
    const list = keysBySpread.get(spread) ?? [];
    list.push(template.key);
    keysBySpread.set(spread, list);
  }

  const neighbors = new Map<string, Set<string>>();
  for (const template of templates) {
    const spread = spreadByKey.get(template.key);
    if (spread === undefined) continue;
    const set = new Set<string>();
    for (const candidateSpread of [spread - 1, spread, spread + 1]) {
      const keys = keysBySpread.get(candidateSpread);
      if (!keys) continue;
      for (const key of keys) {
        if (key !== template.key) set.add(key);
      }
    }
    neighbors.set(template.key, set);
  }
  return neighbors;
}

export function filterDictionaryByBlockedWords(
  dict: Map<number, string[]>,
  blockedWords: Set<string>
): Map<number, string[]> {
  if (!blockedWords.size) return dict;
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  if (!blocked.size) return dict;

  const filtered = new Map<number, string[]>();
  for (const [len, words] of dict) {
    filtered.set(
      len,
      words.filter((word) => !blocked.has(normalizeWordKey(word)))
    );
  }
  return filtered;
}

export function buildWordLengthLookup(dict: Map<number, string[]>): Map<string, number> {
  const byWord = new Map<string, number>();
  for (const [len, words] of dict) {
    for (const word of words) {
      const key = normalizeWordKey(word);
      if (!key || byWord.has(key)) continue;
      byWord.set(key, len);
    }
  }
  return byWord;
}

export function collectLengthDeficitsForBlockedWords(
  lenCounts: Map<number, number>,
  dict: Map<number, string[]>,
  blockedWords: Set<string>
): Set<number> {
  if (!lenCounts.size) return new Set<number>();
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  const deficits = new Set<number>();
  for (const [len, need] of lenCounts) {
    if (need <= 0) continue;
    const words = dict.get(len) ?? [];
    let available = 0;
    for (const word of words) {
      if (!blocked.has(normalizeWordKey(word))) available += 1;
    }
    if (available < need) deficits.add(len);
  }
  return deficits;
}

export function collectMostConstrainedLengthsForBlockedWords(
  lenCounts: Map<number, number>,
  dict: Map<number, string[]>,
  blockedWords: Set<string>,
  limit = 1
): Set<number> {
  if (!lenCounts.size || limit <= 0) return new Set<number>();
  const blocked = new Set<string>();
  for (const word of blockedWords) {
    const key = normalizeWordKey(word);
    if (key) blocked.add(key);
  }
  const ranked: Array<{ len: number; slack: number; available: number; need: number }> = [];
  for (const [len, need] of lenCounts) {
    if (need <= 0) continue;
    const words = dict.get(len) ?? [];
    let available = 0;
    for (const word of words) {
      if (!blocked.has(normalizeWordKey(word))) available += 1;
    }
    if (available <= 0) continue;
    ranked.push({
      len,
      slack: available - need,
      available,
      need,
    });
  }
  ranked.sort((a, b) => {
    if (a.slack !== b.slack) return a.slack - b.slack;
    if (a.available !== b.available) return a.available - b.available;
    if (a.need !== b.need) return b.need - a.need;
    return a.len - b.len;
  });
  return new Set<number>(ranked.slice(0, limit).map((item) => item.len));
}

export function buildAdaptiveBlockedWords(
  usedWords: Set<string>,
  usedWordCount: Map<string, number>,
  neighborBlockedWords: Set<string>,
  deficitLengths: Set<number>,
  wordLengthByWord: Map<string, number>,
  maxWordUses: number
): Set<string> {
  const blocked = new Set<string>(neighborBlockedWords);
  for (const [word, count] of usedWordCount) {
    if (count >= maxWordUses) blocked.add(word);
  }
  if (!deficitLengths.size) {
    for (const word of usedWords) blocked.add(word);
    return blocked;
  }
  for (const word of usedWords) {
    const count = usedWordCount.get(word) ?? 0;
    if (count >= maxWordUses) {
      blocked.add(word);
      continue;
    }
    const len = wordLengthByWord.get(word);
    if (typeof len === "number" && deficitLengths.has(len)) continue;
    blocked.add(word);
  }
  return blocked;
}

export function buildCappedBlockedWords(
  baseBlockedWords: Set<string>,
  usedWordCount: Map<string, number>,
  maxWordUses: number
): Set<string> {
  const blocked = new Set<string>(baseBlockedWords);
  for (const [word, count] of usedWordCount) {
    if (count >= maxWordUses) blocked.add(word);
  }
  return blocked;
}

export function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

export function buildInJobUsagePriority(
  usedWordCount: Map<string, number>,
  basePriority: Map<string, number> | undefined,
  repeatMultiplier: number
): Map<string, number> | undefined {
  if (!usedWordCount.size) return basePriority;
  const merged = basePriority ? new Map(basePriority) : new Map<string, number>();
  for (const [word, count] of usedWordCount) {
    if (count <= 0) continue;
    const current = merged.get(word) ?? 0;
    merged.set(word, current + count * repeatMultiplier);
  }
  return merged;
}

function buildSnapshotKey(file: SnapshotFile, order: number, seen: Map<string, number>): string {
  const base =
    (typeof file.key === "string" && file.key.trim().length > 0
      ? file.key.trim()
      : `${file.name}:${file.size ?? ""}`) || `${file.name}:${order}`;
  const next = (seen.get(base) ?? 0) + 1;
  seen.set(base, next);
  return next === 1 ? base : `${base}#${next}`;
}

export function resolveTemplatePaths(files: SnapshotFile[], samplesDir: string): ResolvedTemplate[] {
  const baseDir = path.resolve(samplesDir);
  const seen = new Map<string, number>();
  return files.map((file, idx) => {
    const key = buildSnapshotKey(file, idx, seen);
    const sourceName = file.name;
    const name = normalizeTemplateDisplayName(file.name);
    const sanitized = sanitizeName(file.name);
    const basenamed = path.basename(file.name);
    const candidates = [...new Set([sanitized, basenamed])].filter((candidate) => candidate.length > 0);
    const found = candidates
      .map((candidate) => path.resolve(baseDir, candidate))
      .filter((resolvedPath) => {
        const relative = path.relative(baseDir, resolvedPath);
        return !relative.startsWith("..") && !path.isAbsolute(relative);
      })
      .find((p) => existsSync(p));
    return {
      key,
      name,
      sourceName,
      order: idx,
      path: found,
    };
  });
}

export function buildEntries(templates: ResolvedTemplate[]): {
  entries: TemplateEntry[];
  lengths: number[];
  invalid: TemplateError[];
} {
  const entries: TemplateEntry[] = [];
  const invalid: TemplateError[] = [];
  const lengthsSet = new Set<number>();
  for (const template of templates) {
    if (!template.path) continue;
    const name = template.name;
    try {
      const grid = parseFsh(template.path);
      validate(grid);
      const slotScan = scanSlotsDetailed(grid);
      const slots = slotScan.slots;
      const lenCounts = buildLenCounts(slots);
      const stats = analyzeTemplate(slots);
      entries.push({
        key: template.key,
        path: template.path,
        name,
        sourceName: template.sourceName,
        order: template.order,
        grid,
        slots,
        startNumberBySlotId: slotScan.startNumberBySlotId,
        startPositions: slotScan.starts,
        lenCounts,
        stats,
      });
      for (const slot of slots) lengthsSet.add(slot.len);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid template";
      invalid.push({ key: template.key, name, error: msg });
    }
  }
  return { entries, lengths: [...lengthsSet], invalid };
}
