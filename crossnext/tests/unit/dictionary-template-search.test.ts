import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ word_v: { findMany: vi.fn() }, $disconnect: vi.fn() }));
vi.mock("../../../cross/server/src/db/prisma", () => ({ createPrismaClient: () => db }));

import { loadDictionaryByTemplate } from "../../../cross/server/src/services/dictionary";

const rows = [
  { word_text: "кот", word_text_norm: "кот", length: 3, opred_v: [{ text_opr: "Зверь" }] },
  { word_text: "домашний кот", word_text_norm: "домашнийкот", length: 11, opred_v: [{ text_opr: "Питомец" }] },
  { word_text: "котик", word_text_norm: "котик", length: 5, opred_v: [{ text_opr: "Зверёк" }] },
  { word_text: "скот", word_text_norm: "скот", length: 4, opred_v: [{ text_opr: "Стадо" }] },
  { word_text: "барсик", word_text_norm: "барсик", length: 6, opred_v: [{ text_opr: "Домашний кот" }] },
];
// Execute the relevant Prisma string/relation predicates against fixtures. This
// preserves the distinction between SQL contains/startsWith/equals prefilters.
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Record<string, unknown>[]).some((clause) => matches(row, clause));
    if (key === "opred_v")
      return (row.opred_v as Record<string, unknown>[]).some((def) =>
        matches(def, (condition as { some: Record<string, unknown> }).some),
      );
    if (key !== "word_text" && key !== "text_opr") return true;
    const text = String(row[key]).toLowerCase();
    const filter = condition as { contains?: string; startsWith?: string; equals?: string };
    if (filter.contains != null) return text.includes(filter.contains.toLowerCase());
    if (filter.startsWith != null) return text.startsWith(filter.startsWith.toLowerCase());
    return text === filter.equals?.toLowerCase();
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  db.word_v.findMany.mockImplementation(async ({ where }) => rows.filter((row) => matches(row, where)));
});
describe("saved dictionary template search", () => {
  it.each(["exact", "startsWith"])("matches dictionary word boundaries in %s mode", async (searchMode) => {
    const result = await loadDictionaryByTemplate({ language: "ru", query: "кот", scope: "word", searchMode });
    expect([...result.values()].flat()).toEqual(
      searchMode === "exact" ? ["КОТ", "ДОМАШНИЙКОТ"] : ["КОТ", "ДОМАШНИЙКОТ", "КОТИК"],
    );
  });
  it.each(["exact", "startsWith"])("matches a token inside a definition in %s mode", async (searchMode) => {
    const result = await loadDictionaryByTemplate({ language: "ru", query: "кот", scope: "def", searchMode });
    expect([...result.values()].flat()).toEqual(["БАРСИК"]);
  });
});
