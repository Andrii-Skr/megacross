import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildEmbeddedImageHref } from "./svgEmbeddedImage";

function decodeDataUri(dataUri: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUri);
  assert.ok(match, "Expected data URI");
  return {
    mimeType: match[1]!,
    buffer: Buffer.from(match[2]!, "base64"),
  };
}

test("buildEmbeddedImageHref returns original bytes when grayscale is disabled", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "svg-photo-clues-"));
  try {
    const filePath = path.join(dir, "color.png");
    const original = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    await writeFile(filePath, original);

    const href = await buildEmbeddedImageHref("color.png", filePath, { grayscale: false });
    const decoded = decodeDataUri(href);

    assert.equal(decoded.mimeType, "image/png");
    assert.deepEqual(decoded.buffer, original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("buildEmbeddedImageHref converts raster images to grayscale when enabled", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "svg-photo-clues-"));
  try {
    const filePath = path.join(dir, "color.png");
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toFile(filePath);

    const href = await buildEmbeddedImageHref("color.png", filePath, { grayscale: true });
    const decoded = decodeDataUri(href);
    const pixel = await sharp(decoded.buffer).raw().toBuffer();

    assert.equal(decoded.mimeType, "image/png");
    assert.equal(pixel[0], pixel[1]);
    assert.equal(pixel[1], pixel[2]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("buildEmbeddedImageHref crops raster images to target aspect ratio", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "svg-photo-clues-"));
  try {
    const filePath = path.join(dir, "wide.png");
    await sharp({
      create: {
        width: 450,
        height: 460,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toFile(filePath);

    const href = await buildEmbeddedImageHref("wide.png", filePath, {
      targetAspectRatio: 1,
    });
    const decoded = decodeDataUri(href);
    const metadata = await sharp(decoded.buffer).metadata();

    assert.equal(decoded.mimeType, "image/png");
    assert.equal(metadata.width, 450);
    assert.equal(metadata.height, 450);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("buildEmbeddedImageHref leaves SVG payloads unchanged even when grayscale is enabled", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "svg-photo-clues-"));
  try {
    const filePath = path.join(dir, "icon.svg");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#ff0000"/></svg>';
    await writeFile(filePath, svg, "utf8");

    const href = await buildEmbeddedImageHref("icon.svg", filePath, { grayscale: true });
    const decoded = decodeDataUri(href);
    const original = await readFile(filePath);

    assert.equal(decoded.mimeType, "image/svg+xml");
    assert.deepEqual(decoded.buffer, original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
