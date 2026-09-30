import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, createPrismaClient } from "../db/prisma";
import { loadDictionary, loadDictionaryByTemplate, type DictionaryFilterTemplate } from "../services/dictionary";
import { solveCspNativeAsync } from "../utils/nativeDlx";
import { parseFsh } from "../utils/parseFsh";
import {
  assertGeometryCompatible,
  buildSolverRows,
  generateStructuralCandidate,
  normalizeGenerationRequest,
  SeededRandom,
  slotsForSolver,
} from "./generator";
import {
  cleanupExpiredTemplateJobs,
  createTemplateJob,
  getLatestTemplateJobForUser,
  getTemplateJob,
  getTemplateResult,
  getTemplateResultsByIds,
  insertTemplateResult,
  listRecoverableTemplateJobs,
  listTemplateResults,
  patchTemplateJob,
  type TemplateGenerationJobRow,
} from "./repository";
import type { TemplateGenerationRequest } from "./types";
import { calculateLengthWeights, countDictionaryByLength } from "./weights";

const TTL_MS = Number(process.env.CROSS_TEMPLATE_JOB_TTL_MS) || 30 * 24 * 60 * 60 * 1000;
const PACKAGE_MAX_MS = Number(process.env.CROSS_TEMPLATE_PACKAGE_MAX_MS) || 2 * 60 * 60 * 1000;
const SOLVER_MAX_MS = Number(process.env.CROSS_TEMPLATE_SOLVER_MAX_MS) || 30_000;
const SOLVER_MAX_NODES = Number(process.env.CROSS_TEMPLATE_SOLVER_MAX_NODES) || 2_000_000;
const SOLVER_PARALLEL = Math.min(2, Math.max(1, Number(process.env.CROSS_TEMPLATE_SOLVER_PARALLEL) || 2));
const listeners = new Map<string, Set<(job: TemplateGenerationJobRow) => void>>();
const running = new Set<string>();

function publicJob(job: TemplateGenerationJobRow) {
  return {
    ...job,
    id: job.id.toString(),
    rngPosition: job.rngPosition.toString(),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    expiresAt: job.expiresAt.toISOString(),
  };
}

async function emit(jobId: bigint): Promise<void> {
  const prisma = createPrismaClient();
  try {
    const job = await getTemplateJob(prisma, jobId);
    if (job) for (const listener of listeners.get(jobId.toString()) ?? []) listener(job);
  } finally { await prisma.$disconnect(); }
}

async function loadFilter(id: number): Promise<DictionaryFilterTemplate | null> {
  const prisma = createPrismaClient();
  try {
    const rows = await prisma.$queryRaw<DictionaryFilterTemplate[]>(Prisma.sql`
      SELECT language, query, scope, "searchMode", "lenFilterField", "lenMin", "lenMax", "difficultyMin", "difficultyMax", "tagNames", "excludeTagNames"
      FROM dictionary_filter_templates WHERE id = ${id} AND is_deleted = false LIMIT 1
    `);
    return rows[0] ?? null;
  } finally { await prisma.$disconnect(); }
}

async function loadGenerationDictionary(request: TemplateGenerationRequest) {
  if (request.dictionaryFilterId) {
    const filter = await loadFilter(request.dictionaryFilterId);
    if (!filter) throw new Error("dictionary filter not found");
    return loadDictionaryByTemplate(filter, { lengths: Array.from({ length: 9 }, (_, index) => index + 3) });
  }
  return loadDictionary({ langCode: "ru", lengths: Array.from({ length: 9 }, (_, index) => index + 3) });
}

export async function preflightTemplateGeneration(requestInput: TemplateGenerationRequest) {
  const request = normalizeGenerationRequest(requestInput);
  assertGeometryCompatible(request);
  const dictionary = await loadGenerationDictionary(request);
  const dictionaryCounts = countDictionaryByLength(dictionary);
  return { dictionaryCounts, targetDistribution: calculateLengthWeights(dictionaryCounts) };
}

async function runJob(jobId: bigint): Promise<void> {
  const key = jobId.toString();
  if (running.has(key)) return;
  running.add(key);
  const prisma = createPrismaClient();
  try {
    const job = await getTemplateJob(prisma, jobId);
    if (!job || job.status === "cancelled") return;
    await patchTemplateJob(prisma, jobId, { status: "running", phase: "dictionary", progress: 1, error: null });
    await emit(jobId);
    const request = normalizeGenerationRequest(job.parameters);
    const dictionary = await loadGenerationDictionary(request);
    const counts = countDictionaryByLength(dictionary);
    const weights = calculateLengthWeights(counts);
    if (Object.values(counts).every((count) => count === 0)) throw new Error("selected dictionary has no words of length 3–11");
    await patchTemplateJob(prisma, jobId, { phase: "structure", dictionaryCounts: counts, targetDistribution: weights });
    const restoredState = Number(job.rngPosition);
    const rng = new SeededRandom(job.seed, restoredState > 0 ? restoredState : undefined);
    const fingerprints = new Set((await getTemplateResultsByIds(prisma, jobId)).map((result) => result.fingerprint));
    let accepted = job.acceptedCount;
    let attempts = job.attempts;
    const deadline = job.createdAt.getTime() + PACKAGE_MAX_MS;
    const maxAttempts = Math.max(250, request.resultCount * 250);
    while (accepted < request.resultCount && attempts < maxAttempts && Date.now() < deadline) {
      const refreshed = await getTemplateJob(prisma, jobId);
      if (!refreshed || refreshed.status === "cancelled") return;
      attempts += 1;
      const candidate = generateStructuralCandidate(request, rng, fingerprints, 20, weights);
      if (!candidate) {
        if (attempts % 10 === 0) {
          await patchTemplateJob(prisma, jobId, { attempts, rngPosition: BigInt(rng.position), progress: Math.min(95, Math.max(2, Math.floor((accepted / request.resultCount) * 100))), phase: "structure" });
          await emit(jobId);
        }
        continue;
      }
      await patchTemplateJob(prisma, jobId, { phase: "solver", attempts, rngPosition: BigInt(rng.position) });
      const solved = await solveCspNativeAsync(buildSolverRows(candidate.grid), slotsForSolver(candidate.grid), dictionary, {
        shuffle: false,
        lcv: true,
        restarts: 2,
        parallelRestarts: SOLVER_PARALLEL,
        uniqueWords: true,
        splitComponents: false,
        maxMs: SOLVER_MAX_MS,
        maxNodes: SOLVER_MAX_NODES,
      });
      if (!solved) continue;
      accepted += 1;
      fingerprints.add(candidate.fingerprint);
      candidate.metrics.dictionaryVerified = true;
      candidate.solved = solved;
      const persistedGrid = { ...candidate.grid, witness: solved };
      await insertTemplateResult(prisma, jobId, accepted, candidate.fsh, persistedGrid, candidate.metrics, candidate.fingerprint);
      await patchTemplateJob(prisma, jobId, {
        acceptedCount: accepted,
        attempts,
        rngPosition: BigInt(rng.position),
        progress: Math.min(99, Math.floor((accepted / request.resultCount) * 100)),
        phase: "solver",
      });
      await emit(jobId);
    }
    const status = accepted >= request.resultCount ? "completed" : accepted > 0 ? "partial" : "failed";
    await patchTemplateJob(prisma, jobId, {
      status,
      phase: status,
      progress: 100,
      acceptedCount: accepted,
      attempts,
      rngPosition: BigInt(rng.position),
      error: status === "failed" ? "generation budget exhausted without a fillable template" : status === "partial" ? "generation budget exhausted; partial results preserved" : null,
    });
    await emit(jobId);
  } catch (error) {
    await patchTemplateJob(prisma, jobId, { status: "failed", phase: "failed", progress: 100, error: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
    await emit(jobId).catch(() => undefined);
  } finally {
    running.delete(key);
    await prisma.$disconnect();
  }
}

export async function startTemplateGeneration(requestInput: TemplateGenerationRequest, userId: number | null) {
  const request = normalizeGenerationRequest(requestInput);
  const seed = String(request.seed ?? randomBytes(12).toString("hex"));
  request.seed = seed;
  assertGeometryCompatible(request);
  const prisma = createPrismaClient();
  try {
    await cleanupExpiredTemplateJobs(prisma);
    const job = await createTemplateJob(prisma, userId, request, seed, new Date(Date.now() + TTL_MS));
    if (!job) throw Object.assign(new Error("another template generation job is active"), { status: 409 });
    queueMicrotask(() => void runJob(job.id));
    return publicJob(job);
  } finally { await prisma.$disconnect(); }
}

export async function readTemplateGenerationJob(jobId: bigint) {
  const prisma = createPrismaClient();
  try { const job = await getTemplateJob(prisma, jobId); return job ? publicJob(job) : null; }
  finally { await prisma.$disconnect(); }
}

export async function readLatestTemplateGenerationJob(userId: number) {
  const prisma = createPrismaClient();
  try { const job = await getLatestTemplateJobForUser(prisma, userId); return job ? publicJob(job) : null; }
  finally { await prisma.$disconnect(); }
}

export async function cancelTemplateGeneration(jobId: bigint): Promise<boolean> {
  const prisma = createPrismaClient();
  try {
    const job = await getTemplateJob(prisma, jobId);
    if (!job) return false;
    if (["completed", "partial", "failed", "cancelled"].includes(job.status)) return true;
    await patchTemplateJob(prisma, jobId, { status: "cancelled", phase: "cancelled", progress: 100 });
    await emit(jobId);
    return true;
  } finally { await prisma.$disconnect(); }
}

export async function readTemplateResults(jobId: bigint, page: number, pageSize: number) {
  const prisma = createPrismaClient();
  try {
    const result = await listTemplateResults(prisma, jobId, Math.max(1, page), Math.min(50, Math.max(1, pageSize)));
    return { ...result, items: result.items.map((item) => ({ ...item, id: item.id.toString(), jobId: item.jobId.toString(), createdAt: item.createdAt.toISOString() })) };
  } finally { await prisma.$disconnect(); }
}

export async function readTemplateResultBytes(jobId: bigint, resultId: bigint) {
  const prisma = createPrismaClient();
  try { return getTemplateResult(prisma, jobId, resultId); }
  finally { await prisma.$disconnect(); }
}

export async function readTemplateResultSet(jobId: bigint, ids?: bigint[]) {
  const prisma = createPrismaClient();
  try { return getTemplateResultsByIds(prisma, jobId, ids); }
  finally { await prisma.$disconnect(); }
}

export function subscribeTemplateGeneration(jobId: bigint, listener: (job: ReturnType<typeof publicJob>) => void): () => void {
  const key = jobId.toString();
  const set = listeners.get(key) ?? new Set();
  const adapter = (job: TemplateGenerationJobRow) => listener(publicJob(job));
  set.add(adapter);
  listeners.set(key, set);
  return () => { set.delete(adapter); if (!set.size) listeners.delete(key); };
}

export async function resumeTemplateGenerationJobs(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await cleanupExpiredTemplateJobs(prisma);
    const jobs = await listRecoverableTemplateJobs(prisma);
    for (const job of jobs) queueMicrotask(() => void runJob(job.id));
  } finally { await prisma.$disconnect(); }
}

export function scheduleTemplateGenerationCleanup(): () => void {
  const timer = setInterval(() => {
    const prisma = createPrismaClient();
    void cleanupExpiredTemplateJobs(prisma).finally(() => prisma.$disconnect());
  }, 24 * 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}

function safeSegment(value: string): string { return value.normalize("NFC").replace(/[^\p{L}\p{N}\p{M}_. -]+/gu, "_").replace(/\s+/gu, "_"); }

export async function appendTemplatesToIssue(jobId: bigint, resultIds: bigint[], issueId: bigint) {
  const prisma = createPrismaClient();
  const written: string[] = [];
  try {
    const active = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT id FROM scanword_fill_jobs WHERE "issueId" = ${issueId} AND status IN ('queued','running','review') LIMIT 1`);
    if (active.length) throw Object.assign(new Error("fill job is active for this issue"), { status: 409 });
    const issueRows = await prisma.$queryRaw<Array<{ editionCode: string; issueLabel: string }>>(Prisma.sql`
      SELECT e.code AS "editionCode", n.label AS "issueLabel" FROM issues i
      JOIN editions e ON e.id = i."editionId" JOIN issue_numbers n ON n.id = i."issueNumberId"
      WHERE i.id = ${issueId} LIMIT 1
    `);
    const issue = issueRows[0];
    if (!issue) throw Object.assign(new Error("issue not found"), { status: 404 });
    const base = process.env.CROSS_SAMPLES_DIR?.trim();
    if (!base) throw new Error("CROSS_SAMPLES_DIR is not configured");
    const directory = path.join(base, safeSegment(issue.editionCode), safeSegment(issue.issueLabel));
    await mkdir(directory, { recursive: true });
    const results = await getTemplateResultsByIds(prisma, jobId, resultIds);
    if (results.length !== resultIds.length) throw Object.assign(new Error("one or more results were not found"), { status: 404 });
    const existing = new Set(await readdir(directory));
    for (const result of results) {
      const stem = `generated_${jobId.toString()}_${result.ordinal}`;
      let name = `${stem}.fsh`;
      let suffix = 2;
      while (existing.has(name)) { name = `${stem}_${suffix}.fsh`; suffix += 1; }
      const target = path.join(directory, name);
      const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temporary, Buffer.from(result.fshBytes));
      await rename(temporary, target);
      existing.add(name);
      written.push(name);
    }
    const files = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".fsh")).sort();
    const neededStats: Record<string, number> = { total: 0 };
    for (const name of files) {
      try {
        const grid = parseFsh(path.join(directory, name));
        const slots = slotsForSolver(grid);
        neededStats.total += slots.length;
        for (const slot of slots) neededStats[slot.len] = (neededStats[slot.len] ?? 0) + 1;
      } catch { /* keep snapshot usable when a legacy file is malformed */ }
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO scanword_upload_snapshots ("issueId", "fileCount", "errorCount", "neededStats", files, errors, "createdAt", "updatedAt")
      VALUES (${issueId}, ${files.length}, 0, ${JSON.stringify(neededStats)}::jsonb, ${JSON.stringify(files.map((name) => ({ name })))}::jsonb, '[]'::jsonb, now(), now())
      ON CONFLICT ("issueId") DO UPDATE SET "fileCount" = EXCLUDED."fileCount", "errorCount" = 0, "neededStats" = EXCLUDED."neededStats", files = EXCLUDED.files, errors = EXCLUDED.errors, "updatedAt" = now()
    `);
    return { written, fileCount: files.length, neededStats };
  } finally { await prisma.$disconnect(); }
}
