import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEmbeddedImageHref } from "../../../cross/server/src/utils/svgEmbeddedImage";
import { POST } from "../../app/api/dictionary/word/[id]/images/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makePrismaKnownError } from "./_utils";

let directory: string;
let record: Record<string, unknown> | null;
let bytes: Buffer;
const request = (data = bytes, name = "cat.png", target?: [number, number]) => {
  const file = new File([Uint8Array.from(data)], name, { type: name.endsWith("jpg") ? "image/jpeg" : "image/png" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => Uint8Array.from(data).buffer });
  const form = new FormData();
  form.set("file", file);
  if (target) {
    form.set("targetWidth", String(target[0]));
    form.set("targetHeight", String(target[1]));
  }
  return { formData: async () => form } as Request;
};
const upload = (req = request()) => POST(req, makeCtx({ id: "10" }));
const storedPath = () => {
  if (!record?.storageRelPath) throw new Error("Missing stored image");
  return path.join(directory, String(record.storageRelPath));
};
beforeEach(async () => {
  resetMocks();
  setAuthed({ id: "17", role: "ADMIN" });
  directory = await mkdtemp(path.join(os.tmpdir(), "megacross-image-storage-"));
  vi.stubEnv("CROSS_WORD_IMAGES_DIR", directory);
  bytes = await sharp({ create: { width: 200, height: 100, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  record = null;
  prisma.word_v.findFirst.mockResolvedValue({ id: 10n });
  prisma.scanwordWordImage.findUnique.mockImplementation(async () => record);
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  prisma.scanwordWordImage.create.mockImplementation(async ({ data }) => {
    record = { ...data, id: 5n };
    return record;
  });
  prisma.scanwordWordImage.update.mockImplementation(async ({ data }) => {
    if (!record) throw new Error("Missing test image");
    Object.assign(record, data);
    return record;
  });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("word image storage", () => {
  it("returns the winning row to both concurrent uploads and removes only the losing file", async () => {
    let scans = 0,
      releaseScans!: () => void,
      releaseFailure!: () => void;
    const scanned = new Promise<void>((resolve) => {
      releaseScans = resolve;
    });
    const winnerFinished = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    prisma.scanwordWordImage.findUnique.mockImplementation(async () => {
      if (++scans <= 2) {
        if (scans === 2) releaseScans();
        await scanned;
        return null;
      }
      return record;
    });
    prisma.scanwordWordImage.create.mockImplementation(async ({ data }) => {
      if (record) {
        await winnerFinished;
        throw makePrismaKnownError("P2002");
      }
      record = { ...data, id: 5n };
      return record;
    });
    const first = upload();
    const second = upload();
    const winner = await Promise.race([first, second]);
    expect(winner.status).toBe(200);
    releaseFailure();
    const responses = await Promise.all([first, second]);
    expect(responses.map((item) => item.status)).toEqual([200, 200]);
    const ids = await Promise.all(responses.map(async (response) => (await response.json()).image.id));
    expect(ids).toEqual(["5", "5"]);
    expect(await readFile(storedPath())).toEqual(bytes);
    expect(await readdir(path.dirname(storedPath()))).toEqual([path.basename(storedPath())]);
  });
  it("removes an uncommitted upload's private file on a database failure", async () => {
    prisma.scanwordWordImage.create.mockRejectedValue(new Error("database unavailable"));
    expect((await upload()).status).toBe(500);
    expect(await readdir(path.join(directory, "10"))).toEqual([]);
  });
  it("preserves its file if the transaction committed before reporting a connection error", async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      await callback(prisma);
      throw new Error("connection lost after commit");
    });
    expect((await upload()).status).toBe(200);
    expect(await readFile(storedPath())).toEqual(bytes);
  });
  it("preserves a possibly committed file if the ownership lookup also fails", async () => {
    prisma.scanwordWordImage.findUnique
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("cannot verify commit"));
    prisma.$transaction.mockImplementation(async (callback) => {
      await callback(prisma);
      throw new Error("connection lost");
    });
    expect((await upload()).status).toBe(500);
    await expect(access(storedPath())).resolves.toBeUndefined();
  });
  it("repairs a missing file on repeated upload without creating a second row", async () => {
    expect((await upload()).status).toBe(200);
    await rm(storedPath());
    prisma.scanwordWordImage.create.mockClear();
    expect((await upload()).status).toBe(200);
    expect(await readFile(storedPath())).toEqual(bytes);
    expect(prisma.scanwordWordImage.create).not.toHaveBeenCalled();
  });
  it("uses displayed dimensions for EXIF photos and repairs legacy dimensions on repeated upload", async () => {
    const jpeg = await sharp({ create: { width: 120, height: 240, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await upload(request(jpeg, "photo.jpg", [2, 1]))).status).toBe(200);
    expect(record).toMatchObject({ width: 240, height: 120 });
    if (!record) throw new Error("Missing test image");
    Object.assign(record, { width: 120, height: 240 });
    expect((await upload(request(jpeg, "photo.jpg", [2, 1]))).status).toBe(200);
    expect(record).toMatchObject({ width: 240, height: 120 });
  });
  it.each([undefined, 2])("orients an existing photo before export and crop (ratio %s)", async (targetAspectRatio) => {
    const jpeg = await sharp({ create: { width: 120, height: 240, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const file = path.join(directory, "photo.jpg");
    await writeFile(file, jpeg);
    const href = await buildEmbeddedImageHref("photo.jpg", file, { targetAspectRatio });
    const exported = Buffer.from(href.split(",")[1], "base64");
    const metadata = await sharp(exported).metadata();
    expect([metadata.width, metadata.height]).toEqual([240, 120]);
    expect(metadata.orientation).toBeUndefined();
  });
});
