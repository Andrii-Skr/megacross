import { PHOTO_IMAGE_RATIO_TOLERANCE } from "@megacross/cross-clues";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  isAspectRatioAllowed,
  isMissingWordImagesRelationError,
  normalizeImageMimeType,
  normalizeTargetBounds,
  SCANWORD_WORD_IMAGE_MAX_BYTES,
  sanitizeUploadFileName,
} from "@/lib/scanwordWordImages";
import { storeWordImage, toImageDto } from "@/lib/storeWordImage";
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
    needsReview: boolean;
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
        needsReview: true,
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
  const swapped = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = metadata.autoOrient?.width ?? (swapped ? metadata.height : metadata.width) ?? 0;
  const height = metadata.autoOrient?.height ?? (swapped ? metadata.width : metadata.height) ?? 0;
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

  return storeWordImage({
    wordId,
    bytes,
    originalName,
    mimeType,
    width,
    height,
    createdBy: getNumericUserId(auth.session?.user as { id?: string | number | null } | null),
  });
}
