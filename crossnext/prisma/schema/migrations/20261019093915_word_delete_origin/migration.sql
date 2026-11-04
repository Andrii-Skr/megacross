-- Existing deletions have unknown origin; keep them deleted until explicitly restored.
-- AlterTable
ALTER TABLE "opred_v" ADD COLUMN     "deletedWithWord" BOOLEAN NOT NULL DEFAULT false;
