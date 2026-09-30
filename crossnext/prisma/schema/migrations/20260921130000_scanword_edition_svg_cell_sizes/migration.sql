CREATE TABLE "public"."scanword_edition_svg_layout_settings" (
  "id" BIGSERIAL NOT NULL,
  "editionId" INTEGER NOT NULL,
  "templateCellSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 11,
  "answerCellSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "type0CellSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 8.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scanword_edition_svg_layout_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scanword_edition_svg_layout_settings_editionId_key"
  ON "public"."scanword_edition_svg_layout_settings"("editionId");

ALTER TABLE "public"."scanword_edition_svg_layout_settings"
  ADD CONSTRAINT "scanword_edition_svg_layout_settings_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "public"."editions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "public"."scanword_edition_svg_layout_settings"
  ("editionId", "templateCellSizeMm", "answerCellSizeMm", "type0CellSizeMm", "createdAt", "updatedAt")
SELECT
  e."id",
  COALESCE(latest."templateCellSizeMm", 11),
  COALESCE(latest."answerCellSizeMm", 10),
  COALESCE(latest."type0CellSizeMm", 8.5),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."editions" e
LEFT JOIN LATERAL (
  SELECT
    s."templateCellSizeMm",
    s."answerCellSizeMm",
    s."type0CellSizeMm"
  FROM "public"."issues" i
  JOIN "public"."scanword_issue_svg_settings" s ON s."issueId" = i."id"
  WHERE i."editionId" = e."id"
  ORDER BY s."updatedAt" DESC, s."issueId" DESC
  LIMIT 1
) latest ON TRUE;

ALTER TABLE "public"."scanword_issue_svg_settings"
  DROP COLUMN "templateCellSizeMm",
  DROP COLUMN "answerCellSizeMm",
  DROP COLUMN "type0CellSizeMm";
