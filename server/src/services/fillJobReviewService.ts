import { buildClueLayouts } from "../utils/clues";
import type { SlotStart } from "../utils/grid";
import { DIRS, type Grid, type Slot } from "../types";

export type ReviewDefinitionOption = {
  opredId: string | null;
  text: string;
};

export type ReviewSlotIntersection = {
  slotId: number;
  index: number;
  otherIndex: number;
  row: number;
  col: number;
  letter: string;
};

export type ReviewStartPosition = SlotStart;

export type ReviewSlot = {
  slotId: number;
  r: number;
  c: number;
  dir: "down" | "right";
  len: number;
  cells: [number, number][];
  word: string;
  wordId: string | null;
  opredId: string | null;
  definition: string;
  definitionOptions: ReviewDefinitionOption[];
  intersections: ReviewSlotIntersection[];
  clueCell: { key: string; row: number; col: number } | null;
  startNumber: number | null;
};

export type ReviewClueGroup = {
  key: string;
  row: number;
  col: number;
  slotIds: number[];
  areaCellCount: number;
};

export type ReviewTemplate = {
  key: string;
  name: string;
  sourceName: string;
  order: number;
  path: string;
  language: string;
  langId: number | null;
  grid: Grid;
  slots: ReviewSlot[];
  clueGroups: ReviewClueGroup[];
  startPositions: ReviewStartPosition[];
};

export type FillReviewPayload = {
  version: 1;
  issue: {
    issueId: string;
    editionId: number;
    editionCode: string;
    issueLabel: string;
  };
  options: {
    style: "default" | "corel";
    writeCrw: boolean;
    usageStats: boolean;
  };
  templates: ReviewTemplate[];
};

export type ReviewWordSelection = {
  wordId: bigint;
  opredId: bigint | null;
  definition: string;
  definitions: Array<{
    opredId: bigint | null;
    text: string;
  }>;
};

export type ReviewTemplateEntry = {
  key: string;
  path: string;
  name: string;
  sourceName: string;
  order: number;
  grid: Grid;
  slots: Slot[];
  startNumberBySlotId: Map<number, number>;
  startPositions: ReviewStartPosition[];
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function slotDirName(slot: Slot): "down" | "right" {
  return slot.dir === DIRS.right ? "right" : "down";
}

export function parseReviewPayload(value: unknown): FillReviewPayload | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseReviewPayload(parsed);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const payload = value as Partial<FillReviewPayload>;
  if (!payload || payload.version !== 1) return null;
  if (!payload.issue || !payload.options || !Array.isArray(payload.templates)) return null;
  return payload as FillReviewPayload;
}

export function normalizeDefinitionText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeDefinitionKey(value: string | null | undefined): string {
  const normalized = normalizeDefinitionText(value);
  return normalized.toLocaleLowerCase("ru");
}

export function definitionSelectionBucket(text: string, usedDefinitions?: Set<string>): number {
  const key = normalizeDefinitionKey(text);
  const isUnique = !usedDefinitions?.has(key);
  if (!isUnique) return Number.POSITIVE_INFINITY;
  const isShort = normalizeDefinitionText(text).length < 30;
  if (isUnique && isShort) return 0;
  if (isUnique) return 1;
  return Number.POSITIVE_INFINITY;
}

function buildSlotIntersections(
  slots: Slot[],
  wordsBySlot: Map<number, string>
): Map<number, ReviewSlotIntersection[]> {
  const cellUsage = new Map<string, Array<{ slotId: number; index: number; row: number; col: number }>>();
  for (const slot of slots) {
    slot.cells.forEach(([row, col], index) => {
      const key = `${row},${col}`;
      const list = cellUsage.get(key) ?? [];
      list.push({ slotId: slot.id, index, row, col });
      cellUsage.set(key, list);
    });
  }

  const bySlot = new Map<number, ReviewSlotIntersection[]>();
  for (const list of cellUsage.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const left = list[i];
        const right = list[j];
        const leftWord = wordsBySlot.get(left.slotId) ?? "";
        const rightWord = wordsBySlot.get(right.slotId) ?? "";
        const leftLetter = leftWord[left.index] ?? "";
        const rightLetter = rightWord[right.index] ?? "";

        const leftList = bySlot.get(left.slotId) ?? [];
        leftList.push({
          slotId: right.slotId,
          index: left.index,
          otherIndex: right.index,
          row: left.row,
          col: left.col,
          letter: rightLetter || leftLetter,
        });
        bySlot.set(left.slotId, leftList);

        const rightList = bySlot.get(right.slotId) ?? [];
        rightList.push({
          slotId: left.slotId,
          index: right.index,
          otherIndex: left.index,
          row: right.row,
          col: right.col,
          letter: leftLetter || rightLetter,
        });
        bySlot.set(right.slotId, rightList);
      }
    }
  }

  for (const intersections of bySlot.values()) {
    intersections.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.slotId - b.slotId;
    });
  }
  return bySlot;
}

function buildClueLayoutDefinitions(
  wordsBySlot: Map<number, string>,
  selections: Map<string, ReviewWordSelection>,
  fallbackDefinitions: Map<string, string>
): Map<string, string> {
  const definitionsByWord = new Map<string, string>();
  for (const word of wordsBySlot.values()) {
    const selectedDefinition = normalizeDefinitionText(selections.get(word)?.definition);
    const fallbackDefinition = normalizeDefinitionText(fallbackDefinitions.get(word));
    const definition = selectedDefinition || fallbackDefinition;
    if (!definition) continue;
    definitionsByWord.set(word, definition);
  }
  return definitionsByWord;
}

function buildClueMaps(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitionsByWord: Map<string, string>
) {
  const clues = buildClueLayouts(grid, slots, solved, definitionsByWord);
  const bySlot = new Map<number, { key: string; row: number; col: number }>();
  const groupByKey = new Map<string, ReviewClueGroup>();

  for (const clue of clues) {
    for (const slotId of clue.slotIds) {
      bySlot.set(slotId, { key: clue.key, row: clue.row, col: clue.col });
    }

    const group = groupByKey.get(clue.key) ?? {
      key: clue.key,
      row: clue.row,
      col: clue.col,
      slotIds: [],
      areaCellCount: 1,
    };
    group.areaCellCount = Math.max(1, clue.areaCells.length);
    for (const slotId of clue.slotIds) {
      if (!group.slotIds.includes(slotId)) group.slotIds.push(slotId);
    }
    groupByKey.set(clue.key, group);
  }

  const clueGroups = [...groupByKey.values()].map((group) => ({
    ...group,
    slotIds: [...group.slotIds].sort((a, b) => a - b),
  }));
  clueGroups.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  return { clueBySlot: bySlot, clueGroups };
}

function pickPreferredDefinitionOption(
  options: ReviewDefinitionOption[],
  usedDefinitionKeys?: Set<string>
): ReviewDefinitionOption | null {
  let best: { option: ReviewDefinitionOption; bucket: number; len: number } | null = null;
  for (const option of options) {
    const text = normalizeDefinitionText(option.text);
    if (!text) continue;
    const bucket = definitionSelectionBucket(text, usedDefinitionKeys);
    if (!Number.isFinite(bucket)) continue;
    const len = text.length;
    if (
      !best ||
      bucket < best.bucket ||
      (bucket === best.bucket &&
        (len < best.len || (len === best.len && text.localeCompare(best.option.text, "ru") < 0)))
    ) {
      best = {
        option: {
          opredId: option.opredId,
          text,
        },
        bucket,
        len,
      };
    }
  }
  return best?.option ?? null;
}

function mergeDefinitionOptionByText(
  current: ReviewDefinitionOption | undefined,
  candidate: ReviewDefinitionOption
): ReviewDefinitionOption {
  if (!current) return candidate;
  const currentHasOpredId = Boolean(current.opredId);
  const candidateHasOpredId = Boolean(candidate.opredId);
  if (candidateHasOpredId && !currentHasOpredId) return candidate;
  if (!candidateHasOpredId && currentHasOpredId) return current;
  if (
    candidate.opredId &&
    current.opredId &&
    candidate.opredId.localeCompare(current.opredId, "ru") < 0
  ) {
    return candidate;
  }
  return current;
}

export function buildReviewTemplate(
  entry: ReviewTemplateEntry,
  solved: string[],
  language: string,
  langId: number | null,
  selections: Map<string, ReviewWordSelection>,
  fallbackDefinitions: Map<string, string>,
  usedDefinitionKeys?: Set<string>
): ReviewTemplate {
  const wordsBySlot = new Map<number, string>();
  entry.slots.forEach((slot) => {
    const word = slot.cells.map(([row, col]) => solved[row]?.[col] ?? "").join("");
    wordsBySlot.set(slot.id, normalizeWordKey(word));
  });

  const intersectionsBySlot = buildSlotIntersections(entry.slots, wordsBySlot);
  const clueLayoutDefinitions = buildClueLayoutDefinitions(wordsBySlot, selections, fallbackDefinitions);
  const { clueBySlot, clueGroups } = buildClueMaps(
    entry.grid,
    entry.slots,
    solved,
    clueLayoutDefinitions
  );

  const slots: ReviewSlot[] = entry.slots.map((slot) => {
    const word = wordsBySlot.get(slot.id) ?? "";
    const selection = selections.get(word);
    const fallbackDefinition = normalizeDefinitionText(fallbackDefinitions.get(word));
    const selectedDefinition = normalizeDefinitionText(selection?.definition) || fallbackDefinition;
    let selectedOpredId: string | null = null;
    const optionMap = new Map<string, ReviewDefinitionOption>();
    const pushOption = (option: ReviewDefinitionOption) => {
      const text = normalizeDefinitionText(option.text);
      if (!text) return;
      const key = normalizeDefinitionKey(text);
      const merged = mergeDefinitionOptionByText(optionMap.get(key), {
        opredId: option.opredId,
        text,
      });
      optionMap.set(key, merged);
    };
    for (const def of selection?.definitions ?? []) {
      const text = normalizeDefinitionText(def.text);
      if (!text) continue;
      pushOption({
        opredId: def.opredId ? String(def.opredId) : null,
        text,
      });
    }
    if (selectedDefinition.length > 0) {
      pushOption({
        opredId: selection?.opredId ? String(selection.opredId) : null,
        text: selectedDefinition,
      });
    }
    const options = [...optionMap.values()];
    options.sort((a, b) => a.text.localeCompare(b.text, "ru"));

    let definition = "";
    const preferred = pickPreferredDefinitionOption(options, usedDefinitionKeys);
    if (preferred) {
      definition = preferred.text;
      selectedOpredId = preferred.opredId;
    }
    if (definition.length > 0) {
      usedDefinitionKeys?.add(normalizeDefinitionKey(definition));
    }

    return {
      slotId: slot.id,
      r: slot.r,
      c: slot.c,
      dir: slotDirName(slot),
      len: slot.len,
      cells: slot.cells,
      word,
      wordId: selection ? String(selection.wordId) : null,
      opredId: selectedOpredId,
      definition,
      definitionOptions: options,
      intersections: intersectionsBySlot.get(slot.id) ?? [],
      clueCell: clueBySlot.get(slot.id) ?? null,
      startNumber: entry.startNumberBySlotId.get(slot.id) ?? null,
    };
  });

  return {
    key: entry.key,
    name: entry.name,
    sourceName: entry.sourceName,
    order: entry.order,
    path: entry.path,
    language,
    langId,
    grid: entry.grid,
    slots,
    clueGroups,
    startPositions: entry.startPositions.map((item) => ({ ...item })),
  };
}
