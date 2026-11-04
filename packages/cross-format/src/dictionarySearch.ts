export type DictionarySearchMode = "contains" | "startsWith" | "exact";
export type DictionarySearchScope = "word" | "def" | "both";

export function buildDictionarySearchRegex(query: string, mode: DictionarySearchMode): RegExp | null {
  if (!query || mode === "contains") return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}${mode === "exact" ? "([^\\p{L}\\p{N}]|$)" : ""}`, "iu");
}

export function matchesDictionarySearch(
  regex: RegExp | null,
  scope: DictionarySearchScope,
  word: string,
  definition: string,
): boolean {
  if (!regex) return true;
  if (scope === "word") return regex.test(word);
  if (scope === "def") return regex.test(definition);
  return regex.test(word) || regex.test(definition);
}

/** Refine SQL substring candidates using the same token boundaries in every consumer. */
export function filterDictionarySearchRows<
  T extends { word_text: string; opred_v: Array<{ text_opr: string }> },
>(items: T[], regex: RegExp | null, scope: string): T[] {
  if (!regex) return items;
  return items.flatMap((word) => {
    if (scope !== "def" && regex.test(word.word_text)) return [word];
    if (scope === "word") return [];
    const definitions = word.opred_v.filter((definition) => regex.test(definition.text_opr));
    return definitions.length ? [{ ...word, opred_v: definitions }] : [];
  });
}
