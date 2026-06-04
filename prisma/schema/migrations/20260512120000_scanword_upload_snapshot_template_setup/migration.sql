DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'scanword_upload_snapshots'
  ) THEN
    ALTER TABLE "public"."scanword_upload_snapshots"
      ADD COLUMN IF NOT EXISTS "templateSetup" JSONB;
  END IF;
END $$;
