import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  buildWordImageAbsolutePath,
  isMissingWordImagesRelationError,
  SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE,
  safeUnlink,
} from "@/lib/scanwordWordImages";

function error(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

async function ensureAuthorized() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string | null } | null)?.role ?? null;
  const allowed = await hasPermissionAsync(role, Permissions.DictionaryWrite);
  if (!session || !allowed) {
    return error(session ? 403 : 401, "Unauthorized", "UNAUTHORIZED");
  }
  return null;
}

function parseBigIntSafe(raw: string): bigint | null {
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string; imageId: string }> }) {
  const authError = await ensureAuthorized();
  if (authError) return authError;

  const { id, imageId } = await context.params;
  const wordId = parseBigIntSafe(id);
  const parsedImageId = parseBigIntSafe(imageId);
  if (wordId == null || parsedImageId == null) {
    return error(400, "Invalid image id", "INVALID_IMAGE_ID");
  }

  let image: { id: bigint; storageRelPath: string } | null = null;
  try {
    image = await prisma.scanwordWordImage.findFirst({
      where: {
        id: parsedImageId,
        wordId,
      },
      select: {
        id: true,
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
    await prisma.scanwordWordImage.delete({
      where: { id: parsedImageId },
    });
  } catch (dbError) {
    if (!isMissingWordImagesRelationError(dbError)) throw dbError;
    return error(503, SCANWORD_WORD_IMAGES_NOT_READY_MESSAGE, "WORD_IMAGE_STORAGE_NOT_READY");
  }
  await safeUnlink(buildWordImageAbsolutePath(image.storageRelPath));

  return NextResponse.json({ success: true, id: imageId });
}
