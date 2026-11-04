import sharp from "sharp";
import { z } from "zod";
import { buildWordImagePrompt } from "@/lib/ai/prompts";
import { SCANWORD_WORD_IMAGE_MAX_BYTES } from "@/lib/scanwordWordImages";

const responseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z
          .string()
          .min(1)
          .max(20 * 1024 * 1024),
      }),
    )
    .min(1),
});

export class ImageGenerationError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
  ) {
    super(errorCode);
  }
}

export async function generateWordImage(input: {
  word: string;
  definition: string;
  targetWidth: number;
  targetHeight: number;
}) {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)?.trim();
  if (!apiKey) throw new ImageGenerationError(503, "AI_NOT_CONFIGURED");
  const maxEdge = z.coerce
    .number()
    .int()
    .min(128)
    .max(2048)
    .parse(process.env.OPENAI_IMAGE_MAX_EDGE || 512);
  const ratio = input.targetWidth / input.targetHeight;
  const size = ratio >= 1.5 ? "1536x1024" : ratio <= 1 / 1.5 ? "1024x1536" : "1024x1024";
  const timeout = Math.max(1000, Math.min(300000, Number(process.env.OPENAI_IMAGE_TIMEOUT_MS) || 180000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
        prompt: buildWordImagePrompt(input.word, input.definition, ratio),
        n: 1,
        size,
        quality: "medium",
        output_format: "png",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Do not return upstream bodies (or credentials/configuration details) to the browser.
      if (response.status === 429) throw new ImageGenerationError(429, "AI_RATE_LIMITED");
      if (response.status === 400) throw new ImageGenerationError(422, "AI_IMAGE_REJECTED");
      throw new ImageGenerationError(502, "AI_IMAGE_FAILED");
    }
    const payload = responseSchema.safeParse(await response.json());
    if (!payload.success) throw new ImageGenerationError(502, "AI_IMAGE_FAILED");
    const bytes = Buffer.from(payload.data.data[0].b64_json, "base64");
    // Pad rather than cut away identifying parts. Output always matches the photo slot's ratio.
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(input.targetWidth, input.targetHeight);
    const unitWidth = input.targetWidth / divisor;
    const unitHeight = input.targetHeight / divisor;
    const scale = Math.max(1, Math.floor(maxEdge / Math.max(unitWidth, unitHeight)));
    const width = unitWidth * scale;
    const height = unitHeight * scale;
    const output = await sharp(bytes, { failOn: "error", limitInputPixels: 20_000_000 })
      .rotate()
      .resize(width, height, { fit: "contain", background: "#ffffff" })
      .png()
      .toBuffer();
    if (output.byteLength > SCANWORD_WORD_IMAGE_MAX_BYTES) throw new ImageGenerationError(502, "AI_IMAGE_FAILED");
    return { bytes: output, width, height };
  } catch (error) {
    if (controller.signal.aborted) throw new ImageGenerationError(504, "AI_IMAGE_TIMEOUT");
    if (error instanceof ImageGenerationError) throw error;
    throw new ImageGenerationError(502, "AI_IMAGE_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
