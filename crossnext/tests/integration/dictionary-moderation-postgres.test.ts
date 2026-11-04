import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return {
    prisma: new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.MEGACROSS_REVIEW_TEST_DATABASE_URL ?? "postgresql://localhost:1/unconfigured",
      }),
    }),
  };
});
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/lib/db")).prisma }));
vi.mock("../../../cross/server/src/db/prisma", async () => ({ createPrismaClient: () => prisma }));
vi.mock("@/lib/authz", () => ({
  Permissions: { PendingReview: "pending:review", DictionaryWrite: "dictionary:write", TagsAdminAccess: "tags:admin" },
  hasPermissionAsync: async () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));

import { prisma } from "@/lib/db";
import { loadDictionaryByTemplate } from "../../../cross/server/src/services/dictionary";
import { approvePendingAction, savePendingAction } from "../../app/actions/admin-pending";
import { POST as bulk } from "../../app/api/dictionary/bulk-tags/route";
import { POST as stats } from "../../app/api/dictionary/filter-stats/route";
import { GET } from "../../app/api/dictionary/route";
import { makeCtx, makeReq } from "../api/_utils";
import { setAuthed } from "../mocks";

// Opt-in: point only at a disposable PostgreSQL with the current Prisma schema.
// Fixtures use a unique language and are removed after the run.
describe.skipIf(!process.env.MEGACROSS_REVIEW_TEST_DATABASE_URL)("PostgreSQL review regressions", () => {
  const langCode = `rv${Date.now().toString(36).slice(-6)}`;
  let langId: number;
  beforeAll(async () => {
    setAuthed({ id: "17", role: "ADMIN" });
    langId = (await prisma.language.create({ data: { code: langCode, name: "Isolated audit" } })).id;
    await prisma.difficulty.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    for (const text of ["кот", "барсик"]) {
      const word = await prisma.word_v.create({ data: { word_text: text, length: text.length, langId, korny: "" } });
      await prisma.opred_v.createMany({
        data: ["кот домашний", "Животное"].map((text_opr) => ({ word_id: word.id, text_opr, langId })),
      });
    }
  });
  afterAll(async () => {
    try {
      if (langId != null) {
        await prisma.pendingWords.deleteMany({ where: { langId } });
        await prisma.word_v.deleteMany({ where: { langId } });
        await prisma.tag.deleteMany({ where: { name: { startsWith: `review-${langCode}-` } } });
        await prisma.language.delete({ where: { id: langId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });
  it.each([
    "contains",
    "exact",
    "startsWith",
  ])("agrees on list, statistics and bulk target counts in %s mode", async (searchMode) => {
    const list = await GET(
      makeReq("GET", `http://localhost/api/dictionary?lang=${langCode}&q=кот&scope=both&mode=${searchMode}`),
      makeCtx({}),
    );
    const result = await list.json();
    expect(list.status).toBe(200);
    expect(result.items.map((word: { opred_v: unknown[] }) => word.opred_v.length)).toEqual([2, 1]);
    expect(result.totalDefs).toBe(3);
    const filter = { language: langCode, query: "кот", scope: "both", searchMode };
    const counts = await stats(makeReq("POST", "http://localhost/api/dictionary/filter-stats", filter), makeCtx({}));
    expect(await counts.json()).toMatchObject({ totalWords: 2, totalDefs: 3 });
    const tag = await prisma.tag.create({ data: { name: `review-${langCode}-${searchMode}` } });
    const applied = await bulk(
      makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
        action: "applyTags",
        tagIds: [tag.id],
        selectAllAcrossFilter: true,
        filter,
      }),
      makeCtx({}),
    );
    expect(await applied.json()).toEqual({ applied: 3 });
    expect(await prisma.opredTag.count({ where: { tagId: tag.id } })).toBe(3);
  });
  it.each(["exact", "startsWith"])("uses token boundaries in a real saved template %s query", async (searchMode) => {
    const result = await loadDictionaryByTemplate({ language: langCode, query: "кот", scope: "def", searchMode });
    expect([...result.values()].flat()).toEqual(expect.arrayContaining(["КОТ", "БАРСИК"]));
  });
  it.each([false, true])("serializes concurrent different pending cards for existing=%s", async (existing) => {
    const word_text = existing ? "pendingexisting" : "pendingnew";
    const target = existing
      ? await prisma.word_v.create({ data: { word_text, length: word_text.length, langId, korny: "" } })
      : null;
    const cards = await Promise.all(
      Array.from({ length: 4 }, () =>
        prisma.pendingWords.create({
          data: {
            word_text,
            length: word_text.length,
            langId,
            targetWordId: target?.id,
            note: JSON.stringify({ kind: target ? "addDefinition" : "newWord" }),
            descriptions: { create: { description: "Shared clue", difficulty: 1, note: "" } },
          },
        }),
      ),
    );
    await Promise.all(
      cards.map(async (card) => {
        const data = new FormData();
        data.set("id", String(card.id));
        await approvePendingAction(data);
      }),
    );
    const words = await prisma.word_v.findMany({ where: { word_text, langId }, include: { opred_v: true } });
    expect(words).toHaveLength(1);
    expect(words[0].opred_v).toHaveLength(1);
    expect(
      await prisma.pendingWords.count({ where: { id: { in: cards.map((card) => card.id) }, status: "APPROVED" } }),
    ).toBe(4);
  });
  it("rolls back attempts to remove the last pending description", async () => {
    const card = await prisma.pendingWords.create({
      data: {
        word_text: "guard",
        length: 5,
        langId,
        note: "",
        descriptions: { create: { description: "Required clue", difficulty: 1, note: "" } },
      },
      include: { descriptions: true },
    });
    const form = new FormData();
    form.set("id", String(card.id));
    form.set("word", "changed");
    form.set("delete_desc_ids", String(card.descriptions[0].id));
    await expect(savePendingAction(form)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.pendingDescriptions.count({ where: { pendingWordId: card.id } })).toBe(1);
    expect((await prisma.pendingWords.findUnique({ where: { id: card.id } }))?.word_text).toBe("guard");
  });
});
