import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/dictionary/bulk-tags/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

describe("/api/dictionary/bulk-tags (POST)", () => {
  beforeEach(() => {
    resetMocks();
    // Run transactions inline for deterministic assertions
    prisma.$transaction.mockImplementation(async (cb: (arg: typeof prisma) => Promise<unknown>) => cb(prisma as never));
  });

  it("applies tags to explicit ids", async () => {
    setAuthed({ id: "42", role: "ADMIN", email: "admin@test" });
    prisma.opredTag.createMany.mockResolvedValue({ count: 2 });

    const req = makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
      action: "applyTags",
      tagIds: [5],
      ids: ["1", "2"],
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ applied: number }>(res);

    expect(status).toBe(200);
    expect(json.applied).toBe(2);
    expect(prisma.opredTag.createMany).toHaveBeenCalledWith({
      data: [
        { opredId: BigInt(1), tagId: 5, addedBy: 42 },
        { opredId: BigInt(2), tagId: 5, addedBy: 42 },
      ],
      skipDuplicates: true,
    });
  });

  it("applies tags across filter with exclusions", async () => {
    setAuthed({ id: "99", role: "ADMIN", email: "bulk@test" });
    prisma.opredTag.createMany.mockResolvedValue({ count: 2 });
    prisma.opred_v.findMany
      .mockResolvedValueOnce([{ id: BigInt(10) }, { id: BigInt(11) }, { id: BigInt(12) }])
      .mockResolvedValueOnce([]);

    const req = makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
      action: "applyTags",
      tagIds: [7],
      selectAllAcrossFilter: true,
      filter: { language: "ru", scope: "both", query: "abc" },
      excludeIds: ["11"],
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ applied: number }>(res);

    expect(status).toBe(200);
    expect(json.applied).toBe(2);
    expect(prisma.opred_v.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.opredTag.createMany).toHaveBeenCalledWith({
      data: [
        { opredId: BigInt(10), tagId: 7, addedBy: 99 },
        { opredId: BigInt(12), tagId: 7, addedBy: 99 },
      ],
      skipDuplicates: true,
    });
  });

  it("does not skip definitions when applying a tag removes previous batches from the filter", async () => {
    setAuthed({ id: "42", role: "ADMIN" });
    const rows = Array.from({ length: 1002 }, (_, index) => ({ id: BigInt(index + 1) }));
    const tagged = new Set<bigint>();
    prisma.opred_v.findMany.mockImplementation(async (args) => {
      const candidates = rows.filter((row) => !tagged.has(row.id));
      // Model the changing relation filter as well as Prisma cursor/skip behavior.
      const cursorId = args.cursor?.id;
      const start = cursorId == null ? 0 : candidates.findIndex((row) => row.id >= cursorId) + (args.skip ?? 0);
      return candidates
        .filter((row) => args.where.id?.gt == null || row.id > args.where.id.gt)
        .slice(start, start + args.take);
    });
    prisma.opredTag.createMany.mockImplementation(async ({ data }) => {
      for (const link of data) tagged.add(link.opredId);
      return { count: data.length };
    });
    const response = await POST(
      makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
        action: "applyTags",
        tagIds: [7],
        selectAllAcrossFilter: true,
        filter: { language: "ru", excludeTagNames: ["new-tag"] },
        excludeIds: ["501"],
      }),
      makeCtx({}),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ applied: 1001 });
    expect(rows.filter((row) => !tagged.has(row.id)).map((row) => row.id)).toEqual([501n]);
  });

  it("requires auth", async () => {
    setAuthed(null);
    const req = makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
      action: "applyTags",
      tagIds: [1],
      ids: ["1"],
    });
    const res = await POST(req, makeCtx({}));
    const { status } = await readJson(res);
    expect(status).toBe(401);
    expect(prisma.opredTag.createMany).not.toHaveBeenCalled();
  });

  it.each([
    "contains",
    "exact",
    "startsWith",
  ])("uses OR for scope=both in %s mode and preserves exclusions", async (searchMode) => {
    setAuthed({ id: "42", role: "ADMIN" });
    prisma.opred_v.findMany.mockResolvedValueOnce([
      { id: 1n, text_opr: "Животное", word_v: { word_text: "КОТ" } },
      { id: 2n, text_opr: "КОТ", word_v: { word_text: "БАРСИК" } },
      { id: 3n, text_opr: "КОТ", word_v: { word_text: "МУРЗИК" } },
    ]);
    const response = await POST(
      makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
        action: "applyTags",
        tagIds: [7],
        selectAllAcrossFilter: true,
        excludeIds: ["3"],
        filter: { language: "ru", query: "кот", scope: "both", searchMode },
      }),
      makeCtx({}),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ applied: 2 });
    expect(prisma.opredTag.createMany).toHaveBeenCalledWith({
      data: [
        { opredId: 1n, tagId: 7, addedBy: 42 },
        { opredId: 2n, tagId: 7, addedBy: 42 },
      ],
      skipDuplicates: true,
    });
    const where = prisma.opred_v.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([
      {
        OR: [
          { word_v: { is: { word_text: { contains: "кот", mode: "insensitive" } } } },
          { text_opr: { contains: "кот", mode: "insensitive" } },
        ],
      },
    ]);
    expect(where.word_v.is).not.toHaveProperty("word_text");
    expect(where).not.toHaveProperty("text_opr");
    expect(where.OR).toEqual([{ end_date: null }, { end_date: { gte: expect.any(Date) } }]);
  });

  it.each(["word", "def"])("limits exact bulk tagging to the selected %s field", async (scope) => {
    setAuthed({ id: "42", role: "ADMIN" });
    prisma.opred_v.findMany.mockResolvedValueOnce([
      { id: 1n, text_opr: "Животное", word_v: { word_text: "КОТ" } },
      { id: 2n, text_opr: "КОТ", word_v: { word_text: "БАРСИК" } },
    ]);
    const response = await POST(
      makeReq("POST", "http://localhost/api/dictionary/bulk-tags", {
        action: "applyTags",
        tagIds: [7],
        selectAllAcrossFilter: true,
        filter: { language: "ru", query: "кот", scope, searchMode: "exact" },
      }),
      makeCtx({}),
    );
    expect(await response.json()).toEqual({ applied: 1 });
    expect(prisma.opredTag.createMany).toHaveBeenCalledWith({
      data: [{ opredId: scope === "word" ? 1n : 2n, tagId: 7, addedBy: 42 }],
      skipDuplicates: true,
    });
  });
});
