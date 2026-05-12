import {
  normalizeDefinitionKey,
  type FillReviewPayload,
  type ReviewTemplate,
} from "./fillJobReviewService";

export type ReviewTemplateStatusRow = {
  key?: string | null;
  name: string;
  status: "pending" | "running" | "done" | "error";
  error?: string | null;
  order?: number | null;
  sourceName?: string | null;
};

export type ReviewSlotOverrideInput = {
  slotId: number;
  word?: string | null;
  definition?: string | null;
  wordId?: string | null;
  opredId?: string | null;
};

export type ReviewTemplateOverrideInput = {
  key: string;
  slots?: ReviewSlotOverrideInput[] | null;
};

export type ReviewUsageState = {
  solvedWordsByTemplate: Map<string, Set<string>>;
  usedWordsByTemplate: Map<string, Map<string, number>>;
  usedWordsInJob: Set<string>;
  usedWordCountInJob: Map<string, number>;
  usedDefinitionKeys: Set<string>;
};

function normalizeWordKey(word: string | null | undefined): string {
  return (word ?? "").trim().toUpperCase();
}

function normalizeDefinitionText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeNullableString(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sortReviewTemplates(templates: ReviewTemplate[]): ReviewTemplate[] {
  return [...templates].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.name.localeCompare(right.name, "ru");
  });
}

export function buildFillReviewPayload(
  issue: FillReviewPayload["issue"],
  options: FillReviewPayload["options"],
  templates: ReviewTemplate[],
): FillReviewPayload {
  return {
    version: 1,
    issue: { ...issue },
    options: { ...options },
    templates: sortReviewTemplates(templates),
  };
}

export function applyReviewTemplateOverrides(
  review: FillReviewPayload,
  overrides: ReviewTemplateOverrideInput[],
): FillReviewPayload {
  if (!overrides.length) return review;
  const overridesByTemplate = new Map<string, Map<number, ReviewSlotOverrideInput>>();
  for (const template of overrides) {
    if (!template?.key) continue;
    const slotMap = new Map<number, ReviewSlotOverrideInput>();
    for (const slot of template.slots ?? []) {
      if (!slot || !Number.isFinite(slot.slotId)) continue;
      slotMap.set(Math.trunc(slot.slotId), slot);
    }
    overridesByTemplate.set(template.key, slotMap);
  }
  if (!overridesByTemplate.size) return review;

  return {
    ...review,
    templates: review.templates.map((template) => {
      const slotOverrides = overridesByTemplate.get(template.key);
      if (!slotOverrides?.size) return template;
      return {
        ...template,
        slots: template.slots.map((slot) => {
          const override = slotOverrides.get(slot.slotId);
          if (!override) return slot;
          return {
            ...slot,
            word: override.word === undefined ? slot.word : normalizeWordKey(override.word),
            definition:
              override.definition === undefined ? slot.definition : normalizeDefinitionText(override.definition),
            wordId: normalizeNullableString(override.wordId, slot.wordId),
            opredId: normalizeNullableString(override.opredId, slot.opredId),
          };
        }),
      };
    }),
  };
}

export function collectReviewUsageState(
  review: FillReviewPayload,
  excludeTemplateKey?: string,
): ReviewUsageState {
  const solvedWordsByTemplate = new Map<string, Set<string>>();
  const usedWordsByTemplate = new Map<string, Map<string, number>>();
  const usedWordsInJob = new Set<string>();
  const usedWordCountInJob = new Map<string, number>();
  const usedDefinitionKeys = new Set<string>();

  for (const template of review.templates) {
    if (excludeTemplateKey && template.key === excludeTemplateKey) continue;
    const wordsInTemplate = new Set<string>();
    const slotsByWord = new Map<string, number>();
    for (const slot of template.slots) {
      const word = normalizeWordKey(slot.word);
      if (word) {
        wordsInTemplate.add(word);
        if (!slotsByWord.has(word)) slotsByWord.set(word, slot.slotId);
        usedWordsInJob.add(word);
        usedWordCountInJob.set(word, (usedWordCountInJob.get(word) ?? 0) + 1);
      }
      const definitionKey = normalizeDefinitionKey(slot.definition);
      if (definitionKey) {
        usedDefinitionKeys.add(definitionKey);
      }
    }
    solvedWordsByTemplate.set(template.key, wordsInTemplate);
    usedWordsByTemplate.set(template.key, slotsByWord);
  }

  return {
    solvedWordsByTemplate,
    usedWordsByTemplate,
    usedWordsInJob,
    usedWordCountInJob,
    usedDefinitionKeys,
  };
}

export function mergeReviewTemplate(review: FillReviewPayload, nextTemplate: ReviewTemplate): FillReviewPayload {
  const filtered = review.templates.filter((template) => template.key !== nextTemplate.key);
  return buildFillReviewPayload(review.issue, review.options, [...filtered, nextTemplate]);
}

export function removeReviewTemplate(review: FillReviewPayload, templateKey: string): FillReviewPayload {
  return buildFillReviewPayload(
    review.issue,
    review.options,
    review.templates.filter((template) => template.key !== templateKey),
  );
}

export function applyTemplateReviewResult(
  review: FillReviewPayload,
  templatesState: ReviewTemplateStatusRow[],
  templateKey: string,
  result:
    | { type: "success"; template: ReviewTemplate }
    | {
        type: "error";
        error: string;
      },
): { review: FillReviewPayload; templatesState: ReviewTemplateStatusRow[] } {
  const nextReview =
    result.type === "success" ? mergeReviewTemplate(review, result.template) : removeReviewTemplate(review, templateKey);
  const nextTemplatesState = templatesState.map((row) => {
    if (row.key !== templateKey) return row;
    if (result.type === "success") {
      return {
        ...row,
        status: "done" as const,
        error: null,
      };
    }
    return {
      ...row,
      status: "error" as const,
      error: result.error,
    };
  });
  return { review: nextReview, templatesState: nextTemplatesState };
}
