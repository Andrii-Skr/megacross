import { existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { Prisma } from "../db/prisma";
import type { PrismaClient } from "../db/prisma";

export type FillJobRow = {
  id: bigint;
  issueId: bigint;
  status: string;
  progress: number;
  currentTemplate: string | null;
  completedTemplates: number | null;
  totalTemplates: number | null;
  error: string | null;
  outputPath: string | null;
  outputSize: bigint | number | null;
  templates: unknown;
  reviewData: unknown;
  options: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type FillJobPatch = {
  status?: string | null;
  progress?: number | null;
  currentTemplate?: string | null;
  completedTemplates?: number | null;
  totalTemplates?: number | null;
  error?: string | null;
  templatesJson?: string | null;
  reviewJson?: string | null;
  outputPath?: string | null;
  outputSize?: number | null;
};

function collectArchiveFilePaths(jobId: bigint, outputPath: string): string[] {
  const paths = new Set<string>([outputPath]);
  const directory = path.dirname(outputPath);
  const jobPrefix = `scanwords_${jobId.toString()}`;
  try {
    const files = readdirSync(directory);
    for (const fileName of files) {
      if (
        fileName === `${jobPrefix}.zip` ||
        (fileName.startsWith(`${jobPrefix}__`) && fileName.endsWith(".zip"))
      ) {
        paths.add(path.join(directory, fileName));
      }
    }
  } catch {
    // ignore directory read errors
  }
  return [...paths];
}

export async function cleanupOldFillJobArchives(prisma: PrismaClient, ttlMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - ttlMs);
  const rows = await prisma.$queryRaw<Array<{ id: bigint; outputPath: string | null }>>(Prisma.sql`
    SELECT id, "outputPath" as "outputPath" FROM scanword_fill_jobs
    WHERE "outputPath" IS NOT NULL AND "updatedAt" < ${cutoff}
  `);
  for (const row of rows) {
    if (row.outputPath) {
      for (const archivePath of collectArchiveFilePaths(row.id, row.outputPath)) {
        if (!existsSync(archivePath)) continue;
        try {
          unlinkSync(archivePath);
        } catch {
          // ignore file delete errors
        }
      }
    }
    await prisma.$executeRaw(Prisma.sql`
      UPDATE scanword_fill_jobs
      SET "outputPath" = NULL, "outputSize" = NULL, "updatedAt" = now()
      WHERE id = ${row.id}
    `);
  }
}

export async function loadFillJobById(prisma: PrismaClient, jobId: bigint): Promise<FillJobRow | null> {
  const rows = await prisma.$queryRaw<FillJobRow[]>(Prisma.sql`
    SELECT * FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function loadLatestFillJobByIssue(
  prisma: PrismaClient,
  issueId: bigint
): Promise<FillJobRow | null> {
  const rows = await prisma.$queryRaw<FillJobRow[]>(Prisma.sql`
    SELECT * FROM scanword_fill_jobs
    WHERE "issueId" = ${issueId}
    ORDER BY id DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function loadLatestReviewJobByIssue(
  prisma: PrismaClient,
  issueId: bigint
): Promise<FillJobRow | null> {
  const rows = await prisma.$queryRaw<FillJobRow[]>(Prisma.sql`
    SELECT * FROM scanword_fill_jobs
    WHERE "issueId" = ${issueId} AND status = 'review'
    ORDER BY id DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function loadLatestActiveJobByIssue(
  prisma: PrismaClient,
  issueId: bigint
): Promise<FillJobRow | null> {
  const rows = await prisma.$queryRaw<FillJobRow[]>(Prisma.sql`
    SELECT *
    FROM scanword_fill_jobs
    WHERE "issueId" = ${issueId} AND status IN ('queued', 'running')
    ORDER BY id DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function createQueuedFillJob(
  prisma: PrismaClient,
  issueId: bigint,
  optionsJson: string
): Promise<FillJobRow | null> {
  const rows = await prisma.$queryRaw<FillJobRow[]>(Prisma.sql`
    INSERT INTO scanword_fill_jobs ("issueId", status, progress, options)
    VALUES (${issueId}, 'queued', 0, ${optionsJson}::jsonb)
    ON CONFLICT ("issueId")
      WHERE status IN ('queued', 'running')
      DO NOTHING
    RETURNING *
  `);
  return rows[0] ?? null;
}

export async function loadFillJobArchivePath(prisma: PrismaClient, jobId: bigint): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ outputPath: string | null }>>(Prisma.sql`
    SELECT "outputPath" as "outputPath" FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `);
  return rows[0]?.outputPath ?? null;
}

export async function loadFillJobReviewData(prisma: PrismaClient, jobId: bigint): Promise<unknown | null> {
  const rows = await prisma.$queryRaw<Array<{ reviewData: unknown | null }>>(Prisma.sql`
    SELECT "reviewData" as "reviewData" FROM scanword_fill_jobs WHERE id = ${jobId} LIMIT 1
  `);
  return rows[0]?.reviewData ?? null;
}

export async function patchFillJob(prisma: PrismaClient, jobId: bigint, data: FillJobPatch): Promise<void> {
  const hasStatus = data.status !== undefined;
  const hasProgress = data.progress !== undefined;
  const hasCurrentTemplate = data.currentTemplate !== undefined;
  const hasCompletedTemplates = data.completedTemplates !== undefined;
  const hasTotalTemplates = data.totalTemplates !== undefined;
  const hasError = data.error !== undefined;
  const hasTemplates = data.templatesJson !== undefined;
  const hasReviewData = data.reviewJson !== undefined;
  const hasOutputPath = data.outputPath !== undefined;
  const hasOutputSize = data.outputSize !== undefined;
  const statusValue = hasStatus ? (data.status ?? null) : null;
  const progressValue = hasProgress ? (data.progress ?? null) : null;
  const currentTemplateValue = hasCurrentTemplate ? (data.currentTemplate ?? null) : null;
  const completedTemplatesValue = hasCompletedTemplates ? (data.completedTemplates ?? null) : null;
  const totalTemplatesValue = hasTotalTemplates ? (data.totalTemplates ?? null) : null;
  const errorValue = hasError ? (data.error ?? null) : null;
  const outputPathValue = hasOutputPath ? (data.outputPath ?? null) : null;
  const outputSizeValue = hasOutputSize ? (data.outputSize ?? null) : null;
  const templatesJson = hasTemplates ? (data.templatesJson ?? null) : null;
  const reviewJson = hasReviewData ? (data.reviewJson ?? null) : null;
  await prisma.$executeRaw(Prisma.sql`
    UPDATE scanword_fill_jobs
    SET
      status = CASE WHEN ${hasStatus} THEN ${statusValue} ELSE status END,
      progress = CASE WHEN ${hasProgress} THEN ${progressValue} ELSE progress END,
      "currentTemplate" = CASE WHEN ${hasCurrentTemplate} THEN ${currentTemplateValue} ELSE "currentTemplate" END,
      "completedTemplates" = CASE WHEN ${hasCompletedTemplates} THEN ${completedTemplatesValue} ELSE "completedTemplates" END,
      "totalTemplates" = CASE WHEN ${hasTotalTemplates} THEN ${totalTemplatesValue} ELSE "totalTemplates" END,
      error = CASE WHEN ${hasError} THEN ${errorValue} ELSE error END,
      templates = CASE WHEN ${hasTemplates} THEN ${templatesJson}::jsonb ELSE templates END,
      "reviewData" = CASE WHEN ${hasReviewData} THEN ${reviewJson}::jsonb ELSE "reviewData" END,
      "outputPath" = CASE WHEN ${hasOutputPath} THEN ${outputPathValue} ELSE "outputPath" END,
      "outputSize" = CASE WHEN ${hasOutputSize} THEN ${outputSizeValue} ELSE "outputSize" END,
      "updatedAt" = now()
    WHERE id = ${jobId}
  `);
}
