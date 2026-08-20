import fs from "node:fs/promises";
import { PHOTO_IMAGE_RATIO_TOLERANCE } from "@megacross/cross-clues";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  buildWordImageStorageRelPath,
  computeImageAspectRatio,
  ensureWordImagesDir,
  isAspectRatioAllowed,
  isMissingWordImagesRelationError,
  normalizeImageMimeType,
  normalizeTargetBounds,
  resolveWordImagesDir,
  SCANWORD_WORD_IMAGE_MAX_BYTES,
  SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE,
  safeUnlink,
  sanitizeUploadFileName,
  sha256Hex,
} from "@/lib/scanwordWordImages";
import { getNumericUserId } from "@/lib/user";

function error(status: number, message: string, errorCode: string, details?: Record<string, number>) {
  return NextResponse.json({ success: false, message, errorCode, ...(details ? { details } : {}) }, { status });
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function toImageDto(image: {
  id: bigint;
  wordId: bigint;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: Prisma.Decimal;
}) {
  return {
    id: String(image.id),
    wordId: String(image.wordId),
    fileName: image.fileName,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    aspectRatio: Number(image.aspectRatio),
    url: `/api/dictionary/word-images/${String(image.id)}`,
  };
}

async function ensureAuthorized() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string | null } | null)?.role ?? null;
  const allowed = await hasPermissionAsync(role, Permissions.DictionaryWrite);
  if (!session || !allowed) {
    return { session: null, response: error(session ? 403 : 401, "Unauthorized", "UNAUTHORIZED") };
  }
  return { session, response: null };
}

async function parseWordId(raw: string): Promise<bigint | null> {
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await ensureAuthorized();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const wordId = await parseWordId(id);
  if (wordId == null) {
    return error(400, "Invalid word id", "INVALID_WORD_ID");
  }

  let images: Array<{
    id: bigint;
    wordId: bigint;
    fileName: string;
    mimeType: string;
    width: number;
    height: number;
    aspectRatio: Prisma.Decimal;
  }> = [];
  try {
    images = await prisma.scanwordWordImage.findMany({
      where: { wordId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        wordId: true,
        fileName: true,
        mimeType: true,
        width: true,
        height: true,
        aspectRatio: true,
      },
    });
  } catch (dbError) {
    if (!isMissingWordImagesRelationError(dbError)) throw dbError;
    return NextResponse.json({
      success: true,
      images: [],
      storageReady: false,
    });
  }

  return NextResponse.json({
    success: true,
    images: images.map(toImageDto),
  });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await ensureAuthorized();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const wordId = await parseWordId(id);
  if (wordId == null) {
    return error(400, "Invalid word id", "INVALID_WORD_ID");
  }

  let word: { id: bigint } | null;
  try {
    word = await prisma.word_v.findFirst({
      where: { id: wordId, is_deleted: false },
      select: { id: true },
    });
  } catch (dbError) {
    console.error("Word image upload failed while reading the word", dbError);
    return error(500, "Failed to read word data", "UPLOAD_DB_READ_FAILED");
  }
  if (!word) {
    return error(404, "Word not found", "WORD_NOT_FOUND");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (formError) {
    console.error("Word image upload failed while parsing multipart form data", formError);
    return error(400, "Invalid image upload request", "UPLOAD_FORM_INVALID");
  }
  const entry = form.get("file");
  const file = isUploadedFile(entry) ? entry : null;
  if (!file) {
    return error(400, "No image file", "UPLOAD_NO_FILE");
  }
  if (file.size <= 0) {
    return error(400, "Empty image file", "UPLOAD_EMPTY_FILE");
  }
  if (file.size > SCANWORD_WORD_IMAGE_MAX_BYTES) {
    return error(413, "Image file too large", "UPLOAD_FILE_TOO_LARGE");
  }

  const originalName = sanitizeUploadFileName(file.name || "image");
  const mimeType = normalizeImageMimeType(originalName, file.type || "");
  if (!mimeType) {
    return error(400, "Unsupported image format", "UPLOAD_UNSUPPORTED_IMAGE_FORMAT");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch (fileError) {
    console.error("Word image upload failed while reading the uploaded file", fileError);
    return error(400, "Failed to read image file", "UPLOAD_FILE_READ_FAILED");
  }
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(bytes, { failOn: "error" }).metadata();
  } catch (metadataError) {
    console.error("Word image upload failed while reading image metadata", metadataError);
    return error(400, "Failed to read image dimensions", "UPLOAD_IMAGE_DIMENSIONS_INVALID");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!(width > 0) || !(height > 0)) {
    return error(400, "Failed to read image dimensions", "UPLOAD_IMAGE_DIMENSIONS_INVALID");
  }

  const targetWidth = form.get("targetWidth");
  const targetHeight = form.get("targetHeight");
  const targetBounds = normalizeTargetBounds({
    width: typeof targetWidth === "string" ? targetWidth : null,
    height: typeof targetHeight === "string" ? targetHeight : null,
  });
  if (targetBounds && !isAspectRatioAllowed({ width, height }, targetBounds)) {
    return error(422, "Image aspect ratio does not match the cluster area", "UPLOAD_IMAGE_BAD_RATIO", {
      imageWidth: width,
      imageHeight: height,
      targetWidth: targetBounds.width,
      targetHeight: targetBounds.height,
      tolerancePercent: PHOTO_IMAGE_RATIO_TOLERANCE * 100,
    });
  }

  const sha256 = sha256Hex(bytes);
  let existing: {
    id: bigint;
    wordId: bigint;
    fileName: string;
    mimeType: string;
    width: number;
    height: number;
    aspectRatio: Prisma.Decimal;
  } | null = null;
  try {
    existing = await prisma.scanwordWordImage.findUnique({
      where: {
        wordId_sha256: {
          wordId,
          sha256,
        },
      },
      select: {
        id: true,
        wordId: true,
        fileName: true,
        mimeType: true,
        width: true,
        height: true,
        aspectRatio: true,
      },
    });
  } catch (dbError) {
    if (!isMissingWordImagesRelationError(dbError)) {
      console.error("Word image upload failed while checking for an existing image", dbError);
      return error(500, "Failed to read image data", "UPLOAD_DB_READ_FAILED");
    }
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
  if (existing) {
    return NextResponse.json({ success: true, image: toImageDto(existing) });
  }

  const storageRelPath = buildWordImageStorageRelPath(wordId, sha256, originalName);
  let absolutePath: string;
  try {
    absolutePath = await ensureWordImagesDir(storageRelPath);
    await fs.mkdir(resolveWordImagesDir(), { recursive: true });
    await fs.writeFile(absolutePath, bytes);
  } catch (storageError) {
    console.error("Word image upload failed while writing the image file", storageError);
    return error(500, "Failed to write image file", "UPLOAD_STORAGE_WRITE_FAILED");
  }

  const createdBy = getNumericUserId(auth.session?.user as { id?: string | number | null } | null);
  try {
    const created = await prisma.scanwordWordImage.create({
      data: {
        wordId,
        fileName: originalName,
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
      },
    });

    return NextResponse.json({ success: true, image: toImageDto(created) });
  } catch (dbError) {
    try {
      await safeUnlink(absolutePath);
    } catch (cleanupError) {
      console.error("Word image upload failed while cleaning up the image file", cleanupError);
    }
    if (!isMissingWordImagesRelationError(dbError)) {
      console.error("Word image upload failed while saving image data", dbError);
      return error(500, "Failed to save image data", "UPLOAD_DB_WRITE_FAILED");
    }
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
}
