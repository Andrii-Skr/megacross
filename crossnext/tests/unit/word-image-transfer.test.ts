import { describe, expect, it } from "vitest";
import { buildWordImageImportSql, type WordImageTransferRow } from "@/lib/wordImageTransfer";

export const imageTransferFixture: WordImageTransferRow = {
  wordId: "10",
  word: "кот",
  language: "ru",
  imageGeneratedAt: "2026-11-04T12:00:00.123456Z",
  fileName: "кот-512x512-1.png",
  mimeType: "image/png",
  storageRelPath: `10/${"a".repeat(64)}.png`,
  sha256: "a".repeat(64),
  sizeBytes: "1234",
  width: 512,
  height: 512,
  aspectRatio: "1.000000",
  needsReview: true,
  createdAt: "2026-11-04T12:00:00.123456Z",
  updatedAt: "2026-11-04T12:00:00.123456Z",
};

describe("word image SQL transfer", () => {
  it("keeps arbitrary dictionary text as JSON data and excludes source image/creator IDs", () => {
    const row = {
      ...imageTransferFixture,
      wordId: "9007199254740993",
      storageRelPath: "9007199254740993/image.png",
      word: "'); DROP TABLE word_v; -- $validate_words$",
      id: "123456",
      createdBy: 42,
    };
    const sql = buildWordImageImportSql([row]);
    const match = sql.match(/jsonb_to_recordset\((\$word_images_[a-f0-9]+\$)([\s\S]*?)\1::jsonb\)/);
    expect(match).not.toBeNull();
    const [data] = JSON.parse(match?.[2] ?? "[]");
    expect(data.word).toBe(row.word);
    expect(data.wordId).toBe("9007199254740993");
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("createdBy");
  });
  it.each([
    "../escape.png",
    "/etc/file.png",
    "10/../escape.png",
    "11/image.png",
    "10\\image.png",
  ])("rejects an unsafe storage path %s", (storageRelPath) => {
    expect(() => buildWordImageImportSql([{ ...imageTransferFixture, storageRelPath }])).toThrow();
  });
  it("rejects duplicate image identities in the source", () => {
    expect(() => buildWordImageImportSql([imageTransferFixture, imageTransferFixture])).toThrow("Duplicate image");
  });
});
