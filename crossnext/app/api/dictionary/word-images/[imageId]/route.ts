import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  buildWordImageAbsolutePath,
  isMissingWordImagesRelationError,
  SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE,
} from "@/lib/scanwordWordImages";

function error(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

function parseBigIntSafe(raw: string): bigint | null {
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, context: { params: Promise<{ imageId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string | null } | null)?.role ?? null;
  const allowed = await hasPermissionAsync(role, Permissions.DictionaryWrite);
  if (!session || !allowed) {
    return error(session ? 403 : 401, "Unauthorized", "UNAUTHORIZED");
  }

  const { imageId } = await context.params;
  const parsedImageId = parseBigIntSafe(imageId);
  if (parsedImageId == null) {
    return error(400, "Invalid image id", "INVALID_IMAGE_ID");
  }

  let image: { mimeType: string; storageRelPath: string } | null = null;
  try {
    image = await prisma.scanwordWordImage.findUnique({
      where: { id: parsedImageId },
      select: {
        mimeType: true,
        storageRelPath: true,
      },
    });
  } catch (dbError) {
    if (!isMissingWordImagesRelationError(dbError)) throw dbError;
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
  if (!image) {
    return error(404, "Image not found", "IMAGE_NOT_FOUND");
  }

  try {
    const buffer = await fs.readFile(buildWordImageAbsolutePath(image.storageRelPath));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return error(404, "Image file not found", "IMAGE_FILE_NOT_FOUND");
  }
}
