import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "../../app/api/dictionary/word/[id]/images/[imageId]/route";
import { GET, POST } from "../../app/api/dictionary/word/[id]/images/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makePrismaKnownError, readJson } from "./_utils";

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 300, height: 100 }),
  })),
}));

describe("/api/dictionary/word/[id]/images", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    vi.clearAllMocks();
  });

  it("lists word images", async () => {
    prisma.scanwordWordImage.findMany.mockResolvedValue([
      {
        id: 5n,
        wordId: 10n,
        fileName: "cat.png",
        mimeType: "image/png",
        width: 200,
        height: 100,
        aspectRatio: 2,
      },
    ]);

    const res = await GET(new Request("http://localhost/api/dictionary/word/10/images"), makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ images: Array<{ id: string; url: string }> }>(res);

    expect(status).toBe(200);
    expect(json.images).toEqual([
      expect.objectContaining({
        id: "5",
        url: "/api/dictionary/word-images/5",
      }),
    ]);
  });

  it("returns empty image list when migration is not applied yet", async () => {
    prisma.scanwordWordImage.findMany.mockRejectedValue(makePrismaKnownError("P2021"));

    const res = await GET(new Request("http://localhost/api/dictionary/word/10/images"), makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ images: unknown[]; storageReady: boolean }>(res);

    expect(status).toBe(200);
    expect(json.images).toEqual([]);
    expect(json.storageReady).toBe(false);
  });

  it("rejects upload when aspect ratio does not match target cluster area", async () => {
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });

    const form = new FormData();
    const file = new File([new Uint8Array([1, 2, 3])], "cat.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    form.append("file", file);
    form.append("targetWidth", "1");
    form.append("targetHeight", "1");

    const req = {
      formData: async () => form,
    } as Request;

    const res = await POST(req, makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ errorCode: string }>(res);

    expect(status).toBe(422);
    expect(json.errorCode).toBe("UPLOAD_IMAGE_BAD_RATIO");
  });

  it("deletes stored word image", async () => {
    prisma.scanwordWordImage.findFirst.mockResolvedValue({
      id: 5n,
      storageRelPath: "10/abc.png",
    });
    prisma.scanwordWordImage.delete.mockResolvedValue({});

    const res = await DELETE(
      new Request("http://localhost/api/dictionary/word/10/images/5", { method: "DELETE" }),
      makeCtx({ id: "10", imageId: "5" }),
    );
    const { status, json } = await readJson<{ id: string }>(res);

    expect(status).toBe(200);
    expect(json.id).toBe("5");
    expect(prisma.scanwordWordImage.delete).toHaveBeenCalledWith({
      where: { id: 5n },
    });
  });

  it("returns 503 on upload when image storage table is missing", async () => {
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });
    prisma.scanwordWordImage.findUnique.mockRejectedValue(makePrismaKnownError("P2010", { code: "42P01" }));

    const form = new FormData();
    const file = new File([new Uint8Array([1, 2, 3])], "cat.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    form.append("file", file);

    const req = {
      formData: async () => form,
    } as Request;

    const res = await POST(req, makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ errorCode: string }>(res);

    expect(status).toBe(503);
    expect(json.errorCode).toBe("WORD_IMAGE_STORAGE_NOT_READY");
  });
});
