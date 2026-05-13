ALTER TABLE "public"."scanword_upload_snapshots"
  ADD COLUMN IF NOT EXISTS "templateSetup" JSONB;
