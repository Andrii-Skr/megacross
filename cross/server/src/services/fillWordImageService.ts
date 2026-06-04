import path from "node:path";
import { Prisma, prisma } from "../db/prisma";

export type ReviewWordImageOption = {
  id: string;
  wordId: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  url: string;
};

export type StoredWordImage = ReviewWordImageOption & {
  storageRelPath: string;
};

function isStorageUnavailableError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}

function toReviewImage(row: {
  id: bigint;
  wordId: bigint;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: Prisma.Decimal | number | string;
}) {
  return {
    id: String(row.id),
    wordId: String(row.wordId),
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: Number(row.width),
    height: Number(row.height),
    aspectRatio: Number(row.aspectRatio),
    url: `/api/dictionary/word-images/${String(row.id)}`,
  };
}

export function resolveWordImagesDir(): string {
  const explicit = process.env.CROSS_WORD_IMAGES_DIR?.trim();
  if (explicit) return explicit;
  const samples = process.env.CROSS_SAMPLES_DIR?.trim();
  if (samples) return path.join(path.dirname(samples), "word-images");
  return path.resolve(process.cwd(), "var/crosswords/word-images");
}

export function buildWordImageAbsolutePath(storageRelPath: string): string {
  return path.join(resolveWordImagesDir(), storageRelPath);
}

export async function loadWordImagesByWordIds(wordIds: bigint[]): Promise<Map<string, ReviewWordImageOption[]>> {
  const uniqueWordIds = [...new Set(wordIds.map((value) => value.toString()))]
    .map((value) => BigInt(value));
  if (!uniqueWordIds.length) return new Map();
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        wordId: bigint;
        fileName: string;
        mimeType: string;
        width: number;
        height: number;
        aspectRatio: Prisma.Decimal | number | string;
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "wordId",
        "fileName",
        "mimeType",
        "width",
        "height",
        "aspectRatio"
      FROM "public"."scanword_word_images"
      WHERE "wordId" IN (${Prisma.join(uniqueWordIds)})
      ORDER BY "createdAt" DESC, "id" DESC
    `);
    const result = new Map<string, ReviewWordImageOption[]>();
    for (const row of rows) {
      const key = String(row.wordId);
      const list = result.get(key) ?? [];
      list.push(toReviewImage(row));
      result.set(key, list);
    }
    return result;
  } catch (error) {
    if (isStorageUnavailableError(error)) return new Map();
    throw error;
  }
}

export async function loadWordImagesByIds(imageIds: bigint[]): Promise<Map<string, StoredWordImage>> {
  const uniqueImageIds = [...new Set(imageIds.map((value) => value.toString()))]
    .map((value) => BigInt(value));
  if (!uniqueImageIds.length) return new Map();
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: bigint;
        wordId: bigint;
        fileName: string;
        mimeType: string;
        width: number;
        height: number;
        aspectRatio: Prisma.Decimal | number | string;
        storageRelPath: string;
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "wordId",
        "fileName",
        "mimeType",
        "width",
        "height",
        "aspectRatio",
        "storageRelPath"
      FROM "public"."scanword_word_images"
      WHERE "id" IN (${Prisma.join(uniqueImageIds)})
    `);
    return new Map(
      rows.map((row) => [
        String(row.id),
        {
          ...toReviewImage(row),
          storageRelPath: row.storageRelPath,
        },
      ]),
    );
  } catch (error) {
    if (isStorageUnavailableError(error)) return new Map();
    throw error;
  }
}
