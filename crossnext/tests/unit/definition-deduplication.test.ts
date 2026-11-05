import { describe, expect, it } from "vitest";
import { filterUniqueDefinitions, getSimilarDefinitionMatches } from "@/lib/definitionDeduplication";
import { compareWithPrepared, type Lang, prepareExisting } from "@/lib/similarityClient";
import { SIMILARITY_CONFIG } from "@/lib/similarityConfig";

describe("generated definition deduplication", () => {
  it("rejects the 95.65 percent duplicate from the reported screenshot", () => {
    const existing = [{ id: 1, text: "опера «Викинги», композитор", lang: "ru" as const }];
    const text = "композитор оперы «Викинги";
    expect(compareWithPrepared({ text, lang: "ru" }, prepareExisting(existing)).best?.percent).toBe(95.65);
    expect(getSimilarDefinitionMatches(text, prepareExisting(existing), "ru")).toEqual([
      { id: 1, text: existing[0].text, percent: 95.65, kind: "duplicate" },
    ]);
    expect(filterUniqueDefinitions([text], existing, "ru")).toEqual([]);
  });

  it("returns no comparison for an empty draft or an unrelated suggestion", () => {
    const prepared = prepareExisting([{ id: 1, text: "домашний хищник", lang: "ru" }]);
    expect(getSimilarDefinitionMatches("", prepared, "ru")).toEqual([]);
    expect(getSimilarDefinitionMatches("большой город", prepared, "ru")).toEqual([]);
  });
  it("uses the existing duplicate rule for reordered words and punctuation", () => {
    expect(
      filterUniqueDefinitions(
        ["хищник домашний!", "ночной охотник"],
        [{ id: 1, text: "домашний хищник", lang: "ru" }],
        "ru",
      ),
    ).toEqual(["ночной охотник"]);
  });

  it("keeps only the first acceptable wording within a batch", () => {
    expect(filterUniqueDefinitions(["усатый питомец", "питомец усатый", "ночной охотник"], [], "ru")).toEqual([
      "усатый питомец",
      "ночной охотник",
    ]);
  });

  it("does not let a rejected candidate block a valid one", () => {
    const existing = [{ id: 1, text: "домашний хищник", lang: "ru" as const }];
    expect(filterUniqueDefinitions(["хищник домашний", "лесной хищник"], existing, "ru")).toEqual(["лесной хищник"]);
  });

  it("keeps similar definitions below the duplicate threshold", () => {
    const existing = [{ id: 1, text: "домашний хищник", lang: "ru" as const }];
    const { best } = compareWithPrepared({ text: "лесной хищник", lang: "ru" }, prepareExisting(existing));
    expect(best?.percent).toBeGreaterThanOrEqual(SIMILARITY_CONFIG.nearThreshold);
    expect(best?.percent).toBeLessThan(SIMILARITY_CONFIG.duplicateThreshold);
    expect(filterUniqueDefinitions(["лесной хищник"], existing, "ru")).toEqual(["лесной хищник"]);
  });

  it.each([
    ["ru", "Приход в бухгалтерии", "бухгалтерский приход"],
    ["uk", "хижак у лісі", "хижак в лісі"],
    ["en", "a domestic feline", "the domestic feline"],
  ] satisfies Array<
    [Lang, string, string]
  >)("uses the existing language normalization for %s", (lang, candidate, text) => {
    expect(filterUniqueDefinitions([candidate], [{ id: 1, text, lang }], lang)).toEqual([]);
  });
});
