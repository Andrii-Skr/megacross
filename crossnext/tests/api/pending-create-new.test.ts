import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/pending/create-new/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makePrismaKnownError, makeReq, readJson } from "./_utils";

describe("/api/pending/create-new (POST)", () => {
  beforeEach(() => {
    resetMocks();
    prisma.language.findUnique.mockResolvedValue({ id: 9, code: "ru" });
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  });

  it("requires auth", async () => {
    setAuthed(null);
    const req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "abc",
      definition: "d",
      language: "ru",
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{
      success: boolean;
      message: string;
    }>(res);
    expect(status).toBe(401);
    expect(json.message).toBe("Unauthorized");
  });

  it("validates empty/invalid word and uniqueness", async () => {
    setAuthed({ id: "u1" });
    // Empty after normalization
    let req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "   ",
      definition: "d",
      language: "ru",
    });
    let res = await POST(req, makeCtx({}));
    let parsed = await readJson<{ success: boolean; message: string }>(res);
    expect(parsed.status).toBe(400);
    expect(parsed.json.message).toBe("Empty word");

    // Non-letters
    req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "abc123",
      definition: "d",
      language: "ru",
    });
    res = await POST(req, makeCtx({}));
    parsed = await readJson(res);
    expect(parsed.status).toBe(400);

    // Duplicate
    prisma.word_v.findFirst.mockResolvedValueOnce({ id: BigInt(1) });
    req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "abc",
      definition: "d",
      language: "ru",
    });
    res = await POST(req, makeCtx({}));
    parsed = await readJson(res);
    expect(parsed.status).toBe(409);
  });

  it.each([3, 9])("checks duplicates within the requested language when existing langId=%s", async (existingLangId) => {
    const existing = { id: 1n, langId: existingLangId, word_text: "такси" };
    prisma.word_v.findFirst.mockImplementation(async ({ where }) =>
      where.word_text === existing.word_text && (where.langId == null || where.langId === existing.langId)
        ? { id: existing.id }
        : null,
    );
    prisma.pendingWords.create.mockResolvedValue({ id: 42n, descriptions: [] });
    const response = await POST(
      makeReq("POST", "http://localhost/api/pending/create-new", {
        word: "Такси",
        definition: "Автомобиль",
        language: "RU",
      }),
      makeCtx({}),
    );
    expect(response.status).toBe(existingLangId === 9 ? 409 : 200);
    if (existingLangId === 9) expect(prisma.pendingWords.create).not.toHaveBeenCalled();
    else expect(prisma.pendingWords.create.mock.calls[0][0].data.langId).toBe(9);
  });

  it("returns 400 if language not found", async () => {
    setAuthed({ id: "u1" });
    prisma.word_v.findFirst.mockResolvedValueOnce(null);
    prisma.language.findUnique.mockResolvedValueOnce(null);

    const req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "abc",
      definition: "d",
      language: "xx",
    });
    const res = await POST(req, makeCtx({}));
    const { status } = await readJson(res);
    expect(status).toBe(400);
  });

  it("creates pending word and returns id", async () => {
    setAuthed({ id: "u1" });
    prisma.word_v.findFirst.mockResolvedValueOnce(null);
    prisma.language.findUnique.mockResolvedValueOnce({ id: 9, code: "ru" });
    prisma.pendingWords.create.mockResolvedValueOnce({
      id: BigInt(42),
      descriptions: [{ id: BigInt(77) }],
    });

    const req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "Абс",
      definition: "def",
      language: "ru",
      tags: [1, 2],
      note: "n",
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ success: boolean; id: string }>(res);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe("42");
    const createArgs = prisma.pendingWords.create.mock.calls[0]?.[0] as
      | { data?: { descriptions?: { create?: Array<Record<string, unknown>> } } }
      | undefined;
    expect(createArgs?.data?.descriptions?.create?.length).toBe(1);
  });

  it.each([true, false, undefined])("stores new-word imageability %s for moderation", async (isImageable) => {
    prisma.word_v.findFirst.mockResolvedValueOnce(null);
    prisma.language.findUnique.mockResolvedValueOnce({ id: 9, code: "ru" });
    prisma.pendingWords.create.mockResolvedValueOnce({ id: 42n, descriptions: [] });
    const res = await POST(
      makeReq("POST", "http://localhost/api/pending/create-new", {
        word: "кактус",
        definition: "Растение",
        language: "ru",
        isImageable,
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(prisma.pendingWords.create.mock.calls[0][0].data.note).isImageable).toBe(isImageable ?? false);
    expect(prisma.word_v.update).not.toHaveBeenCalled();
  });

  it("stores end date when provided", async () => {
    setAuthed({ id: "u1" });
    prisma.word_v.findFirst.mockResolvedValueOnce(null);
    prisma.language.findUnique.mockResolvedValueOnce({ id: 9, code: "ru" });
    const descriptionId = BigInt(88);
    prisma.pendingWords.create.mockResolvedValueOnce({
      id: BigInt(43),
      descriptions: [{ id: descriptionId }],
    });

    const endDate = "2025-10-01T23:59:59.999Z";
    const req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "Абс",
      definitions: [{ definition: "def", end_date: endDate }],
      language: "ru",
    });
    await POST(req, makeCtx({}));

    const createArgs = prisma.pendingWords.create.mock.calls[0]?.[0] as
      | { data?: { descriptions?: { create?: Array<Record<string, unknown>> } } }
      | undefined;
    const created = createArgs?.data?.descriptions?.create?.[0] as { end_date?: Date } | undefined;
    expect(created?.end_date).toEqual(new Date(endDate));
  });

  it("resyncs pending sequences and retries on unique id conflict", async () => {
    setAuthed({ id: "u1" });
    prisma.word_v.findFirst.mockResolvedValueOnce(null);
    prisma.language.findUnique.mockResolvedValueOnce({ id: 9, code: "ru" });
    prisma.pendingWords.create.mockRejectedValueOnce(makePrismaKnownError("P2002", { target: ["id"] }));
    prisma.pendingWords.create.mockResolvedValueOnce({
      id: BigInt(44),
      descriptions: [{ id: BigInt(89) }],
    });
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const req = makeReq("POST", "http://localhost/api/pending/create-new", {
      word: "абв",
      definition: "def",
      language: "ru",
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ success: boolean; id: string }>(res);
    expect(status).toBe(200);
    expect(json.id).toBe("44");
    expect(prisma.pendingWords.create).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
