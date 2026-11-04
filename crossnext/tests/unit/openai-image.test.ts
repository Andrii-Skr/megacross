import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWordImage } from "@/lib/ai/providers/openaiImage";

const input = { word: "лук", definition: "огородное растение", targetWidth: 5, targetHeight: 4 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OpenAI image provider", () => {
  it("requests exactly one image for the selected meaning and pads it to the slot ratio", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-1.5");
    vi.stubEnv("OPENAI_IMAGE_MAX_EDGE", "512");
    const source = await sharp({ create: { width: 30, height: 20, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: source.toString("base64") }] })));
    const result = await generateWordImage(input);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({ model: "gpt-image-1.5", n: 1, size: "1024x1024", output_format: "png" }),
    );
    expect(JSON.parse(String(init?.body)).prompt).toContain('"selectedDefinition":"огородное растение"');
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.width).toBe(result.width);
    expect(metadata.height).toBe(result.height);
    expect(result.width).toBe(510);
    expect(result.height).toBe(408);
    expect(result.width / result.height).toBe(5 / 4);
  });
  it.each([
    [4, 5, 256, 204, 255],
    [4, 4, 512, 512, 512],
    [6, 4, 256, 255, 170],
  ])("preserves the exact %s:%s ratio with max edge %s", async (targetWidth, targetHeight, maxEdge, width, height) => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_IMAGE_MAX_EDGE", String(maxEdge));
    const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: source.toString("base64") }] })),
    );
    const result = await generateWordImage({ ...input, targetWidth, targetHeight });
    expect([result.width, result.height]).toEqual([width, height]);
    expect(result.width / result.height).toBe(targetWidth / targetHeight);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(maxEdge);
  });
  it("requires a key before making a paid request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(generateWordImage(input)).rejects.toMatchObject({ errorCode: "AI_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [429, "AI_RATE_LIMITED"],
    [400, "AI_IMAGE_REJECTED"],
    [500, "AI_IMAGE_FAILED"],
  ])("maps upstream %s without exposing its body", async (status, errorCode) => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private upstream error", { status: Number(status) }));
    await expect(generateWordImage(input)).rejects.toMatchObject({ errorCode, message: errorCode });
  });
  it("rejects an invalid image response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "invalid-image" }] })),
    );
    await expect(generateWordImage(input)).rejects.toMatchObject({ errorCode: "AI_IMAGE_FAILED" });
  });
});
