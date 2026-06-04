import type { TemplateEntry } from "./fillJobTemplateService";

export type FillTemplateSetupFixedSlot = {
  slotId: number;
  wordId: string;
  word: string;
};

export type FillTemplateSetup = {
  templateKey: string;
  keyword: string | null;
  fixedSlots: FillTemplateSetupFixedSlot[];
};

export type FillTemplateKeywordCell = {
  row: number;
  col: number;
  index: number;
  sourceSlotId?: number;
  sourceIndex?: number;
  sourceLen?: number;
};

export type FillTemplateKeywordPlacement = {
  letters: Map<string, string>;
  cells: FillTemplateKeywordCell[];
};

export type FindKeywordPlacementOptions = {
  shuffle?: boolean;
};

export type ResolvedTemplateSetup = {
  templateKey: string;
  keyword: string | null;
  fixedSlots: FillTemplateSetupFixedSlot[];
  fixedLetters: Map<string, string>;
};

type SlotImpact = {
  slotId: number;
  index: number;
  len: number;
};

type CandidateCell = {
  row: number;
  col: number;
  key: string;
  impacts: SlotImpact[];
  rowBand: number;
  colBand: number;
  zoneKey: string;
  edgeDistance: number;
  isEdge: boolean;
  isWeak: boolean;
};

type CandidateAssignment = {
  cell: CandidateCell;
  sourceImpact: SlotImpact;
  baseScore: number;
};

function normalizeWord(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeKeyword(value: string | null | undefined): string | null {
  const normalized = normalizeWord(value);
  if (!normalized) return null;
  return /^[\p{L}]+$/u.test(normalized) ? normalized : null;
}

function normalizeFixedSlot(value: unknown): FillTemplateSetupFixedSlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { slotId?: unknown; wordId?: unknown; word?: unknown };
  const slotId = typeof raw.slotId === "number" ? raw.slotId : Number(raw.slotId);
  const wordId = typeof raw.wordId === "string" ? raw.wordId.trim() : "";
  const word = typeof raw.word === "string" ? normalizeWord(raw.word) : "";
  if (!Number.isFinite(slotId) || slotId < 0 || !wordId || !word) return null;
  return {
    slotId: Math.trunc(slotId),
    wordId,
    word,
  };
}

function normalizeTemplateSetup(value: unknown): FillTemplateSetup | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { templateKey?: unknown; keyword?: unknown; fixedSlots?: unknown };
  const templateKey = typeof raw.templateKey === "string" ? raw.templateKey.trim() : "";
  if (!templateKey) return null;
  const bySlotId = new Map<number, FillTemplateSetupFixedSlot>();
  if (Array.isArray(raw.fixedSlots)) {
    for (const item of raw.fixedSlots) {
      const normalized = normalizeFixedSlot(item);
      if (!normalized) continue;
      bySlotId.set(normalized.slotId, normalized);
    }
  }
  return {
    templateKey,
    keyword: normalizeKeyword(typeof raw.keyword === "string" ? raw.keyword : null),
    fixedSlots: [...bySlotId.values()].sort((a, b) => a.slotId - b.slotId),
  };
}

export function parseTemplateSetupPayload(value: unknown): FillTemplateSetup[] {
  if (!value) return [];
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!raw || typeof raw !== "object") return [];
  const templates = Array.isArray((raw as { templates?: unknown }).templates)
    ? ((raw as { templates: unknown[] }).templates ?? [])
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const byKey = new Map<string, FillTemplateSetup>();
  for (const item of templates) {
    const normalized = normalizeTemplateSetup(item);
    if (!normalized) continue;
    if (!normalized.keyword && normalized.fixedSlots.length === 0) continue;
    byKey.set(normalized.templateKey, normalized);
  }
  return [...byKey.values()].sort((a, b) => a.templateKey.localeCompare(b.templateKey));
}

export function buildTemplateSetupMap(value: unknown, validKeys?: Set<string>): Map<string, FillTemplateSetup> {
  const map = new Map<string, FillTemplateSetup>();
  for (const template of parseTemplateSetupPayload(value)) {
    if (validKeys && !validKeys.has(template.templateKey)) continue;
    map.set(template.templateKey, template);
  }
  return map;
}

function matchesMask(word: string, mask: string[]): boolean {
  if (word.length !== mask.length) return false;
  for (let index = 0; index < mask.length; index += 1) {
    const required = mask[index];
    if (required !== "." && required !== word[index]) return false;
  }
  return true;
}

export function resolveTemplateSetupForEntry(
  entry: TemplateEntry,
  dict: Map<number, string[]>,
  templateSetup: FillTemplateSetup | null | undefined,
): { resolved: ResolvedTemplateSetup; errors: string[] } {
  const fixedLetters = new Map<string, string>();
  const errors: string[] = [];
  const slotById = new Map(entry.slots.map((slot) => [slot.id, slot]));
  const fixedSlots: FillTemplateSetupFixedSlot[] = [];

  for (const fixedSlot of templateSetup?.fixedSlots ?? []) {
    const slot = slotById.get(fixedSlot.slotId);
    if (!slot) {
      errors.push(`Template ${entry.name}: fixed slot ${fixedSlot.slotId} was not found`);
      continue;
    }
    const word = normalizeWord(fixedSlot.word);
    if (word.length !== slot.len) {
      errors.push(`Template ${entry.name}: fixed word ${word} does not match slot length ${slot.len}`);
      continue;
    }
    const candidates = dict.get(slot.len) ?? [];
    if (!candidates.includes(word)) {
      errors.push(`Template ${entry.name}: fixed word ${word} is not available in dictionary`);
      continue;
    }
    let conflict = false;
    for (let index = 0; index < slot.cells.length; index += 1) {
      const [row, col] = slot.cells[index];
      const key = `${row},${col}`;
      const letter = word[index] ?? "";
      const current = fixedLetters.get(key);
      if (current && current !== letter) {
        errors.push(`Template ${entry.name}: fixed words conflict at cell (${row},${col})`);
        conflict = true;
        break;
      }
      fixedLetters.set(key, letter);
    }
    if (!conflict) {
      fixedSlots.push({
        slotId: fixedSlot.slotId,
        wordId: fixedSlot.wordId,
        word,
      });
    }
  }

  return {
    resolved: {
      templateKey: templateSetup?.templateKey ?? entry.key,
      keyword: normalizeKeyword(templateSetup?.keyword ?? null),
      fixedSlots,
      fixedLetters,
    },
    errors,
  };
}

export function buildSolveRows(rawRows: string[], fixedLetters: Map<string, string>): string[] {
  if (!fixedLetters.size) return rawRows;
  return rawRows.map((row, rowIndex) => {
    const chars = Array.from(row);
    for (let colIndex = 0; colIndex < chars.length; colIndex += 1) {
      const letter = fixedLetters.get(`${rowIndex},${colIndex}`);
      if (letter) chars[colIndex] = letter;
    }
    return chars.join("");
  });
}

function resolveBand(index: number, size: number): number {
  if (size <= 1) return 0;
  const raw = Math.floor((index * 3) / size);
  return Math.max(0, Math.min(2, raw));
}

function buildCandidateCells(entry: TemplateEntry): CandidateCell[] {
  const byCell = new Map<string, CandidateCell>();
  const maxRow = Math.max(0, entry.grid.rows - 1);
  const maxCol = Math.max(0, entry.grid.cols - 1);
  for (const slot of entry.slots) {
    slot.cells.forEach(([row, col], index) => {
      const rawCell = entry.grid.data[row]?.[col];
      if (rawCell === "↓" || rawCell === "→" || rawCell === "↘") {
        return;
      }
      const isCorner =
        (row === 0 || row === maxRow) &&
        (col === 0 || col === maxCol);
      if (isCorner) {
        return;
      }
      const key = `${row},${col}`;
      const current = byCell.get(key) ?? {
        row,
        col,
        key,
        impacts: [],
        rowBand: resolveBand(row, entry.grid.rows),
        colBand: resolveBand(col, entry.grid.cols),
        zoneKey: `${resolveBand(row, entry.grid.rows)}:${resolveBand(col, entry.grid.cols)}`,
        edgeDistance: Math.min(row, maxRow - row, col, maxCol - col),
        isEdge: row === 0 || row === maxRow || col === 0 || col === maxCol,
        isWeak: false,
      };
      current.impacts.push({ slotId: slot.id, index, len: slot.len });
      current.isWeak = current.impacts.length < 2;
      byCell.set(key, current);
    });
  }
  return [...byCell.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

function countDistinctSourceSlots(assignments: CandidateAssignment[]): number {
  return new Set(assignments.map((assignment) => assignment.sourceImpact.slotId)).size;
}

function countDistinctCells(assignments: CandidateAssignment[]): number {
  return new Set(assignments.map((assignment) => assignment.cell.key)).size;
}

function buildCandidateAssignments(entry: TemplateEntry, cells: CandidateCell[], keywordLength: number): CandidateAssignment[] {
  const allAssignments: CandidateAssignment[] = [];
  for (const cell of cells) {
    for (const impact of cell.impacts) {
      let baseScore = 0;
      baseScore += Math.min(3, cell.edgeDistance) * 18;
      baseScore += cell.impacts.length >= 2 ? 80 : -30;
      baseScore += cell.isEdge ? -18 : 12;
      baseScore += Math.max(0, impact.len - 3);
      allAssignments.push({
        cell,
        sourceImpact: impact,
        baseScore,
      });
    }
  }
  const strongAssignments = allAssignments.filter((assignment) =>
    assignment.cell.impacts.length >= 2 &&
    assignment.cell.edgeDistance >= 1 &&
    !assignment.cell.isEdge,
  );
  if (
    countDistinctSourceSlots(strongAssignments) >= keywordLength &&
    countDistinctCells(strongAssignments) >= keywordLength
  ) {
    return strongAssignments;
  }
  const intersectingAssignments = allAssignments.filter((assignment) => assignment.cell.impacts.length >= 2);
  if (
    countDistinctSourceSlots(intersectingAssignments) >= keywordLength &&
    countDistinctCells(intersectingAssignments) >= keywordLength
  ) {
    return intersectingAssignments;
  }
  return allAssignments;
}

function scoreCandidateAssignment(
  assignment: CandidateAssignment,
  selected: FillTemplateKeywordCell[],
  zoneUsage: Map<string, number>,
  rowBandUsage: Map<number, number>,
  colBandUsage: Map<number, number>,
): number {
  const { cell } = assignment;
  let score = assignment.baseScore;
  const zoneCount = zoneUsage.get(cell.zoneKey) ?? 0;
  score += zoneCount === 0 ? 42 : -36 * zoneCount;
  const rowBandCount = rowBandUsage.get(cell.rowBand) ?? 0;
  const colBandCount = colBandUsage.get(cell.colBand) ?? 0;
  score += rowBandCount === 0 ? 14 : -10 * rowBandCount;
  score += colBandCount === 0 ? 14 : -10 * colBandCount;
  if (selected.length > 0) {
    let minDistance = Number.POSITIVE_INFINITY;
    for (const item of selected) {
      const distance = Math.abs(item.row - cell.row) + Math.abs(item.col - cell.col);
      if (distance < minDistance) minDistance = distance;
    }
    if (Number.isFinite(minDistance)) {
      score += Math.min(8, minDistance) * 7;
      if (minDistance <= 2) score -= 60;
      else if (minDistance <= 4) score -= 24;
    }
  }
  return score;
}

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = items[index];
    items[index] = items[swapIndex] as T;
    items[swapIndex] = current as T;
  }
}

export function findKeywordPlacements(
  entry: TemplateEntry,
  dict: Map<number, string[]>,
  baseLetters: Map<string, string>,
  keyword: string | null | undefined,
  maxPlacements = 128,
  options: FindKeywordPlacementOptions = {},
): { placements: FillTemplateKeywordPlacement[] } | { error: string } {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return { placements: [{ letters: new Map(baseLetters), cells: [] }] };
  }

  const slotById = new Map(entry.slots.map((slot) => [slot.id, slot]));
  const slotMasks = new Map<number, string[]>();
  for (const slot of entry.slots) {
    const mask = Array.from({ length: slot.len }, () => ".");
    slot.cells.forEach(([row, col], index) => {
      const letter = baseLetters.get(`${row},${col}`);
      if (letter) mask[index] = letter;
    });
    slotMasks.set(slot.id, mask);
    if (!(dict.get(slot.len) ?? []).some((word) => matchesMask(word, mask))) {
      return { error: `Template ${entry.name}: fixed letters make slot ${slot.id} unsatisfiable` };
    }
  }

  const candidateCells = buildCandidateCells(entry);
  if (normalizedKeyword.length > candidateCells.length) {
    return { error: `Template ${entry.name}: keyword ${normalizedKeyword} is longer than available letter cells` };
  }
  const candidateAssignments = buildCandidateAssignments(entry, candidateCells, normalizedKeyword.length);
  if (countDistinctSourceSlots(candidateAssignments) < normalizedKeyword.length) {
    return { error: `Template ${entry.name}: keyword ${normalizedKeyword} requires ${normalizedKeyword.length} distinct source words` };
  }

  const cache = new Map<string, boolean>();
  const usedCells = new Set<string>();
  const usedSourceSlots = new Set<number>();
  const selected: FillTemplateKeywordCell[] = [];
  const chosenLetters = new Map<string, string>(baseLetters);
  const placements: FillTemplateKeywordPlacement[] = [];
  const placementLimit = Number.isFinite(maxPlacements) && maxPlacements > 0 ? Math.floor(maxPlacements) : 128;
  const zoneUsage = new Map<string, number>();
  const rowBandUsage = new Map<number, number>();
  const colBandUsage = new Map<number, number>();
  const shuffleEnabled = options.shuffle === true;

  const maskHasCandidate = (slotId: number) => {
    const slot = slotById.get(slotId);
    if (!slot) return false;
    const mask = slotMasks.get(slotId) ?? [];
    const cacheKey = `${slot.len}:${mask.join("")}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = (dict.get(slot.len) ?? []).some((word) => matchesMask(word, mask));
    cache.set(cacheKey, result);
    return result;
  };

  const tryAssign = (
    assignment: CandidateAssignment,
    letter: string,
  ): Array<{ slotId: number; index: number; previous: string }> | null => {
    const { cell, sourceImpact } = assignment;
    if (usedCells.has(cell.key)) return null;
    if (usedSourceSlots.has(sourceImpact.slotId)) return null;
    const previousCellLetter = chosenLetters.get(cell.key);
    if (previousCellLetter && previousCellLetter !== letter) return null;

    const changes: Array<{ slotId: number; index: number; previous: string }> = [];
    const touched = new Set<number>();
    for (const impact of cell.impacts) {
      const mask = slotMasks.get(impact.slotId);
      if (!mask) return null;
      const previous = mask[impact.index] ?? ".";
      if (previous !== "." && previous !== letter) {
        for (const change of changes) {
          const revertMask = slotMasks.get(change.slotId);
          if (revertMask) revertMask[change.index] = change.previous;
        }
        return null;
      }
      if (previous === letter) {
        touched.add(impact.slotId);
        continue;
      }
      mask[impact.index] = letter;
      changes.push({ slotId: impact.slotId, index: impact.index, previous });
      touched.add(impact.slotId);
    }

    for (const slotId of touched) {
      if (!maskHasCandidate(slotId)) {
        for (const change of changes) {
          const revertMask = slotMasks.get(change.slotId);
          if (revertMask) revertMask[change.index] = change.previous;
        }
        return null;
      }
    }

    usedCells.add(cell.key);
    usedSourceSlots.add(sourceImpact.slotId);
    chosenLetters.set(cell.key, letter);
    return changes;
  };

  const revertAssign = (
    assignment: CandidateAssignment,
    changes: Array<{ slotId: number; index: number; previous: string }>,
    previousCellLetter?: string,
  ) => {
    const { cell, sourceImpact } = assignment;
    for (const change of changes) {
      const mask = slotMasks.get(change.slotId);
      if (mask) mask[change.index] = change.previous;
    }
    usedCells.delete(cell.key);
    usedSourceSlots.delete(sourceImpact.slotId);
    if (previousCellLetter) chosenLetters.set(cell.key, previousCellLetter);
    else chosenLetters.delete(cell.key);
  };

  const search = (keywordIndex: number): boolean => {
    if (keywordIndex >= normalizedKeyword.length) {
      placements.push({
        letters: new Map(chosenLetters),
        cells: [...selected],
      });
      return placements.length >= placementLimit;
    }
    const targetLetter = normalizedKeyword[keywordIndex] ?? "";
    const orderedAssignments = [...candidateAssignments]
      .filter((assignment) => !usedCells.has(assignment.cell.key) && !usedSourceSlots.has(assignment.sourceImpact.slotId))
      .map((assignment) => ({
        assignment,
        score: scoreCandidateAssignment(assignment, selected, zoneUsage, rowBandUsage, colBandUsage),
      }))
      .sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (scoreDiff !== 0) return scoreDiff;
        if (left.assignment.cell.row !== right.assignment.cell.row) {
          return left.assignment.cell.row - right.assignment.cell.row;
        }
        if (left.assignment.cell.col !== right.assignment.cell.col) {
          return left.assignment.cell.col - right.assignment.cell.col;
        }
        return left.assignment.sourceImpact.slotId - right.assignment.sourceImpact.slotId;
      });
    if (shuffleEnabled && orderedAssignments.length > 1) {
      const topScore = orderedAssignments[0]?.score ?? 0;
      let prefixLength = 0;
      while (
        prefixLength < orderedAssignments.length &&
        prefixLength < 12 &&
        topScore - (orderedAssignments[prefixLength]?.score ?? topScore) <= 24
      ) {
        prefixLength += 1;
      }
      if (prefixLength > 1) {
        const prefix = orderedAssignments.slice(0, prefixLength);
        shuffleInPlace(prefix);
        orderedAssignments.splice(0, prefixLength, ...prefix);
      }
    }
    for (const candidate of orderedAssignments) {
      const assignment = candidate.assignment;
      const previousCellLetter = chosenLetters.get(assignment.cell.key);
      const changes = tryAssign(assignment, targetLetter);
      if (!changes) continue;
      selected.push({
        row: assignment.cell.row,
        col: assignment.cell.col,
        index: keywordIndex,
        sourceSlotId: assignment.sourceImpact.slotId,
        sourceIndex: assignment.sourceImpact.index,
        sourceLen: assignment.sourceImpact.len,
      });
      zoneUsage.set(assignment.cell.zoneKey, (zoneUsage.get(assignment.cell.zoneKey) ?? 0) + 1);
      rowBandUsage.set(assignment.cell.rowBand, (rowBandUsage.get(assignment.cell.rowBand) ?? 0) + 1);
      colBandUsage.set(assignment.cell.colBand, (colBandUsage.get(assignment.cell.colBand) ?? 0) + 1);
      if (search(keywordIndex + 1)) return true;
      const zoneCount = (zoneUsage.get(assignment.cell.zoneKey) ?? 1) - 1;
      if (zoneCount <= 0) zoneUsage.delete(assignment.cell.zoneKey);
      else zoneUsage.set(assignment.cell.zoneKey, zoneCount);
      const rowBandCount = (rowBandUsage.get(assignment.cell.rowBand) ?? 1) - 1;
      if (rowBandCount <= 0) rowBandUsage.delete(assignment.cell.rowBand);
      else rowBandUsage.set(assignment.cell.rowBand, rowBandCount);
      const colBandCount = (colBandUsage.get(assignment.cell.colBand) ?? 1) - 1;
      if (colBandCount <= 0) colBandUsage.delete(assignment.cell.colBand);
      else colBandUsage.set(assignment.cell.colBand, colBandCount);
      selected.pop();
      revertAssign(assignment, changes, previousCellLetter);
    }
    return false;
  };

  search(0);
  if (!placements.length) {
    return { error: `Template ${entry.name}: keyword ${normalizedKeyword} cannot be embedded into the template` };
  }

  return { placements };
}

export function findKeywordPlacement(
  entry: TemplateEntry,
  dict: Map<number, string[]>,
  baseLetters: Map<string, string>,
  keyword: string | null | undefined,
  options: FindKeywordPlacementOptions = {},
): FillTemplateKeywordPlacement | { error: string } {
  const placementsResult = findKeywordPlacements(entry, dict, baseLetters, keyword, 1, options);
  if ("error" in placementsResult) return placementsResult;
  return (
    placementsResult.placements[0] ?? {
      letters: new Map(baseLetters),
      cells: [],
    }
  );
}
