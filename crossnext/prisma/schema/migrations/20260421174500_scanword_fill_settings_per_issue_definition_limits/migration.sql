ALTER TABLE "public"."scanword_fill_settings"
  ADD COLUMN "issueId" BIGINT,
  ADD COLUMN "definitionMaxPerCell" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "definitionMaxPerHalfCell" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "public"."scanword_fill_settings"
  DROP CONSTRAINT IF EXISTS "scanword_fill_settings_userId_key";

ALTER TABLE "public"."scanword_fill_settings"
  ADD CONSTRAINT "scanword_fill_settings_userId_issueId_key" UNIQUE ("userId", "issueId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'issues'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'scanword_fill_settings_issueId_fkey'
    ) THEN
      ALTER TABLE "public"."scanword_fill_settings"
        ADD CONSTRAINT "scanword_fill_settings_issueId_fkey"
        FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX "idx_scanword_fill_settings_user"
  ON "public"."scanword_fill_settings"("userId");

CREATE INDEX "idx_scanword_fill_settings_issue"
  ON "public"."scanword_fill_settings"("issueId");
