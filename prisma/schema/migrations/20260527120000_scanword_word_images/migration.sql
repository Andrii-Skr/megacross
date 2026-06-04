CREATE TABLE IF NOT EXISTS "public"."scanword_word_images" (
  "id" BIGSERIAL PRIMARY KEY,
  "wordId" BIGINT NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "storageRelPath" VARCHAR(255) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "aspectRatio" DECIMAL(12, 6) NOT NULL,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_scanword_word_images_word"
  ON "public"."scanword_word_images" ("wordId");

CREATE UNIQUE INDEX IF NOT EXISTS "scanword_word_images_wordId_sha256_key"
  ON "public"."scanword_word_images" ("wordId", "sha256");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scanword_word_images_wordId_fkey'
  ) THEN
    ALTER TABLE "public"."scanword_word_images"
      ADD CONSTRAINT "scanword_word_images_wordId_fkey"
      FOREIGN KEY ("wordId") REFERENCES "public"."word_v"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
