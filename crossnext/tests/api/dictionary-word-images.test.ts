import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeWordImage } from "@/lib/storeWordImage";
import { DELETE } from "../../app/api/dictionary/word/[id]/images/[imageId]/route";
import { GET, POST } from "../../app/api/dictionary/word/[id]/images/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makePrismaKnownError, readJson } from "./_utils";

const { sharpMetadataMock } = vi.hoisted(() => ({
  sharpMetadataMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(), writeFile: vi.fn(), rename: vi.fn(), access: vi.fn(), unlink: vi.fn() },
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: sharpMetadataMock,
  })),
}));

describe("/api/dictionary/word/[id]/images", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    vi.clearAllMocks();
    sharpMetadataMock.mockResolvedValue({ width: 300, height: 100 });
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
        needsReview: true,
      },
    ]);

    const res = await GET(new Request("http://localhost/api/dictionary/word/10/images"), makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ images: Array<{ id: string; url: string }> }>(res);

    expect(status).toBe(200);
    expect(json.images).toEqual([
      expect.objectContaining({
        id: "5",
        url: "/api/dictionary/word-images/5",
        needsReview: true,
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
    const { status, json } = await readJson<{
      errorCode: string;
      details: {
        imageWidth: number;
        imageHeight: number;
        targetWidth: number;
        targetHeight: number;
        tolerancePercent: number;
      };
    }>(res);

    expect(status).toBe(422);
    expect(json.errorCode).toBe("UPLOAD_IMAGE_BAD_RATIO");
    expect(json.details).toEqual({
      imageWidth: 300,
      imageHeight: 100,
      targetWidth: 1,
      targetHeight: 1,
      tolerancePercent: 8,
    });
    expect(prisma.scanwordWordImage.findUnique).not.toHaveBeenCalled();
  });

  it("returns a controlled error when image metadata cannot be read", async () => {
    sharpMetadataMock.mockRejectedValue(new Error("unsupported image"));
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });

    const form = new FormData();
    const file = new File([new Uint8Array([1, 2, 3])], "broken.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    form.append("file", file);

    const res = await POST({ formData: async () => form } as Request, makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ errorCode: string }>(res);

    expect(status).toBe(400);
    expect(json.errorCode).toBe("UPLOAD_IMAGE_DIMENSIONS_INVALID");
    expect(prisma.scanwordWordImage.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [500, 500, 4, 4],
    [510, 500, 4, 4],
    [400, 500, 4, 5],
  ])("accepts a %sx%s upload for a %sx%s photo area", async (width, height, targetWidth, targetHeight) => {
    sharpMetadataMock.mockResolvedValue({ width, height });
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });
    prisma.scanwordWordImage.findUnique.mockResolvedValue({
      id: 5n,
      wordId: 10n,
      fileName: "cat.png",
      mimeType: "image/png",
      width,
      height,
      aspectRatio: width / height,
    });

    const form = new FormData();
    const file = new File([new Uint8Array([1, 2, 3])], "cat.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    form.append("file", file);
    form.append("targetWidth", String(targetWidth));
    form.append("targetHeight", String(targetHeight));

    const res = await POST({ formData: async () => form } as Request, makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ image: { width: number; height: number } }>(res);

    expect(status).toBe(200);
    expect(json.image).toEqual(expect.objectContaining({ width, height }));
    expect(prisma.word_v.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { isImageable: true } });
  });

  it("marks a word inside the transaction when a new image is stored", async () => {
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });
    prisma.scanwordWordImage.findUnique.mockResolvedValue(null);
    prisma.scanwordWordImage.create.mockResolvedValue({
      id: 6n,
      wordId: 10n,
      fileName: "cat.png",
      mimeType: "image/png",
      width: 300,
      height: 100,
      aspectRatio: 3,
    });
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    const form = {
      get: (key: string) =>
        key === "file"
          ? { name: "cat.png", type: "image/png", size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
          : null,
    };
    const res = await POST({ formData: async () => form } as unknown as Request, makeCtx({ id: "10" }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.word_v.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { isImageable: true } });
  });

  it("atomically marks generated images for review and tracks generation only on successful storage", async () => {
    prisma.scanwordWordImage.findUnique.mockResolvedValue(null);
    prisma.scanwordWordImage.create.mockResolvedValue({
      id: 6n,
      wordId: 10n,
      fileName: "generated.png",
      mimeType: "image/png",
      width: 300,
      height: 100,
      aspectRatio: 3,
      needsReview: true,
    });
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    const generatedAt = new Date("2026-11-04");
    const res = await storeWordImage({
      wordId: 10n,
      bytes: Buffer.from("png"),
      originalName: "generated.png",
      mimeType: "image/png",
      width: 300,
      height: 100,
      createdBy: 17,
      generatedAt,
    });
    expect(res.status).toBe(200);
    expect(prisma.scanwordWordImage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ needsReview: true }) }),
    );
    expect(prisma.word_v.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: { isImageable: true, imageGeneratedAt: generatedAt },
    });
  });

  it.each([
    [[], "иран-512x512-1.png"],
    [["generated-7619.png", "иран-4x4.jpg"], "иран-512x512-3.png"],
    [["иран-512x512-1.png", "иран-512x512-3.png"], "иран-512x512-4.png"],
  ] as const)("numbers generated images after existing versions %j", async (names, expectedName) => {
    prisma.scanwordWordImage.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ id: 10n }]);
    prisma.scanwordWordImage.findMany.mockResolvedValue(names.map((fileName) => ({ fileName })));
    prisma.scanwordWordImage.create.mockImplementation(async ({ data }) => ({ ...data, id: 6n }));
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    const res = await storeWordImage({
      wordId: 10n,
      bytes: Buffer.from("png"),
      originalName: "generated.png",
      generatedWord: "ИРАН",
      mimeType: "image/png",
      width: 512,
      height: 512,
      createdBy: 17,
      generatedAt: new Date(),
    });
    const { json, status } = await readJson<{ image: { fileName: string } }>(res);
    expect(status).toBe(200);
    expect(json.image.fileName).toBe(expectedName);
    expect(prisma.scanwordWordImage.findMany).toHaveBeenCalledWith({
      where: { wordId: 10n, width: 512, height: 512 },
      select: { fileName: true },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.scanwordWordImage.findMany.mock.invocationCallOrder[0],
    );
  });

  it("accepts a multipart file-like value from another runtime realm", async () => {
    sharpMetadataMock.mockResolvedValue({ width: 400, height: 500 });
    prisma.word_v.findFirst.mockResolvedValue({ id: 10n });
    prisma.scanwordWordImage.findUnique.mockResolvedValue({
      id: 5n,
      wordId: 10n,
      fileName: "city.jpg",
      mimeType: "image/jpeg",
      width: 400,
      height: 500,
      aspectRatio: 0.8,
    });

    const fileLike = {
      name: "city.jpg",
      type: "image/jpeg",
      size: 3,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
    const form = {
      get: vi.fn((key: string) => {
        if (key === "file") return fileLike;
        if (key === "targetWidth") return "4";
        if (key === "targetHeight") return "5";
        return null;
      }),
    } as unknown as FormData;

    const res = await POST({ formData: async () => form } as Request, makeCtx({ id: "10" }));
    const { status, json } = await readJson<{ image: { width: number; height: number } }>(res);

    expect(status).toBe(200);
    expect(json.image).toEqual(expect.objectContaining({ width: 400, height: 500 }));
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
    expect(prisma.word_v.update).not.toHaveBeenCalled();
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
