import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";

export const SCANWORD_WORD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const SCANWORD_WORD_IMAGE_RATIO_TOLERANCE = 0.08;
export const SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE =
  "Word image storage is not ready. Apply database migrations and try again.";

export type WordImageTargetBounds = {
  width: number;
  height: number;
};

export function sanitizeUploadFileName(name: string) {
  const base = path
    .basename(name)
    .replace(/[\r\n\t]/g, " ")
    .trim();
  const normalized = base.normalize("NFC");
  const safe = normalized.replace(/[^\p{L}\p{N}\p{M}\-_. ]+/gu, "_");
  return safe.replace(/_{2,}/g, "_").replace(/ {2,}/g, " ");
}

export function resolveWordImagesDir(): string {
  const explicit = process.env.CROSS_WORD_IMAGES_DIR?.trim();
  if (explicit) return explicit;

  const samples = process.env.CROSS_SAMPLES_DIR?.trim();
  if (samples) {
    return path.join(path.dirname(samples), "word-images");
  }

  return path.resolve(process.cwd(), "var/crosswords/word-images");
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeImageMimeType(fileName: string, mimeType: string): string | null {
  const ext = path.extname(fileName).toLowerCase();
  const extMime: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const fallback = extMime[ext];
  if (!fallback) return null;
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized.startsWith("image/") ? normalized : fallback;
}

export function buildWordImageStorageRelPath(wordId: bigint | string, sha256: string, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase() || ".bin";
  return path.posix.join(String(wordId), `${sha256}${ext}`);
}

export function buildWordImageAbsolutePath(storageRelPath: string): string {
  return path.join(resolveWordImagesDir(), storageRelPath);
}

export async function ensureWordImagesDir(storageRelPath: string): Promise<string> {
  const absolutePath = buildWordImageAbsolutePath(storageRelPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

export function normalizeTargetBounds(input: {
  width?: string | number | null;
  height?: string | number | null;
}): WordImageTargetBounds | null {
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    width: Math.trunc(width),
    height: Math.trunc(height),
  };
}

export function computeImageAspectRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return width / height;
}

export function isAspectRatioAllowed(
  image: { width: number; height: number },
  targetBounds: WordImageTargetBounds,
): boolean {
  const imageRatio = computeImageAspectRatio(image.width, image.height);
  const targetRatio = computeImageAspectRatio(targetBounds.width, targetBounds.height);
  if (!(imageRatio > 0) || !(targetRatio > 0)) return false;
  return Math.abs(imageRatio - targetRatio) / targetRatio <= SCANWORD_WORD_IMAGE_RATIO_TOLERANCE;
}

export async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return;
    throw error;
  }
}

export function isMissingWordImagesRelationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") {
      const meta = error.meta as { code?: unknown; message?: unknown } | undefined;
      if (meta?.code === "42P01") return true;
      if (typeof meta?.message === "string" && meta.message.includes("scanword_word_images")) return true;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("scanword_word_images") && (message.includes("does not exist") || message.includes("42p01"))
    );
  }

  return false;
}
