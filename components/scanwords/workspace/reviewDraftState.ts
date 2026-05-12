import type {
  FillDefinitionLimits,
  FillFinalizePayload,
  FillReviewDefinitionOption,
  FillReviewPayload,
  FillReviewTemplate,
} from "./model";

export type PersistedReviewRow = {
  templateKey: string;
  slotId: number;
  word: string;
  definition: string;
  wordId: string | null;
  opredId: string | null;
};

export type EditableReviewSlotState = {
  slotId: number;
  word: string;
  definition: string;
  wordId: string | null;
  opredId: string | null;
  definitionOptions: FillReviewDefinitionOption[];
};

export type EditableReviewTemplateState = {
  key: string;
  slots: EditableReviewSlotState[];
};

function normalizeDefinitionDifficulty(value: number | null | undefined): number | null {
  if (!Number.isFinite(value as number)) return null;
  return Math.trunc(value as number);
}

export function normalizeWordInput(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function normalizeDefinitionKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("ru");
}

export function normalizeDefinitionOptions(
  options: Array<Omit<FillReviewDefinitionOption, "difficulty"> & { difficulty?: number | null }> | null | undefined,
): FillReviewDefinitionOption[] {
  if (!Array.isArray(options)) return [];
  const byText = new Map<string, FillReviewDefinitionOption>();
  for (const option of options) {
    const text = (option.text ?? "").trim();
    if (!text) continue;
    const next: FillReviewDefinitionOption = {
      opredId: option.opredId ?? null,
      text,
      difficulty: normalizeDefinitionDifficulty(option.difficulty),
    };
    const key = normalizeDefinitionKey(text);
    const current = byText.get(key);
    if (!current) {
      byText.set(key, next);
      continue;
    }
    const currentHasOpredId = Boolean(current.opredId);
    const nextHasOpredId = Boolean(next.opredId);
    const currentHasDifficulty = Number.isFinite(current.difficulty as number);
    const nextHasDifficulty = Number.isFinite(next.difficulty as number);
    if (nextHasOpredId && !currentHasOpredId) {
      byText.set(key, next);
      continue;
    }
    if (!nextHasOpredId && currentHasOpredId) {
      continue;
    }
    if (nextHasDifficulty && !currentHasDifficulty) {
      byText.set(key, next);
    }
  }
  return [...byText.values()];
}

export function buildInitialTemplateState(template: FillReviewTemplate): EditableReviewSlotState[] {
  return template.slots.map((slot) => ({
    slotId: slot.slotId,
    word: normalizeWordInput(slot.word),
    definition: slot.definition,
    wordId: slot.wordId ?? null,
    opredId: slot.opredId ?? null,
    definitionOptions: normalizeDefinitionOptions(slot.definitionOptions),
  }));
}

export function normalizePersistedSlot(value: unknown): PersistedReviewRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    templateKey?: unknown;
    slotId?: unknown;
    word?: unknown;
    definition?: unknown;
    wordId?: unknown;
    opredId?: unknown;
  };
  if (typeof row.templateKey !== "string" || !row.templateKey) return null;
  const slotId = typeof row.slotId === "number" ? row.slotId : Number.NaN;
  if (!Number.isFinite(slotId)) return null;
  const word = typeof row.word === "string" ? normalizeWordInput(row.word) : "";
  const definition = typeof row.definition === "string" ? row.definition : "";
  const wordId = typeof row.wordId === "string" && row.wordId.length > 0 ? row.wordId : null;
  const opredId = typeof row.opredId === "string" && row.opredId.length > 0 ? row.opredId : null;
  return {
    templateKey: row.templateKey,
    slotId,
    word,
    definition,
    wordId,
    opredId,
  };
}

export function normalizePersistedRows(value: unknown): PersistedReviewRow[] {
  if (!Array.isArray(value)) return [];
  const rows: PersistedReviewRow[] = [];
  for (const rowRaw of value) {
    const row = normalizePersistedSlot(rowRaw);
    if (!row) continue;
    rows.push(row);
  }
  return rows;
}

export function mapPersistedRowsByTemplate(rows: PersistedReviewRow[]): Map<string, Map<number, PersistedReviewRow>> {
  const result = new Map<string, Map<number, PersistedReviewRow>>();
  for (const row of rows) {
    const bySlotId = result.get(row.templateKey) ?? new Map<number, PersistedReviewRow>();
    bySlotId.set(row.slotId, row);
    result.set(row.templateKey, bySlotId);
  }
  return result;
}

export function mergeTemplateStateWithDraft(
  initialRows: EditableReviewSlotState[],
  draftRowsBySlotId: Map<number, PersistedReviewRow> | undefined,
): EditableReviewSlotState[] {
  if (!draftRowsBySlotId?.size) return initialRows;
  return initialRows.map((initialRow) => {
    const draft = draftRowsBySlotId.get(initialRow.slotId);
    if (!draft) return initialRow;
    const nextWord = normalizeWordInput(draft.word);
    const nextDefinitionOptions = [...initialRow.definitionOptions];
    const nextDefinition = draft.definition ?? "";
    const hasDefinitionInOptions =
      !nextDefinition ||
      nextDefinitionOptions.some(
        (option) => option.text === nextDefinition && option.opredId === (draft.opredId ?? null),
      ) ||
      nextDefinitionOptions.some((option) => option.text === nextDefinition);
    if (!hasDefinitionInOptions && nextDefinition) {
      const knownOption = nextDefinitionOptions.find((option) => option.text === nextDefinition);
      nextDefinitionOptions.push({
        opredId: draft.opredId ?? null,
        text: nextDefinition,
        difficulty: knownOption?.difficulty ?? null,
      });
    }

    return {
      ...initialRow,
      word: nextWord || initialRow.word,
      definition: nextDefinition,
      wordId: draft.wordId ?? null,
      opredId: draft.opredId ?? null,
      definitionOptions: nextDefinitionOptions,
    };
  });
}

export function buildEditableTemplateStates(
  templates: FillReviewTemplate[],
  draftRowsByTemplate?: Map<string, Map<number, PersistedReviewRow>> | null,
): EditableReviewTemplateState[] {
  return templates.map((template) => ({
    key: template.key,
    slots: mergeTemplateStateWithDraft(buildInitialTemplateState(template), draftRowsByTemplate?.get(template.key)),
  }));
}

export function buildPersistedRows(
  templates: FillReviewTemplate[],
  slotsByTemplate: Record<string, EditableReviewSlotState[]>,
): PersistedReviewRow[] {
  const rows: PersistedReviewRow[] = [];
  for (const template of templates) {
    const initialRows = buildInitialTemplateState(template);
    const initialBySlotId = new Map(initialRows.map((row) => [row.slotId, row]));
    const currentRows = slotsByTemplate[template.key] ?? [];
    for (const currentRow of currentRows) {
      const initialRow = initialBySlotId.get(currentRow.slotId);
      if (!initialRow) continue;
      const currentWord = normalizeWordInput(currentRow.word);
      const initialWord = normalizeWordInput(initialRow.word);
      const currentWordId = currentRow.wordId ?? null;
      const initialWordId = initialRow.wordId ?? null;
      const currentDefinition = currentRow.definition ?? "";
      const initialDefinition = initialRow.definition ?? "";
      const currentOpredId = currentRow.opredId ?? null;
      const initialOpredId = initialRow.opredId ?? null;
      const unchanged =
        currentWord === initialWord &&
        currentWordId === initialWordId &&
        currentDefinition === initialDefinition &&
        currentOpredId === initialOpredId;
      if (unchanged) continue;
      rows.push({
        templateKey: template.key,
        slotId: currentRow.slotId,
        word: currentWord,
        definition: currentDefinition,
        wordId: currentWordId,
        opredId: currentOpredId,
      });
    }
  }
  return rows;
}

export function buildFinalizePayload(
  reviewData: FillReviewPayload,
  slotsByTemplate: Record<string, EditableReviewSlotState[]>,
  definitionLimits: FillDefinitionLimits,
): FillFinalizePayload {
  return {
    templates: reviewData.templates.map((template) => ({
      key: template.key,
      slots: (slotsByTemplate[template.key] ?? []).map((slot) => ({
        slotId: slot.slotId,
        word: normalizeWordInput(slot.word),
        definition: (slot.definition ?? "").trim(),
        wordId: slot.wordId ?? null,
        opredId: slot.opredId ?? null,
      })),
    })),
    definitionLimits: {
      maxPerCell: Math.max(1, Math.trunc(definitionLimits.maxPerCell)),
      maxPerHalfCell: Math.max(1, Math.trunc(definitionLimits.maxPerHalfCell)),
    },
  };
}

export function removeTemplateRows(rows: PersistedReviewRow[], templateKey: string): PersistedReviewRow[] {
  return rows.filter((row) => row.templateKey !== templateKey);
}
