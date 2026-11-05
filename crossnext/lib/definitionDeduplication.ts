import {
  compareWithPrepared,
  type ExistingDef,
  type Lang,
  type PreparedExisting,
  prepareExisting,
  type ResultItem,
} from "@/lib/similarityClient";
import { SIMILARITY_CONFIG } from "@/lib/similarityConfig";

export function getSimilarDefinitionMatches(
  text: string,
  prepared: PreparedExisting,
  lang?: Lang,
): Array<ResultItem & { kind: "duplicate" | "similar" }> {
  if (!text || prepared.length === 0) return [];
  return compareWithPrepared({ text, lang }, prepared)
    .top.filter((item) => item.percent >= SIMILARITY_CONFIG.nearThreshold)
    .map((item) => ({
      ...item,
      kind: item.percent >= SIMILARITY_CONFIG.duplicateThreshold ? "duplicate" : "similar",
    }));
}

/** Keep the first non-duplicate wording using the same rules as the form's duplicate warning. */
export function filterUniqueDefinitions(texts: string[], existing: ExistingDef[], lang?: Lang): string[] {
  const prepared = prepareExisting(existing);
  const unique: string[] = [];
  for (const candidate of texts) {
    const text = candidate.trim();
    if (!text || compareWithPrepared({ text, lang }, prepared).duplicates.length > 0) continue;
    unique.push(text);
    prepared.push(...prepareExisting([{ id: `suggestion-${unique.length}`, text, lang }]));
  }
  return unique;
}
