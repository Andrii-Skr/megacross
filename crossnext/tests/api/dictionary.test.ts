import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/dictionary/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

describe("/api/dictionary (GET)", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "u1" }); // not required, but consistent
  });

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "Infinity",
    "",
  ])("rejects invalid page size %j before querying the database", async (take) => {
    prisma.word_v.findMany.mockResolvedValue([]);
    prisma.word_v.count.mockResolvedValue(0);
    prisma.opred_v.count.mockResolvedValue(0);
    const response = await GET(makeReq("GET", `http://localhost/api/dictionary?take=${take}`), makeCtx({}));
    expect(response.status).toBe(400);
    expect(prisma.word_v.findMany).not.toHaveBeenCalled();
  });

  it.each([1, 50, 100])("accepts positive page sizes and caps %s at 50", async (take) => {
    prisma.word_v.findMany.mockResolvedValue([]);
    prisma.word_v.count.mockResolvedValue(0);
    prisma.opred_v.count.mockResolvedValue(0);
    const response = await GET(makeReq("GET", `http://localhost/api/dictionary?take=${take}`), makeCtx({}));
    expect(response.status).toBe(200);
    expect(prisma.word_v.findMany.mock.calls[0][0].take).toBe(Math.min(take, 50) + 1);
  });

  it("returns paged items with string ids", async () => {
    prisma.word_v.findMany.mockResolvedValueOnce([
      {
        id: BigInt(1),
        word_text: "test",
        isImageable: true,
        opred_v: [
          {
            id: BigInt(11),
            text_opr: "def one",
            tags: [{ tag: { id: 1, name: "tag1" } }, { tag: { id: 2, name: "tag2" } }],
          },
        ],
      },
    ]);
    prisma.word_v.count.mockResolvedValueOnce(1);
    prisma.opred_v.count.mockResolvedValueOnce(1);
    prisma.opred_v.groupBy.mockResolvedValueOnce([{ word_id: BigInt(1), _count: { _all: 1 } }]);

    const req = makeReq("GET", "http://localhost/api/dictionary?take=20&isImageable=true");
    const res = await GET(req, makeCtx({}));
    const { status, json } = await readJson<{
      items: Array<{
        id: string;
        word_text: string;
        isImageable: boolean;
        opred_v: Array<{ id: string; text_opr: string }>;
      }>;
      nextCursor: string | null;
      total: number;
      totalDefs: number;
    }>(res);

    expect(status).toBe(200);
    expect(prisma.word_v.findMany.mock.calls[0][0].where).toMatchObject({ isImageable: true });
    expect(json.items[0].id).toBe("1");
    expect(json.items[0].isImageable).toBe(true);
    expect(json.items[0].opred_v[0].id).toBe("11");
    expect(json.total).toBe(1);
    expect(json.totalDefs).toBe(1);
    expect(json.nextCursor).toBe(null);
  });

  it.each(["exact", "startsWith"])("keeps lookahead matches across multiple %s search pages", async (mode) => {
    const candidates = ["скот", "кот", "скотина", "котик", "кот домашний"].map((word_text, index) => ({
      id: BigInt(index + 1),
      word_text,
      opred_v: [],
    }));
    prisma.word_v.findMany.mockImplementation(async (args) => {
      if (args.select) return candidates;
      const start = args.cursor ? candidates.findIndex((row) => row.id === args.cursor.id) + 1 : 0;
      return candidates.slice(start, start + args.take);
    });
    prisma.word_v.count.mockResolvedValue(candidates.length);
    prisma.opred_v.count.mockResolvedValue(0);
    prisma.opred_v.groupBy.mockResolvedValue([]);
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 6; page += 1) {
      const response = await GET(
        makeReq(
          "GET",
          `http://localhost/api/dictionary?q=кот&scope=word&mode=${mode}&take=1${cursor ? `&cursor=${cursor}` : ""}`,
        ),
        makeCtx({}),
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      ids.push(...data.items.map((item: { id: string }) => item.id));
      cursor = data.nextCursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(ids).toEqual(mode === "exact" ? ["2", "5"] : ["2", "4", "5"]);
  });
});
