-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."Role" ADD VALUE 'CHIEF_EDITOR_PLUS';
ALTER TYPE "public"."Role" ADD VALUE 'CHIEF_EDITOR';
ALTER TYPE "public"."Role" ADD VALUE 'EDITOR';

-- DropForeignKey
ALTER TABLE "public"."auth_accounts" DROP CONSTRAINT "auth_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."auth_sessions" DROP CONSTRAINT "auth_sessions_userId_fkey";

-- AlterTable
ALTER TABLE "public"."auth_users" DROP COLUMN "role",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roleId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."language" ADD COLUMN     "word_replace_map" JSONB;

-- AlterTable
ALTER TABLE "public"."opred_v" ADD COLUMN     "approvedBy" SMALLINT,
ADD COLUMN     "createBy" SMALLINT,
ADD COLUMN     "updateBy" SMALLINT,
ALTER COLUMN "create_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."pending_descriptions" ADD COLUMN     "approvedBy" SMALLINT,
ADD COLUMN     "createBy" SMALLINT,
ADD COLUMN     "updateBy" SMALLINT;

-- AlterTable
ALTER TABLE "public"."pending_words" ADD COLUMN     "approvedBy" SMALLINT,
ADD COLUMN     "createBy" SMALLINT,
ADD COLUMN     "updateBy" SMALLINT;

-- AlterTable
ALTER TABLE "public"."scanword_fill_jobs" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."scanword_fill_review_drafts" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."scanword_fill_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."scanword_issue_svg_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."scanword_svg_fonts" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."word_v" ADD COLUMN     "approvedBy" SMALLINT,
ADD COLUMN     "createBy" SMALLINT,
ADD COLUMN     "updateBy" SMALLINT,
ADD COLUMN     "update_at" TIMESTAMP(6),
ADD COLUMN     "word_text_norm" VARCHAR(255),
ALTER COLUMN "create_at" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."auth_accounts";

-- DropTable
DROP TABLE "public"."auth_sessions";

-- DropTable
DROP TABLE "public"."auth_verification_tokens";

-- CreateTable
CREATE TABLE "public"."dictionary_filter_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "query" VARCHAR(255),
    "scope" VARCHAR(8) NOT NULL DEFAULT 'word',
    "searchMode" VARCHAR(12) NOT NULL DEFAULT 'contains',
    "lenFilterField" VARCHAR(8),
    "lenMin" INTEGER,
    "lenMax" INTEGER,
    "difficultyMin" INTEGER,
    "difficultyMax" INTEGER,
    "tagNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "excludeTagNames" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "dictionary_filter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."difficulty" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(255),
    "create_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMP(6),

    CONSTRAINT "difficulty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."edition_opred_stat" (
    "editionId" INTEGER NOT NULL,
    "opredId" BIGINT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastIssueId" BIGINT,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "edition_opred_stat_pkey" PRIMARY KEY ("editionId","opredId")
);

-- CreateTable
CREATE TABLE "public"."edition_word_stat" (
    "editionId" INTEGER NOT NULL,
    "wordId" BIGINT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastIssueId" BIGINT,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "edition_word_stat_pkey" PRIMARY KEY ("editionId","wordId")
);

-- CreateTable
CREATE TABLE "public"."editions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."issue_numbers" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "year" SMALLINT,
    "seq" SMALLINT,
    "series" VARCHAR(64),
    "sortKey" INTEGER,

    CONSTRAINT "issue_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."issue_opred_usage" (
    "issueId" BIGINT NOT NULL,
    "opredId" BIGINT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_opred_usage_pkey" PRIMARY KEY ("issueId","opredId")
);

-- CreateTable
CREATE TABLE "public"."issue_word_usage" (
    "issueId" BIGINT NOT NULL,
    "wordId" BIGINT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_word_usage_pkey" PRIMARY KEY ("issueId","wordId")
);

-- CreateTable
CREATE TABLE "public"."issues" (
    "id" BIGSERIAL NOT NULL,
    "editionId" INTEGER NOT NULL,
    "issueNumberId" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filterTemplateId" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" SERIAL NOT NULL,
    "code" "public"."Role" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scanword_upload_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "issueId" BIGINT NOT NULL,
    "templateId" INTEGER,
    "templateName" VARCHAR(120),
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "files" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "neededStats" JSONB,
    "templateSetup" JSONB,

    CONSTRAINT "scanword_upload_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dictionary_filter_templates_is_deleted_idx" ON "public"."dictionary_filter_templates"("is_deleted" ASC);

-- CreateIndex
CREATE INDEX "dictionary_filter_templates_language_idx" ON "public"."dictionary_filter_templates"("language" ASC);

-- CreateIndex
CREATE INDEX "edition_opred_stat_opredId_idx" ON "public"."edition_opred_stat"("opredId" ASC);

-- CreateIndex
CREATE INDEX "edition_word_stat_wordId_idx" ON "public"."edition_word_stat"("wordId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "editions_code_key" ON "public"."editions"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "issue_numbers_label_key" ON "public"."issue_numbers"("label" ASC);

-- CreateIndex
CREATE INDEX "issue_opred_usage_opredId_idx" ON "public"."issue_opred_usage"("opredId" ASC);

-- CreateIndex
CREATE INDEX "issue_word_usage_wordId_idx" ON "public"."issue_word_usage"("wordId" ASC);

-- CreateIndex
CREATE INDEX "issues_editionId_issueNumberId_idx" ON "public"."issues"("editionId" ASC, "issueNumberId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "issues_editionId_issueNumberId_key" ON "public"."issues"("editionId" ASC, "issueNumberId" ASC);

-- CreateIndex
CREATE INDEX "issues_filterTemplateId_idx" ON "public"."issues"("filterTemplateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "public"."role_permissions"("permissionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "public"."roles"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "scanword_upload_snapshots_issueId_key" ON "public"."scanword_upload_snapshots"("issueId" ASC);

-- CreateIndex
CREATE INDEX "scanword_upload_snapshots_updatedAt_idx" ON "public"."scanword_upload_snapshots"("updatedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_name_key" ON "public"."auth_users"("name" ASC);

-- CreateIndex
CREATE INDEX "idx_word_v_lang_del_text" ON "public"."word_v"("langId" ASC, "is_deleted" ASC, "word_text" ASC);

-- AddForeignKey
ALTER TABLE "public"."auth_users" ADD CONSTRAINT "auth_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_filter_templates" ADD CONSTRAINT "dictionary_filter_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."edition_opred_stat" ADD CONSTRAINT "edition_opred_stat_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "public"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."edition_opred_stat" ADD CONSTRAINT "edition_opred_stat_opredId_fkey" FOREIGN KEY ("opredId") REFERENCES "public"."opred_v"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."edition_word_stat" ADD CONSTRAINT "edition_word_stat_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "public"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."edition_word_stat" ADD CONSTRAINT "edition_word_stat_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "public"."word_v"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issue_opred_usage" ADD CONSTRAINT "issue_opred_usage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issue_opred_usage" ADD CONSTRAINT "issue_opred_usage_opredId_fkey" FOREIGN KEY ("opredId") REFERENCES "public"."opred_v"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issue_word_usage" ADD CONSTRAINT "issue_word_usage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issue_word_usage" ADD CONSTRAINT "issue_word_usage_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "public"."word_v"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issues" ADD CONSTRAINT "issues_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "public"."editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issues" ADD CONSTRAINT "issues_filterTemplateId_fkey" FOREIGN KEY ("filterTemplateId") REFERENCES "public"."dictionary_filter_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."issues" ADD CONSTRAINT "issues_issueNumberId_fkey" FOREIGN KEY ("issueNumberId") REFERENCES "public"."issue_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opred_v" ADD CONSTRAINT "opred_v_difficulty_fkey" FOREIGN KEY ("difficulty") REFERENCES "public"."difficulty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scanword_fill_jobs" ADD CONSTRAINT "scanword_fill_jobs_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scanword_fill_settings" ADD CONSTRAINT "scanword_fill_settings_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scanword_issue_svg_settings" ADD CONSTRAINT "scanword_issue_svg_settings_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scanword_upload_snapshots" ADD CONSTRAINT "scanword_upload_snapshots_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
