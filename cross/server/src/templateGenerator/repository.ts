import { Prisma, type PrismaClient } from "../db/prisma";
import type { Grid } from "../types";
import type { TemplateGenerationRequest, TemplateMetrics } from "./types";

export type TemplateGenerationStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type TemplateGenerationJobRow = {
  id: bigint;
  userId: number | null;
  status: TemplateGenerationStatus;
  phase: string;
  progress: number;
  requestedCount: number;
  acceptedCount: number;
  attempts: number;
  parameters: TemplateGenerationRequest;
  seed: string;
  rngPosition: bigint;
  dictionaryCounts: Record<string, number> | null;
  targetDistribution: Record<string, number> | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type TemplateGenerationResultRow = {
  id: bigint;
  jobId: bigint;
  ordinal: number;
  fshBytes: Uint8Array;
  grid: Grid;
  metrics: TemplateMetrics;
  fingerprint: string;
  createdAt: Date;
};

export async function cleanupExpiredTemplateJobs(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`DELETE FROM scanword_template_generation_jobs WHERE "expiresAt" <= now()`);
}

export async function createTemplateJob(
  prisma: PrismaClient,
  userId: number | null,
  request: TemplateGenerationRequest,
  seed: string,
  expiresAt: Date,
): Promise<TemplateGenerationJobRow | null> {
  const json = JSON.stringify(request);
  const rows = await prisma.$queryRaw<TemplateGenerationJobRow[]>(Prisma.sql`
    INSERT INTO scanword_template_generation_jobs ("userId", status, phase, "requestedCount", parameters, seed, "expiresAt")
    VALUES (${userId}, 'queued', 'queued', ${request.resultCount}, ${json}::jsonb, ${seed}, ${expiresAt})
    ON CONFLICT ((1)) WHERE status IN ('queued', 'running') DO NOTHING
    RETURNING *
  `);
  return rows[0] ?? null;
}

export async function getTemplateJob(prisma: PrismaClient, id: bigint): Promise<TemplateGenerationJobRow | null> {
  const rows = await prisma.$queryRaw<TemplateGenerationJobRow[]>(Prisma.sql`SELECT * FROM scanword_template_generation_jobs WHERE id = ${id} LIMIT 1`);
  return rows[0] ?? null;
}

export async function getLatestTemplateJobForUser(prisma: PrismaClient, userId: number): Promise<TemplateGenerationJobRow | null> {
  const rows = await prisma.$queryRaw<TemplateGenerationJobRow[]>(Prisma.sql`
    SELECT * FROM scanword_template_generation_jobs
    WHERE "userId" = ${userId} AND "expiresAt" > now()
    ORDER BY CASE WHEN status IN ('queued', 'running') THEN 0 ELSE 1 END, "createdAt" DESC, id DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function listRecoverableTemplateJobs(prisma: PrismaClient): Promise<TemplateGenerationJobRow[]> {
  return prisma.$queryRaw<TemplateGenerationJobRow[]>(Prisma.sql`
    UPDATE scanword_template_generation_jobs SET status = 'queued', phase = 'queued', "updatedAt" = now()
    WHERE status IN ('queued', 'running') AND "expiresAt" > now()
    RETURNING *
  `);
}

export async function patchTemplateJob(
  prisma: PrismaClient,
  id: bigint,
  patch: Partial<Pick<TemplateGenerationJobRow, "status" | "phase" | "progress" | "acceptedCount" | "attempts" | "rngPosition" | "error">> & {
    dictionaryCounts?: Record<number, number>;
    targetDistribution?: Record<number, number>;
  },
): Promise<boolean> {
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE scanword_template_generation_jobs SET
      status = CASE WHEN ${patch.status !== undefined} THEN ${patch.status ?? null} ELSE status END,
      phase = CASE WHEN ${patch.phase !== undefined} THEN ${patch.phase ?? null} ELSE phase END,
      progress = CASE WHEN ${patch.progress !== undefined} THEN ${patch.progress ?? 0} ELSE progress END,
      "acceptedCount" = CASE WHEN ${patch.acceptedCount !== undefined} THEN ${patch.acceptedCount ?? 0} ELSE "acceptedCount" END,
      attempts = CASE WHEN ${patch.attempts !== undefined} THEN ${patch.attempts ?? 0} ELSE attempts END,
      "rngPosition" = CASE WHEN ${patch.rngPosition !== undefined} THEN ${patch.rngPosition ?? 0} ELSE "rngPosition" END,
      error = CASE WHEN ${patch.error !== undefined} THEN ${patch.error ?? null} ELSE error END,
      "dictionaryCounts" = CASE WHEN ${patch.dictionaryCounts !== undefined} THEN ${JSON.stringify(patch.dictionaryCounts ?? {})}::jsonb ELSE "dictionaryCounts" END,
      "targetDistribution" = CASE WHEN ${patch.targetDistribution !== undefined} THEN ${JSON.stringify(patch.targetDistribution ?? {})}::jsonb ELSE "targetDistribution" END,
      "updatedAt" = now()
    WHERE id = ${id} AND status IN ('queued', 'running')
  `);
  return updated > 0;
}

export async function insertTemplateResult(
  prisma: PrismaClient,
  jobId: bigint,
  ordinal: number,
  fshBytes: Uint8Array,
  grid: Grid,
  metrics: TemplateMetrics,
  fingerprint: string,
): Promise<boolean> {
  const inserted = await prisma.$executeRaw(Prisma.sql`
    WITH active_job AS (
      SELECT id FROM scanword_template_generation_jobs
      WHERE id = ${jobId} AND status = 'running' FOR UPDATE
    )
    INSERT INTO scanword_template_generation_results ("jobId", ordinal, "fshBytes", grid, metrics, fingerprint)
    SELECT id, ${ordinal}, ${Buffer.from(fshBytes)}, ${JSON.stringify(grid)}::jsonb, ${JSON.stringify(metrics)}::jsonb, ${fingerprint} FROM active_job
    ON CONFLICT DO NOTHING
  `);
  return inserted > 0;
}

export async function listTemplateResults(
  prisma: PrismaClient,
  jobId: bigint,
  page: number,
  pageSize: number,
): Promise<{ items: TemplateGenerationResultRow[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [items, counts] = await Promise.all([
    prisma.$queryRaw<TemplateGenerationResultRow[]>(Prisma.sql`
      SELECT id, "jobId", ordinal, grid, metrics, fingerprint, "createdAt" FROM scanword_template_generation_results
      WHERE "jobId" = ${jobId} ORDER BY ordinal LIMIT ${pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*)::bigint AS count FROM scanword_template_generation_results WHERE "jobId" = ${jobId}`),
  ]);
  return { items, total: Number(counts[0]?.count ?? 0) };
}

export async function getTemplateResult(prisma: PrismaClient, jobId: bigint, resultId: bigint): Promise<TemplateGenerationResultRow | null> {
  const rows = await prisma.$queryRaw<TemplateGenerationResultRow[]>(Prisma.sql`
    SELECT * FROM scanword_template_generation_results WHERE id = ${resultId} AND "jobId" = ${jobId} LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function getTemplateResultsByIds(prisma: PrismaClient, jobId: bigint, ids?: bigint[]): Promise<TemplateGenerationResultRow[]> {
  if (ids && !ids.length) return [];
  return ids
    ? prisma.$queryRaw<TemplateGenerationResultRow[]>(Prisma.sql`
        SELECT * FROM scanword_template_generation_results WHERE "jobId" = ${jobId} AND id IN (${Prisma.join(ids)}) ORDER BY ordinal
      `)
    : prisma.$queryRaw<TemplateGenerationResultRow[]>(Prisma.sql`
        SELECT * FROM scanword_template_generation_results WHERE "jobId" = ${jobId} ORDER BY ordinal
      `);
}
