import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/dictionary/word/[id]/images/generate/route";
import { generateWordImage, ImageGenerationError } from "@/lib/ai/providers/openaiImage";
import { storeWordImage } from "@/lib/storeWordImage";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

vi.mock("@/lib/ai/providers/openaiImage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/providers/openaiImage")>();
  return { ...original, generateWordImage: vi.fn() };
});
vi.mock("@/lib/storeWordImage", () => ({ storeWordImage: vi.fn() }));

const body = { definition: "домашний хищник", targetWidth: 5, targetHeight: 4 };
const request = (data: unknown = body) =>
  makeReq("POST", "http://localhost/api/dictionary/word/10/images/generate", data);

describe("word image generation API", () => {
  beforeEach(() => {
    resetMocks();
    vi.mocked(generateWordImage).mockReset();
    vi.mocked(storeWordImage).mockReset();
    setAuthed({ id: "17", role: "ADMIN" });
    prisma.word_v.findFirst.mockResolvedValue({ word_text: "кот", imageGeneratedAt: null });
  });
  it("uses the DB answer and current definition, persists with review and generation tracking", async () => {
    const image = { bytes: Buffer.from("png"), width: 510, height: 408 };
    vi.mocked(generateWordImage).mockResolvedValue(image);
    vi.mocked(storeWordImage).mockResolvedValue(
      new Response(JSON.stringify({ success: true, image: { id: "42" } })) as never,
    );
    const res = await POST(request(), makeCtx({ id: "10" }));
    expect(res.status).toBe(200);
    expect(generateWordImage).toHaveBeenCalledWith({ word: "кот", ...body });
    expect(storeWordImage).toHaveBeenCalledWith(
      expect.objectContaining({
        wordId: 10n,
        ...image,
        generatedAt: expect.any(Date),
        createdBy: 17,
        originalName: "generated.png",
        generatedWord: "кот",
      }),
    );
  });
  it("preserves an existing generation date", async () => {
    const date = new Date("2026-10-01");
    prisma.word_v.findFirst.mockResolvedValue({ word_text: "кот", imageGeneratedAt: date });
    vi.mocked(generateWordImage).mockResolvedValue({ bytes: Buffer.from("png"), width: 5, height: 4 });
    vi.mocked(storeWordImage).mockResolvedValue(new Response() as never);
    await POST(request(), makeCtx({ id: "10" }));
    expect(storeWordImage).toHaveBeenCalledWith(expect.objectContaining({ generatedAt: date }));
  });
  it.each([
    "AI_NOT_CONFIGURED",
    "AI_RATE_LIMITED",
    "AI_IMAGE_TIMEOUT",
    "AI_IMAGE_REJECTED",
  ])("returns safe error %s without persistence", async (code) => {
    vi.mocked(generateWordImage).mockRejectedValue(new ImageGenerationError(503, code));
    const { json, status } = await readJson<{ errorCode: string }>(await POST(request(), makeCtx({ id: "10" })));
    expect(status).toBe(503);
    expect(json.errorCode).toBe(code);
    expect(storeWordImage).not.toHaveBeenCalled();
  });
  it("requires authentication before generation", async () => {
    setAuthed(null);
    expect((await POST(request(), makeCtx({ id: "10" }))).status).toBe(401);
    expect(generateWordImage).not.toHaveBeenCalled();
  });
  it("rejects missing meanings and invalid bounds before generation", async () => {
    expect((await POST(request({ ...body, definition: " ", targetWidth: 0 }), makeCtx({ id: "10" }))).status).toBe(400);
    expect(generateWordImage).not.toHaveBeenCalled();
  });
  it("does not generate for a deleted or missing word", async () => {
    prisma.word_v.findFirst.mockResolvedValue(null);
    expect((await POST(request(), makeCtx({ id: "10" }))).status).toBe(404);
    expect(generateWordImage).not.toHaveBeenCalled();
  });
});
