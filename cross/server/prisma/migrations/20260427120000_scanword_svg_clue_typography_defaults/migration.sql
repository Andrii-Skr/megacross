ALTER TABLE "public"."scanword_issue_svg_settings"
  ALTER COLUMN "clueFontBasePt" SET DEFAULT 9,
  ALTER COLUMN "clueFontMinPt" SET DEFAULT 8;

UPDATE "public"."scanword_issue_svg_settings"
SET
  "clueFontBasePt" = 9,
  "clueFontMinPt" = 8,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "clueFontBasePt" = 7 AND "clueFontMinPt" = 7;
