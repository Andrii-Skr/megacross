import { readFile } from "node:fs/promises";
import * as path from "node:path";
import sharp from "sharp";

export const SVG_PHOTO_CLUES_GRAYSCALE_ENV = "CROSS_SVG_PHOTO_CLUES_GRAYSCALE";

const RASTER_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
]);

type BuildEmbeddedImageHrefOptions = {
  grayscale?: boolean;
  targetAspectRatio?: number;
};

export function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
}

export function isSvgPhotoCluesGrayscaleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthyEnv(env[SVG_PHOTO_CLUES_GRAYSCALE_ENV]);
}

export function resolveImageMimeType(fileName: string, sourcePath: string): string {
  const ext = path.extname(fileName || sourcePath).trim().toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".bmp":
      return "image/bmp";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

function isFinitePositive(value: number | undefined): value is number {
  return Number.isFinite(value) && value > 0;
}

async function cropRasterBufferToAspectRatio(
  buffer: Buffer,
  mimeType: string,
  targetAspectRatio: number
): Promise<Buffer> {
  if (!isFinitePositive(targetAspectRatio)) return buffer;

  const animated = mimeType === "image/gif";
  const source = sharp(buffer, { animated, pages: 1 });
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!(width > 0) || !(height > 0)) return buffer;

  const sourceAspectRatio = width / height;
  if (Math.abs(sourceAspectRatio - targetAspectRatio) / targetAspectRatio < 0.0001) {
    return buffer;
  }

  if (sourceAspectRatio > targetAspectRatio) {
    const cropWidth = Math.max(1, Math.min(width, Math.round(height * targetAspectRatio)));
    const left = Math.max(0, Math.floor((width - cropWidth) / 2));
    return source.extract({ left, top: 0, width: cropWidth, height }).toBuffer();
  }

  const cropHeight = Math.max(1, Math.min(height, Math.round(width / targetAspectRatio)));
  const top = Math.max(0, Math.floor((height - cropHeight) / 2));
  return source.extract({ left: 0, top, width, height: cropHeight }).toBuffer();
}

async function buildProcessedRasterBuffer(
  buffer: Buffer,
  mimeType: string,
  options: BuildEmbeddedImageHrefOptions
): Promise<{ buffer: Buffer; mimeType: string }> {
  const animated = mimeType === "image/gif";
  const croppedBuffer = isFinitePositive(options.targetAspectRatio)
    ? await cropRasterBufferToAspectRatio(buffer, mimeType, options.targetAspectRatio)
    : buffer;
  const pipeline = sharp(croppedBuffer, { animated }).grayscale(options.grayscale === true);
  switch (mimeType) {
    case "image/jpeg":
      return { buffer: await pipeline.jpeg().toBuffer(), mimeType };
    case "image/png":
      return { buffer: await pipeline.png().toBuffer(), mimeType };
    case "image/webp":
      return { buffer: await pipeline.webp().toBuffer(), mimeType };
    case "image/gif":
      return { buffer: await pipeline.gif().toBuffer(), mimeType };
    case "image/avif":
      return { buffer: await pipeline.avif().toBuffer(), mimeType };
    case "image/bmp":
      return { buffer: await pipeline.png().toBuffer(), mimeType: "image/png" };
    default:
      return { buffer, mimeType };
  }
}

export async function buildEmbeddedImageHref(
  fileName: string,
  sourcePath: string,
  options: BuildEmbeddedImageHrefOptions = {}
): Promise<string> {
  const originalMimeType = resolveImageMimeType(fileName, sourcePath);
  const originalBuffer = await readFile(sourcePath);

  const { buffer, mimeType } =
    RASTER_IMAGE_MIME_TYPES.has(originalMimeType)
      ? await buildProcessedRasterBuffer(originalBuffer, originalMimeType, options)
      : { buffer: originalBuffer, mimeType: originalMimeType };

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
