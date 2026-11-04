import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/dictionary/filter-stats/route";
import { GET } from "../../app/api/dictionary/route";
import { prisma, resetMocks } from "../mocks";
import { makeCtx, makeReq } from "./_utils";

describe("dictionary search and statistics", () => {
  beforeEach(() => {
    resetMocks();
    prisma.word_v.count.mockResolvedValue(1);
    prisma.opred_v.count.mockResolvedValue(1);
    prisma.opred_v.groupBy.mockResolvedValue([]);
  });

  it.each(["list", "stats"])("keeps definitions when exact word search matches (%s)", async (endpoint) => {
    prisma.word_v.findMany.mockResolvedValue([
      {
        id: 1n,
        word_text: "cactus",
        length: 6,
        opred_v: [{ id: 11n, text_opr: "A desert plant", difficulty: 1, length: 14, tags: [] }],
      },
    ]);
    const response =
      endpoint === "list"
        ? await GET(makeReq("GET", "http://localhost/api/dictionary?q=cactus&scope=word&mode=exact"), makeCtx({}))
        : await POST(
            makeReq("POST", "http://localhost/api/dictionary/filter-stats", {
              language: "ru",
              query: "cactus",
              scope: "word",
              searchMode: "exact",
            }),
            makeCtx({}),
          );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.totalDefs).toBe(1);
    if (endpoint === "list") {
      expect(result.total).toBe(1);
      expect(result.items[0].opred_v[0].text_opr).toBe("A desert plant");
    } else {
      expect(result.totalWords).toBe(1);
      expect(result.difficultyCounts).toEqual([{ difficulty: 1, count: 1 }]);
    }
  });

  it.each(["exact", "startsWith"])("keeps only definitions selected by the combined %s search", async (searchMode) => {
    const rows = [
      {
        id: 1n,
        word_text: "кот",
        length: 3,
        opred_v: [
          { id: 11n, text_opr: "кот домашний", difficulty: 1, length: 12, tags: [] },
          { id: 12n, text_opr: "Животное", difficulty: 1, length: 8, tags: [] },
        ],
      },
      {
        id: 2n,
        word_text: "барсик",
        length: 6,
        opred_v: [
          { id: 21n, text_opr: "кот домашний", difficulty: 1, length: 12, tags: [] },
          { id: 22n, text_opr: "Животное", difficulty: 1, length: 8, tags: [] },
        ],
      },
    ];
    prisma.word_v.findMany.mockResolvedValue(rows);
    const response = await GET(
      makeReq("GET", `http://localhost/api/dictionary?q=кот&scope=both&mode=${searchMode}`),
      makeCtx({}),
    );
    const result = await response.json();
    expect(result.items.map((word: { opred_v: { id: string }[] }) => word.opred_v.map((def) => def.id))).toEqual([
      ["11", "12"],
      ["21"],
    ]);
    expect(result.totalDefs).toBe(3);
    const counts = await POST(
      makeReq("POST", "http://localhost/api/dictionary/filter-stats", {
        language: "ru",
        query: "кот",
        scope: "both",
        searchMode,
      }),
      makeCtx({}),
    );
    expect(await counts.json()).toMatchObject({ totalWords: 2, totalDefs: 3 });
  });

  it.each(["word", "def", "both"])("requires active definitions in parent queries for scope=%s", async (scope) => {
    prisma.word_v.findMany.mockResolvedValue([]);
    await GET(makeReq("GET", `http://localhost/api/dictionary?q=ghostmatch&scope=${scope}&tag=rare`), makeCtx({}));
    await POST(
      makeReq("POST", "http://localhost/api/dictionary/filter-stats", {
        language: "ru",
        query: "ghostmatch",
        scope,
        tagNames: ["rare"],
      }),
      makeCtx({}),
    );
    for (const [args] of prisma.word_v.findMany.mock.calls) {
      expect(args.where.opred_v.some).toMatchObject({ is_deleted: false, tags: expect.any(Object) });
      if (scope === "def") expect(args.where.opred_v.some.text_opr).toMatchObject({ contains: "ghostmatch" });
      if (scope === "both")
        expect(args.where.OR[1].opred_v.some).toMatchObject({
          is_deleted: false,
          text_opr: { contains: "ghostmatch" },
        });
    }
    expect(prisma.word_v.findMany).toHaveBeenCalledTimes(2);
  });
});
