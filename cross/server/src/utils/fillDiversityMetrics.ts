export type FillRunTemplate = { key: string; filled: boolean; words: readonly string[] };

/** Compare answer slots, not letters or definition text; failed grids are excluded. */
export function compareFillRuns(left: readonly FillRunTemplate[], right: readonly FillRunTemplate[]) {
  const rightByKey = new Map(right.map((template) => [template.key, template]));
  let comparableTemplates = 0;
  let identicalTemplates = 0;
  let comparedSlots = 0;
  let identicalSlots = 0;
  const leftWords = new Set<string>();
  const rightWords = new Set<string>();
  for (const a of left) {
    const b = rightByKey.get(a.key);
    if (!a.filled || !b?.filled || a.words.length !== b.words.length) continue;
    comparableTemplates += 1;
    let same = 0;
    a.words.forEach((word, index) => { if (word === b.words[index]) same += 1; });
    identicalTemplates += Number(same === a.words.length);
    comparedSlots += a.words.length;
    identicalSlots += same;
    a.words.forEach((word) => { leftWords.add(word); });
    b.words.forEach((word) => { rightWords.add(word); });
  }
  const batchSharedWords = [...leftWords].filter((word) => rightWords.has(word)).length;
  return {
    comparableTemplates, identicalTemplates, changedTemplates: comparableTemplates - identicalTemplates,
    comparedSlots, identicalSlots,
    sameSlotShare: comparedSlots ? identicalSlots / comparedSlots : null,
    batchSharedWords,
    batchWordOverlapShare: Math.max(leftWords.size, rightWords.size) ? batchSharedWords / Math.max(leftWords.size, rightWords.size) : null,
  };
}
