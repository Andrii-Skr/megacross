import { DIRS, type Grid, type Slot } from "../types";

type ReviewSlot = {
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
  clueCell?: { key: string; row: number; col: number } | null;
};

type ReviewClueGroup = {
  key: string;
  row: number;
  col: number;
  slotIds: number[];
};

type ReviewTemplate = {
  key: string;
  name: string;
  grid: Grid;
  slots: ReviewSlot[];
  clueGroups: ReviewClueGroup[];
};

export type FinalizeSlotInput = {
  slotId: number;
  word?: string | null;
  definition?: string | null;
  wordId?: string | null;
  opredId?: string | null;
};

export type FinalSlotState = {
  slotId: number;
  len: number;
  word: string;
  definition: string;
  wordId: bigint | null;
  opredId: bigint | null;
};

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

function normalizeDefinitionText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeDefinitionKey(value: string | null | undefined): string {
  const normalized = normalizeDefinitionText(value);
  return normalized.toLocaleLowerCase("ru");
}

function parseOptionalBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function resolveDirFromName(name: "down" | "right") {
  return name === "right" ? DIRS.right : DIRS.down;
}

export function convertReviewSlotToSlot(input: ReviewSlot): Slot {
  return {
    id: input.slotId,
    r: input.r,
    c: input.c,
    dir: resolveDirFromName(input.dir),
    len: input.len,
    cells: input.cells.map(([row, col]) => [row, col] as [number, number]),
  };
}

export function buildSolvedGridFromSlots(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>
): string[] {
  const rows: string[][] = Array.from({ length: template.grid.rows }, (_, row) =>
    Array.from({ length: template.grid.cols }, (_, col) => (template.grid.data[row]?.[col] === "#" ? "#" : "."))
  );

  for (const slot of template.slots) {
    const state = states.get(slot.slotId);
    if (!state) {
      throw new Error(`Missing slot state for ${slot.slotId} in ${template.name}`);
    }
    slot.cells.forEach(([row, col], index) => {
      const letter = state.word[index] ?? "";
      if (!letter) {
        throw new Error(`Word length mismatch for slot ${slot.slotId} (${template.name})`);
      }
      const current = rows[row]?.[col];
      if (!current || current === "#") {
        throw new Error(`Slot ${slot.slotId} points to blocked cell (${row},${col}) in ${template.name}`);
      }
      if (current !== "." && current !== letter) {
        throw new Error(
          `Intersection mismatch in ${template.name} at (${row},${col}): '${current}' vs '${letter}'`
        );
      }
      rows[row][col] = letter;
    });
  }

  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      if (rows[row][col] === ".") {
        throw new Error(`Unfilled cell in ${template.name} at (${row},${col})`);
      }
    }
  }

  return rows.map((row) => row.join(""));
}

export function buildFinalSlotState(
  slot: ReviewSlot,
  input: FinalizeSlotInput | null | undefined
): { state: FinalSlotState; errors: string[] } {
  const rawWord = normalizeWordKey(input?.word ?? slot.word);
  const definition = normalizeDefinitionText(input?.definition ?? slot.definition);
  const wordId = parseOptionalBigInt(input?.wordId ?? slot.wordId);
  const opredId = parseOptionalBigInt(input?.opredId ?? slot.opredId);
  const errors: string[] = [];

  if (!rawWord) {
    errors.push(`Template ${slot.slotId}: word is empty`);
  } else {
    if (rawWord.length !== slot.len) {
      errors.push(`Slot ${slot.slotId}: word length ${rawWord.length} does not match ${slot.len}`);
    }
    if (!/^\p{L}+$/u.test(rawWord)) {
      errors.push(`Slot ${slot.slotId}: word must contain letters only`);
    }
  }
  if (!definition) {
    errors.push(`Slot ${slot.slotId}: definition is required`);
  }

  return {
    state: {
      slotId: slot.slotId,
      len: slot.len,
      word: rawWord,
      definition,
      wordId,
      opredId,
    },
    errors,
  };
}

function buildDefinitionClueGroups(template: ReviewTemplate): ReviewClueGroup[] {
  const byKey = new Map<string, ReviewClueGroup>();
  for (const slot of template.slots) {
    const clue = slot.clueCell;
    if (!clue) continue;
    const group = byKey.get(clue.key) ?? {
      key: clue.key,
      row: clue.row,
      col: clue.col,
      slotIds: [],
    };
    if (!group.slotIds.includes(slot.slotId)) {
      group.slotIds.push(slot.slotId);
    }
    byKey.set(clue.key, group);
  }
  const groups = [...byKey.values()].map((group) => ({
    ...group,
    slotIds: [...group.slotIds].sort((a, b) => a - b),
  }));
  groups.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return groups;
}

export function validateTemplateDefinitions(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>
): string[] {
  const clueGroups = buildDefinitionClueGroups(template);
  const errors: string[] = [];
  for (const group of clueGroups) {
    const definitions = group.slotIds
      .map((slotId) => {
        const state = states.get(slotId);
        if (!state) return null;
        return {
          slotId,
          length: state.definition.length,
        };
      })
      .filter((item): item is { slotId: number; length: number } => Boolean(item));
    if (!definitions.length) continue;
    if (group.slotIds.length > 1) {
      for (const item of definitions) {
        if (item.length > 15) {
          errors.push(
            `Template ${template.name}: definition for slot ${item.slotId} exceeds 15 symbols for shared clue cell ${group.key}`
          );
        }
      }
      const total = definitions.reduce((sum, item) => sum + item.length, 0);
      if (total > 30) {
        errors.push(`Template ${template.name}: definitions total exceeds 30 symbols for clue cell ${group.key}`);
      }
    } else {
      for (const item of definitions) {
        if (item.length > 30) {
          errors.push(`Template ${template.name}: definition for slot ${item.slotId} exceeds 30 symbols`);
        }
      }
    }
  }
  return errors;
}

export function validateDefinitionConsistency(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>
): string[] {
  const errors: string[] = [];
  const defByWord = new Map<string, string>();
  for (const state of states.values()) {
    const existing = defByWord.get(state.word);
    if (!existing) {
      defByWord.set(state.word, state.definition);
      continue;
    }
    if (existing !== state.definition) {
      errors.push(`Template ${template.name}: word ${state.word} has conflicting definitions`);
    }
  }
  return errors;
}

export function collectTemplateWords(states: Map<number, FinalSlotState>): Map<string, number> {
  const words = new Map<string, number>();
  for (const state of states.values()) {
    const key = normalizeWordKey(state.word);
    if (!key) continue;
    if (!words.has(key)) words.set(key, state.slotId);
  }
  return words;
}

export function validateWordUniqueness(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  for (const state of states.values()) {
    const existingSlot = seen.get(state.word);
    if (existingSlot !== undefined) {
      errors.push(`Template ${template.name}: word ${state.word} duplicates slot ${existingSlot}`);
      continue;
    }
    seen.set(state.word, state.slotId);
  }
  return errors;
}

export function validateDefinitionUniqueness(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key) continue;
    const existingSlot = seen.get(key);
    if (existingSlot !== undefined) {
      errors.push(
        `Template ${template.name}: definition for slot ${state.slotId} duplicates slot ${existingSlot}`
      );
      continue;
    }
    seen.set(key, state.slotId);
  }
  return errors;
}

export function validateDefinitionReuseAcrossTemplates(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>,
  usedDefinitions: Map<string, { templateName: string; slotId: number }>
): string[] {
  const errors: string[] = [];
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key) continue;
    const existing = usedDefinitions.get(key);
    if (!existing) continue;
    errors.push(
      `Template ${template.name}: definition for slot ${state.slotId} duplicates template ${existing.templateName} slot ${existing.slotId}`
    );
  }
  return errors;
}

export function registerUsedDefinitions(
  template: ReviewTemplate,
  states: Map<number, FinalSlotState>,
  usedDefinitions: Map<string, { templateName: string; slotId: number }>
): void {
  for (const state of states.values()) {
    const key = normalizeDefinitionKey(state.definition);
    if (!key || usedDefinitions.has(key)) continue;
    usedDefinitions.set(key, { templateName: template.name, slotId: state.slotId });
  }
}

export function validateNeighborWordReuse(
  template: ReviewTemplate,
  wordsInTemplate: Map<string, number>,
  neighborsByTemplate: Map<string, Set<string>>,
  usedWordsByTemplate: Map<string, Map<string, number>>,
  templateNameByKey: Map<string, string>
): string[] {
  const errors: string[] = [];
  const neighbors = neighborsByTemplate.get(template.key);
  if (!neighbors || !wordsInTemplate.size) return errors;
  for (const neighborKey of neighbors) {
    const neighborWords = usedWordsByTemplate.get(neighborKey);
    if (!neighborWords?.size) continue;
    const neighborName = templateNameByKey.get(neighborKey) ?? neighborKey;
    for (const [word, slotId] of wordsInTemplate) {
      const neighborSlotId = neighborWords.get(word);
      if (neighborSlotId === undefined) continue;
      errors.push(
        `Template ${template.name}: word ${word} in slot ${slotId} duplicates neighboring template ${neighborName} slot ${neighborSlotId}`
      );
    }
  }
  return errors;
}
