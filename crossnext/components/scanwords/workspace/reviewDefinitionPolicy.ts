import type { FillReviewDefinitionOption, FillReviewTemplate } from "./model";
import type { EditableReviewSlotState, PersistedReviewRow } from "./reviewDraftState";
import { normalizeDefinitionKey } from "./reviewDraftState";

export const PAIRED_DEFINITION_MIN_LENGTH = 15;

export function getPairedDefinitionMaxLength(
  template: FillReviewTemplate,
  slotId: number,
  maxPerCell: number,
): number | null {
  const slot = template.slots.find((item) => item.slotId === slotId);
  if (!slot?.clueCell || slot.isPhotoDefinition) return null;
  const group = template.clueGroups.find((item) => item.key === slot.clueCell?.key);
  if (group?.areaCellCount !== 2 || group.slotIds.length !== 1) return null;
  return Math.max(1, Math.trunc(maxPerCell)) * 2;
}

export function isPreferredPairedDefinition(text: string, maxLength: number): boolean {
  const length = text.trim().length;
  return length >= PAIRED_DEFINITION_MIN_LENGTH && length <= maxLength;
}

export function pickReviewDefinition(
  options: FillReviewDefinitionOption[],
  preferred: { definition: string; opredId: string | null },
  pairedMaxLength: number | null,
): FillReviewDefinitionOption | undefined {
  const current =
    options.find((option) => option.text === preferred.definition && option.opredId === preferred.opredId) ??
    options.find((option) => option.text === preferred.definition);
  if (pairedMaxLength == null) return current ?? options[0];
  if (current && isPreferredPairedDefinition(current.text, pairedMaxLength)) return current;
  return options.find((option) => isPreferredPairedDefinition(option.text, pairedMaxLength)) ?? current ?? options[0];
}

/** Prefer longer clues when opening review, while keeping drafts and unique definitions. */
export function preferPairedReviewDefinitions(
  templates: FillReviewTemplate[],
  rowsByTemplate: Record<string, EditableReviewSlotState[]>,
  maxPerCell: number,
  drafts?: Map<string, Map<number, PersistedReviewRow>> | null,
): Record<string, EditableReviewSlotState[]> {
  const usage = new Map<string, number>();
  for (const rows of Object.values(rowsByTemplate)) {
    for (const row of rows) {
      const key = normalizeDefinitionKey(row.definition);
      if (key) usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  const result = { ...rowsByTemplate };
  for (const template of templates) {
    result[template.key] = (rowsByTemplate[template.key] ?? []).map((row) => {
      const maxLength = getPairedDefinitionMaxLength(template, row.slotId, maxPerCell);
      if (maxLength == null || drafts?.get(template.key)?.has(row.slotId)) return row;
      if (isPreferredPairedDefinition(row.definition, maxLength)) return row;
      const currentKey = normalizeDefinitionKey(row.definition);
      const options = row.definitionOptions.filter((option) => {
        const key = normalizeDefinitionKey(option.text);
        return (usage.get(key) ?? 0) - (key === currentKey ? 1 : 0) <= 0;
      });
      const selected = pickReviewDefinition(options, row, maxLength);
      if (!selected || !isPreferredPairedDefinition(selected.text, maxLength)) return row;
      if (currentKey) usage.set(currentKey, (usage.get(currentKey) ?? 0) - 1);
      const nextKey = normalizeDefinitionKey(selected.text);
      usage.set(nextKey, (usage.get(nextKey) ?? 0) + 1);
      return { ...row, definition: selected.text, opredId: selected.opredId };
    });
  }
  return result;
}
