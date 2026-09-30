const EMPIRICAL_SHARE: Readonly<Record<number, number>> = {
  // 621 valid `2XY` scanword templates from megacross/temp.  Non-scanword
  // legacy markers and malformed FSH files are intentionally excluded.
  3: 0.16271,
  4: 0.25192,
  5: 0.25588,
  6: 0.14609,
  7: 0.09042,
  8: 0.04209,
  9: 0.01684,
  10: 0.0153,
  11: 0.004,
};

export const DEFAULT_DICTIONARY_COUNTS: Readonly<Record<number, number>> = {
  3: 721,
  4: 1979,
  5: 3393,
  6: 3817,
  7: 3497,
  8: 2758,
  9: 2041,
  10: 0,
  11: 0,
};

export function calculateLengthWeights(dictionaryCounts: Readonly<Record<number, number>>): Record<number, number> {
  const maxDictionaryCount = Math.max(1, ...Array.from({ length: 9 }, (_, index) => dictionaryCounts[index + 3] ?? 0));
  const raw: Record<number, number> = {};
  let total = 0;
  for (let length = 3; length <= 11; length += 1) {
    const count = Math.max(0, dictionaryCounts[length] ?? 0);
    const weight = Math.max(EMPIRICAL_SHARE[length] ?? 0, 0.01) * Math.sqrt(count / maxDictionaryCount);
    raw[length] = weight;
    total += weight;
  }
  if (!(total > 0)) return Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 3, 0]));
  return Object.fromEntries(Object.entries(raw).map(([length, weight]) => [Number(length), weight / total]));
}

export function countDictionaryByLength(dictionary: ReadonlyMap<number, readonly string[]>): Record<number, number> {
  return Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
    const length = index + 3;
    return [length, dictionary.get(length)?.length ?? 0];
  }));
}
