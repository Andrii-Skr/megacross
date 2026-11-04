import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildWordImageStorageRelPath,
  computeImageAspectRatio,
  ensureWordImagesDir,
  isMissingWordImagesRelationError,
  SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE,
  safeUnlink,
  sanitizeUploadFileName,
  sha256Hex,
  writeWordImageFile,
} from "@/lib/scanwordWordImages";

function error(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

export function toImageDto(image: {
  id: bigint;
  wordId: bigint;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: Prisma.Decimal;
  needsReview: boolean;
}) {
  return {
    id: String(image.id),
    wordId: String(image.wordId),
    fileName: image.fileName,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    aspectRatio: Number(image.aspectRatio),
    needsReview: image.needsReview,
    url: `/api/dictionary/word-images/${String(image.id)}`,
  };
}

/** Persist validated bytes through the same path for uploads and AI generation. */
export async function storeWordImage({
  wordId,
  bytes,
  originalName,
  mimeType,
  width,
  height,
  createdBy,
  generatedAt,
  generatedWord,
}: {
  wordId: bigint;
  bytes: Buffer;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  createdBy: number | null;
  generatedAt?: Date;
  generatedWord?: string;
}) {
  const sha256 = sha256Hex(bytes);
  const findExisting = () =>
    prisma.scanwordWordImage.findUnique({
      where: { wordId_sha256: { wordId, sha256 } },
      select: {
        id: true,
        wordId: true,
        fileName: true,
        mimeType: true,
        width: true,
        height: true,
        aspectRatio: true,
        needsReview: true,
        storageRelPath: true,
      },
    });
  const respondWithExisting = async (image: NonNullable<Awaited<ReturnType<typeof findExisting>>>) => {
    if (image.storageRelPath) {
      const storedPath = await ensureWordImagesDir(image.storageRelPath);
      try {
        await fs.access(storedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await writeWordImageFile(storedPath, bytes);
      }
    }
    if (image.width !== width || image.height !== height) {
      image = await prisma.scanwordWordImage.update({
        where: { id: image.id },
        data: { width, height, aspectRatio: new Prisma.Decimal(computeImageAspectRatio(width, height)) },
      });
    }
    await prisma.word_v.update({
      where: { id: wordId },
      data: { isImageable: true, ...(generatedAt ? { imageGeneratedAt: generatedAt } : {}) },
    });
    return NextResponse.json({ success: true, image: toImageDto(image) });
  };
  let existing: Awaited<ReturnType<typeof findExisting>>;
  try {
    existing = await findExisting();
  } catch (dbError) {
    if (!isMissingWordImagesRelationError(dbError)) {
      console.error("Word image upload failed while checking for an existing image", dbError);
      return error(500, "Failed to read image data", "UPLOAD_DB_READ_FAILED");
    }
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
  if (existing) {
    return respondWithExisting(existing);
  }

  const storageRelPath = buildWordImageStorageRelPath(wordId, sha256, originalName, randomUUID());
  let absolutePath: string;
  try {
    absolutePath = await ensureWordImagesDir(storageRelPath);
    await writeWordImageFile(absolutePath, bytes);
  } catch (storageError) {
    console.error("Word image upload failed while writing the image file", storageError);
    return error(500, "Failed to write image file", "UPLOAD_STORAGE_WRITE_FAILED");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      let fileName = originalName;
      if (generatedWord) {
        // Serialize numbering across processes before reading the existing versions.
        // Generation and disk I/O have already completed, so the word lock is brief.
        await tx.$queryRaw`SELECT id FROM word_v WHERE id = ${wordId} FOR UPDATE`;
        const versions = await tx.scanwordWordImage.findMany({
          where: { wordId, width, height },
          select: { fileName: true },
        });
        const stem = sanitizeUploadFileName(generatedWord.trim().toLowerCase().replace(/[\\/]/g, "-"))
          .replace(/ +/g, "-")
          .slice(0, 180);
        const prefix = `${stem}-${width}x${height}-`;
        let lastNumber = versions.length;
        for (const version of versions) {
          if (!version.fileName.startsWith(prefix)) continue;
          const suffix = version.fileName.slice(prefix.length);
          if (!/^[1-9]\d*\.png$/.test(suffix)) continue;
          const number = Number(suffix.slice(0, -4));
          if (Number.isSafeInteger(number)) lastNumber = Math.max(lastNumber, number);
        }
        fileName = `${prefix}${lastNumber + 1}.png`;
      }
      const image = await tx.scanwordWordImage.create({
        data: {
          wordId,
          needsReview: Boolean(generatedAt),
          fileName,
          mimeType,
          storageRelPath,
          sha256,
          sizeBytes: BigInt(bytes.byteLength),
          width,
          height,
          aspectRatio: new Prisma.Decimal(computeImageAspectRatio(width, height)),
          ...(createdBy != null ? { createdBy } : {}),
        },
        select: {
          id: true,
          wordId: true,
          fileName: true,
          mimeType: true,
          width: true,
          height: true,
          aspectRatio: true,
          needsReview: true,
        },
      });

      await tx.word_v.update({
        where: { id: wordId },
        data: { isImageable: true, ...(generatedAt ? { imageGeneratedAt: generatedAt } : {}) },
      });
      return image;
    });

    return NextResponse.json({ success: true, image: toImageDto(created) });
  } catch (dbError) {
    // The transaction may have committed before a connection error, or another upload won.
    // Only remove our unique file when we can establish that the stored row does not use it.
    let winner: Awaited<ReturnType<typeof findExisting>>;
    try {
      winner = await findExisting();
    } catch (lookupError) {
      console.error("Cannot establish image ownership after upload failure", lookupError);
      return error(500, "Failed to save image data", "UPLOAD_DB_WRITE_FAILED");
    }
    try {
      if (winner?.storageRelPath !== storageRelPath) await safeUnlink(absolutePath);
    } catch (cleanupError) {
      console.error("Word image upload failed while cleaning up the image file", cleanupError);
    }
    if (winner) return respondWithExisting(winner);
    if (!isMissingWordImagesRelationError(dbError)) {
      console.error("Word image upload failed while saving image data", dbError);
      return error(500, "Failed to save image data", "UPLOAD_DB_WRITE_FAILED");
    }
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
}
