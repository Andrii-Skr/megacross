import { randomUUID } from "node:crypto";
import { z } from "zod";

const positiveId = z.string().regex(/^[1-9]\d*$/);
const wordIdentityFields = {
  wordId: positiveId,
  word: z.string().min(1),
  language: z.string().min(1),
  imageGeneratedAt: z.iso.datetime().nullable(),
};
export const wordImageFlagTransferRowSchema = z.object({ ...wordIdentityFields, isImageable: z.boolean() });
export const wordImageTransferRowSchema = z
  .object({
    ...wordIdentityFields,
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    storageRelPath: z.string().min(1).max(255),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: positiveId,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    aspectRatio: z.string().regex(/^\d+(\.\d+)?$/),
    needsReview: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(
    (row) =>
      row.storageRelPath.startsWith(`${row.wordId}/`) &&
      !row.storageRelPath.split("/").some((part) => part === "." || part === ".." || !part) &&
      !row.storageRelPath.includes("\\"),
    { message: "Image path must remain inside its word directory" },
  );

export type WordImageTransferRow = z.infer<typeof wordImageTransferRowSchema>;

function buildWordMatchValidationSql(table: "word_images_transfer" | "word_image_flags_transfer"): string {
  return `DO $validate_words$
DECLARE mismatch text;
BEGIN
  SELECT string_agg(DISTINCT s."wordId"::text, ', ') INTO mismatch
  FROM ${table} s
  LEFT JOIN word_v w ON w.id = s."wordId"
  LEFT JOIN language l ON l.id = w."langId"
  WHERE w.id IS NULL OR w.word_text IS DISTINCT FROM s.word OR l.code IS DISTINCT FROM s.language;
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Destination words do not match export (wordId): %', mismatch;
  END IF;
END
$validate_words$;`;
}

/** A data-only import: image IDs and creator IDs are deliberately not transferred. */
function buildWordImageImportBody(input: unknown): string {
  const rows = z.array(wordImageTransferRowSchema).parse(input);
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.wordId}:${row.sha256}`;
    if (seen.has(key)) throw new Error(`Duplicate image in export for word ${row.wordId}`);
    seen.add(key);
  }
  const data = JSON.stringify(rows);
  let delimiter: string;
  do {
    delimiter = `$word_images_${randomUUID().replaceAll("-", "")}$`;
  } while (data.includes(delimiter));
  return `-- Word image metadata export: ${rows.length} images. Apply after copying word-images/.
-- Run with: psql -v ON_ERROR_STOP=1 -f word-images-export.sql
CREATE TEMP TABLE word_images_transfer ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${delimiter}${data}${delimiter}::jsonb) AS x(
  "wordId" bigint, word text, language text, "imageGeneratedAt" timestamp,
  "fileName" text, "mimeType" text, "storageRelPath" text, sha256 text,
  "sizeBytes" bigint, width integer, height integer, "aspectRatio" numeric,
  "needsReview" boolean, "createdAt" timestamp, "updatedAt" timestamp
);

-- Fail before inserting anything if the destination dictionary has different IDs/words/languages.
${buildWordMatchValidationSql("word_images_transfer")}

WITH inserted AS (
  INSERT INTO scanword_word_images (
    "wordId", "fileName", "mimeType", "storageRelPath", sha256, "sizeBytes",
    width, height, "aspectRatio", "needsReview", "createdAt", "updatedAt"
  )
  SELECT "wordId", "fileName", "mimeType", "storageRelPath", sha256, "sizeBytes",
    width, height, "aspectRatio", "needsReview", "createdAt", "updatedAt"
  FROM word_images_transfer
  ON CONFLICT ("wordId", sha256) DO NOTHING
  RETURNING id
)
SELECT (SELECT count(*) FROM word_images_transfer) AS exported_images,
       count(*) AS inserted_images,
       (SELECT count(*) FROM word_images_transfer) - count(*) AS skipped_images
FROM inserted;

UPDATE word_v w
SET "isImageable" = true,
    "imageGeneratedAt" = COALESCE(w."imageGeneratedAt", s.generated_at)
FROM (SELECT "wordId", max("imageGeneratedAt") AS generated_at
      FROM word_images_transfer GROUP BY "wordId") s
WHERE w.id = s."wordId";
`;
}

/** Copy positive image flags for all words, including words without imported images. */
function buildWordImageFlagsImportBody(input: unknown): string {
  const rows = z.array(wordImageFlagTransferRowSchema).parse(input);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.wordId)) throw new Error(`Duplicate word in flag export: ${row.wordId}`);
    seen.add(row.wordId);
  }
  const data = JSON.stringify(rows);
  let delimiter: string;
  do {
    delimiter = `$word_flags_${randomUUID().replaceAll("-", "")}$`;
  } while (data.includes(delimiter));
  return `-- Image flags export: ${rows.length} words. Requires current word_v schema migrations.
CREATE TEMP TABLE word_image_flags_transfer ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${delimiter}${data}${delimiter}::jsonb) AS x(
  "wordId" bigint, word text, language text, "isImageable" boolean, "imageGeneratedAt" timestamp
);
${buildWordMatchValidationSql("word_image_flags_transfer")}
WITH updated AS (
  UPDATE word_v w
  SET "isImageable" = w."isImageable" OR s."isImageable",
      "imageGeneratedAt" = COALESCE(w."imageGeneratedAt", s."imageGeneratedAt")
  FROM word_image_flags_transfer s
  WHERE w.id = s."wordId"
    AND (w."isImageable" IS DISTINCT FROM (w."isImageable" OR s."isImageable")
      OR w."imageGeneratedAt" IS DISTINCT FROM COALESCE(w."imageGeneratedAt", s."imageGeneratedAt"))
  RETURNING w.id
)
SELECT (SELECT count(*) FROM word_image_flags_transfer) AS exported_words,
       count(*) AS updated_words FROM updated;
`;
}

function wrapTransferTransaction(body: string): string {
  return `BEGIN;
SET LOCAL lock_timeout = '10s';
${body}
COMMIT;
`;
}

export function buildWordImageImportSql(input: unknown): string {
  return wrapTransferTransaction(buildWordImageImportBody(input));
}

export function buildWordImageFlagsImportSql(input: unknown): string {
  return wrapTransferTransaction(buildWordImageFlagsImportBody(input));
}

/** A failure in either import rolls back images and all word flag changes together. */
export function buildCombinedWordImageImportSql(images: unknown, flags: unknown): string {
  return wrapTransferTransaction(`${buildWordImageImportBody(images)}
${buildWordImageFlagsImportBody(flags)}`);
}
