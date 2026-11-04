import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWordImage, ImageGenerationError } from "@/lib/ai/providers/openaiImage";
import { Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { storeWordImage } from "@/lib/storeWordImage";
import { getNumericUserId } from "@/lib/user";
import { apiRoute } from "@/utils/appRoute";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  definition: z.string().trim().min(1).max(512),
  targetWidth: z.number().int().min(1).max(128),
  targetHeight: z.number().int().min(1).max(128),
});

export const POST = apiRoute<z.infer<typeof schema>, { id: string }>(
  async (_req, body, params, user) => {
    if (!/^[1-9]\d*$/.test(params.id)) {
      return NextResponse.json({ success: false, errorCode: "INVALID_WORD_ID" }, { status: 400 });
    }
    const wordId = BigInt(params.id);
    const word = await prisma.word_v.findFirst({
      where: { id: wordId, is_deleted: false },
      select: { word_text: true, imageGeneratedAt: true },
    });
    if (!word) return NextResponse.json({ success: false, errorCode: "WORD_NOT_FOUND" }, { status: 404 });

    try {
      const image = await generateWordImage({ word: word.word_text, ...body });
      return await storeWordImage({
        wordId,
        ...image,
        originalName: "generated.png",
        generatedWord: word.word_text,
        mimeType: "image/png",
        createdBy: getNumericUserId(user),
        generatedAt: word.imageGeneratedAt ?? new Date(),
      });
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        return NextResponse.json({ success: false, errorCode: error.errorCode }, { status: error.status });
      }
      throw error;
    }
  },
  { schema, requireAuth: true, permissions: [Permissions.DictionaryWrite] },
);
