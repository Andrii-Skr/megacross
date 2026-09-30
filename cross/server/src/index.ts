import express, { type NextFunction, type Request, type Response } from "express";
import { statSync } from "node:fs";
import archiver from "archiver";
import { getWordsAndDefinitions, getAllTags } from "./services/wordDefinitionService";
import type { UsageRebalanceMode } from "./utils/usageRebalance";
import {
  finalizeFillJob,
  getFillJob,
  getFillJobReview,
  getFillWordCandidates,
  getJobArchivePath,
  getLatestFillJob,
  regenerateFillJobTemplate,
  startFillJob,
  subscribeFillJob,
  type FillJobOptions,
} from "./services/fillJobService";
import { parseTemplateSetupPayload } from "./services/fillJobTemplateSetupService";
import {
  appendTemplatesToIssue,
  cancelTemplateGeneration,
  preflightTemplateGeneration,
  readLatestTemplateGenerationJob,
  readTemplateGenerationJob,
  readTemplateResultBytes,
  readTemplateResults,
  readTemplateResultSet,
  resumeTemplateGenerationJobs,
  scheduleTemplateGenerationCleanup,
  startTemplateGeneration,
  subscribeTemplateGeneration,
} from "./templateGenerator/service";
import type { TemplateGenerationRequest } from "./templateGenerator/types";

const app = express();
const port = process.env.PORT || 3001;
const requestBodyLimit = process.env.CROSS_BODY_LIMIT || "10mb";
const requestBodyParameterLimitRaw = Number(process.env.CROSS_BODY_PARAMETER_LIMIT);
const requestBodyParameterLimit =
  Number.isFinite(requestBodyParameterLimitRaw) && requestBodyParameterLimitRaw > 0
    ? Math.floor(requestBodyParameterLimitRaw)
    : 50_000;

app.use(express.json({ limit: requestBodyLimit }));
app.use(
  express.urlencoded({
    extended: true,
    limit: requestBodyLimit,
    parameterLimit: requestBodyParameterLimit,
  })
);

function parseFillOverrides(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const overrides: {
    engine?: "dlx" | "csp";
    maxNodes?: number;
    maxMs?: number;
    restarts?: number;
    parallelRestarts?: number;
    shuffle?: boolean;
    unique?: boolean;
    lcv?: boolean;
    style?: "default" | "corel";
    explainFail?: boolean;
    noDefs?: boolean;
    writeCrw?: boolean;
    usageStats?: boolean;
    usageRebalance?: boolean;
    usageRebalanceMode?: UsageRebalanceMode;
    editionHotBan?: boolean;
    filterTemplateId?: number;
    templateSetup?: FillJobOptions["templateSetup"];
  } = {};
  if (raw.engine === "dlx" || raw.engine === "csp") overrides.engine = raw.engine;
  const maxNodes = Number(raw.maxNodes);
  if (Number.isFinite(maxNodes) && maxNodes > 0) overrides.maxNodes = Math.floor(maxNodes);
  const maxMs = Number(raw.maxMs);
  if (Number.isFinite(maxMs) && maxMs > 0) overrides.maxMs = Math.floor(maxMs);
  const restarts = Number(raw.restarts);
  if (Number.isFinite(restarts) && restarts > 0) overrides.restarts = Math.floor(restarts);
  const parallelRestarts = Number(raw.parallelRestarts);
  if (Number.isFinite(parallelRestarts) && parallelRestarts > 0) {
    overrides.parallelRestarts = Math.floor(parallelRestarts);
  }
  if (typeof raw.shuffle === "boolean") overrides.shuffle = raw.shuffle;
  if (typeof raw.unique === "boolean") overrides.unique = raw.unique;
  if (typeof raw.lcv === "boolean") overrides.lcv = raw.lcv;
  if (raw.style === "default" || raw.style === "corel") overrides.style = raw.style;
  if (typeof raw.explainFail === "boolean") overrides.explainFail = raw.explainFail;
  if (typeof raw.noDefs === "boolean") overrides.noDefs = raw.noDefs;
  if (typeof raw.writeCrw === "boolean") overrides.writeCrw = raw.writeCrw;
  if (typeof raw.usageStats === "boolean") overrides.usageStats = raw.usageStats;
  if (typeof raw.usageRebalance === "boolean") overrides.usageRebalance = raw.usageRebalance;
  if (
    raw.usageRebalanceMode === "safe" ||
    raw.usageRebalanceMode === "aggressive" ||
    raw.usageRebalanceMode === "cost"
  ) {
    overrides.usageRebalanceMode = raw.usageRebalanceMode;
  }
  if (typeof raw.editionHotBan === "boolean") overrides.editionHotBan = raw.editionHotBan;
  const filterTemplateId = Number(raw.filterTemplateId);
  if (Number.isFinite(filterTemplateId) && filterTemplateId > 0) {
    overrides.filterTemplateId = Math.floor(filterTemplateId);
  }
  if (raw.templateSetup !== undefined) {
    overrides.templateSetup = parseTemplateSetupPayload(raw.templateSetup);
  }
  return overrides;
}

function parseBigIntStrict(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!/^\d+$/u.test(normalized)) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

function parsePositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!/^\d+$/u.test(normalized)) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}

// Allow CORS for the client application
app.use((req, res, next) => {
  const allowList = (process.env.CROSS_ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowList.includes("*") || allowList.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/words", async (req, res) => {
  const { wordText, definitionText, tags } = req.query;
  const tagNames =
    typeof tags === "string"
      ? tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : Array.isArray(tags)
        ? tags.map((tag) => String(tag).trim()).filter(Boolean)
        : undefined;
  const page = parsePositiveInt(req.query.page);
  const pageSize = parsePositiveInt(req.query.pageSize ?? req.query.limit);

  try {
    const result = await getWordsAndDefinitions(
      wordText as string,
      definitionText as string,
      tagNames,
      { page, pageSize }
    );
    res.setHeader("X-Page", String(result.page));
    res.setHeader("X-Page-Size", String(result.pageSize));
    res.setHeader("X-Total-Count", String(result.total));
    res.setHeader("X-Total-Pages", String(result.totalPages));
    res.json(result.items);
  } catch (error) {
    console.error("Error fetching words and definitions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/tags", async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json(tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/fill/start", async (req, res) => {
  const issueIdRaw = req.body?.issueId;
  if (issueIdRaw === undefined || issueIdRaw === null) {
    res.status(400).json({ error: "issueId is required" });
    return;
  }
  const issueId = parseBigIntStrict(issueIdRaw);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issueId" });
    return;
  }
  try {
    const overrides = parseFillOverrides({
      ...(req.body?.options && typeof req.body.options === "object" ? req.body.options : {}),
      templateSetup: req.body?.templateSetup,
    });
    const job = await startFillJob(issueId, overrides);
    res.json(job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to start fill";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/latest", async (req, res) => {
  const issueIdRaw = req.query.issueId;
  if (!issueIdRaw) {
    res.status(400).json({ error: "issueId is required" });
    return;
  }
  const issueId = parseBigIntStrict(issueIdRaw);
  if (issueId === null) {
    res.status(400).json({ error: "Invalid issueId" });
    return;
  }
  try {
    const job = await getLatestFillJob(issueId);
    res.json(job ?? {});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch job";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/:jobId", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const job = await getFillJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch job";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/:jobId/review", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const review = await getFillJobReview(jobId);
    if (!review) {
      res.status(404).json({ error: "Review data not found" });
      return;
    }
    res.json(review);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch review";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/fill/:jobId/candidates", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const payload = req.body ?? {};
    const result = await getFillWordCandidates(jobId, {
      templateKey: typeof payload.templateKey === "string" ? payload.templateKey : undefined,
      slotId: Number(payload.slotId),
      mask: typeof payload.mask === "string" ? payload.mask : undefined,
      limit: Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : undefined,
    });
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load candidates";
    res.status(400).json({ error: msg });
  }
});

app.post("/api/fill/:jobId/finalize", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const job = await finalizeFillJob(jobId, req.body ?? {});
    res.json(job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to finalize job";
    res.status(400).json({ error: msg });
  }
});

app.post("/api/fill/:jobId/regenerate-template", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const job = await regenerateFillJobTemplate(jobId, req.body ?? {});
    res.json(job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to regenerate template";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/fill/:jobId/stream", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const current = await getFillJob(jobId);
    if (current) {
      res.write(`data: ${JSON.stringify(current)}\n\n`);
    }

    const unsubscribe = subscribeFillJob(String(jobId), (update) => {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    });
    const ping = setInterval(() => {
      res.write("event: ping\ndata: {}\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(ping);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to stream job";
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/:jobId/archive", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  const fileName = typeof req.query.file === "string" ? req.query.file : null;
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const archivePath = await getJobArchivePath(jobId, fileName);
    if (!archivePath) {
      res.status(404).json({ error: "Archive not found" });
      return;
    }
    let isFile = false;
    try {
      isFile = statSync(archivePath).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) {
      res.status(404).json({ error: "Archive not found" });
      return;
    }
    res.download(
      archivePath,
      `scanwords_${jobId}.zip`,
      { dotfiles: "allow" },
      (error?: Error & { code?: string }) => {
        if (!error) return;
        if (res.headersSent) {
          res.end();
          return;
        }
        if (error.code === "ENOENT") {
          res.status(404).json({ error: "Archive not found" });
          return;
        }
        res.status(500).json({ error: "Failed to download archive" });
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to download archive";
    res.status(500).json({ error: msg });
  }
});

function templateError(res: Response, error: unknown, fallback: string): void {
  const statusRaw = error && typeof error === "object" && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const status = statusRaw >= 400 && statusRaw <= 599 ? statusRaw : 400;
  res.status(status).json({ error: error instanceof Error ? error.message : fallback });
}

app.post("/api/template-generator/preflight", async (req, res) => {
  try { res.json(await preflightTemplateGeneration(req.body as TemplateGenerationRequest)); }
  catch (error) { templateError(res, error, "Template preflight failed"); }
});

app.post("/api/template-generator/jobs", async (req, res) => {
  const userId = Number(req.body?.userId);
  try {
    const request = { ...(req.body ?? {}) } as TemplateGenerationRequest & { userId?: unknown };
    delete request.userId;
    res.status(202).json(await startTemplateGeneration(request, Number.isInteger(userId) && userId > 0 ? userId : null));
  } catch (error) { templateError(res, error, "Failed to start template generation"); }
});

app.get("/api/template-generator/jobs", async (req, res) => {
  const userId = parsePositiveInt(req.query.userId);
  if (!userId) { res.status(400).json({ error: "Invalid userId" }); return; }
  try { res.json(await readLatestTemplateGenerationJob(userId)); }
  catch (error) { templateError(res, error, "Failed to read latest template job"); }
});

app.get("/api/template-generator/jobs/:jobId", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) { res.status(400).json({ error: "Invalid jobId" }); return; }
  try {
    const job = await readTemplateGenerationJob(jobId);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    res.json(job);
  } catch (error) { templateError(res, error, "Failed to read template job"); }
});

app.delete("/api/template-generator/jobs/:jobId", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) { res.status(400).json({ error: "Invalid jobId" }); return; }
  try {
    if (!(await cancelTemplateGeneration(jobId))) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ ok: true });
  } catch (error) { templateError(res, error, "Failed to cancel template job"); }
});

app.get("/api/template-generator/jobs/:jobId/events", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) { res.status(400).json({ error: "Invalid jobId" }); return; }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const current = await readTemplateGenerationJob(jobId);
  if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);
  const unsubscribe = subscribeTemplateGeneration(jobId, (job) => res.write(`data: ${JSON.stringify(job)}\n\n`));
  const ping = setInterval(() => res.write("event: ping\ndata: {}\n\n"), 15_000);
  req.on("close", () => { clearInterval(ping); unsubscribe(); res.end(); });
});

app.get("/api/template-generator/jobs/:jobId/results", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) { res.status(400).json({ error: "Invalid jobId" }); return; }
  try {
    const page = parsePositiveInt(req.query.page) ?? 1;
    const pageSize = parsePositiveInt(req.query.pageSize) ?? 24;
    res.json(await readTemplateResults(jobId, page, pageSize));
  } catch (error) { templateError(res, error, "Failed to read template results"); }
});

app.get("/api/template-generator/jobs/:jobId/results/:resultId/fsh", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  const resultId = parseBigIntStrict(req.params.resultId);
  if (jobId === null || resultId === null) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const result = await readTemplateResultBytes(jobId, resultId);
    if (!result) { res.status(404).json({ error: "Result not found" }); return; }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="generated_${jobId}_${result.ordinal}.fsh"`);
    res.send(Buffer.from(result.fshBytes));
  } catch (error) { templateError(res, error, "Failed to download FSH"); }
});

app.post("/api/template-generator/jobs/:jobId/zip", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  if (jobId === null) { res.status(400).json({ error: "Invalid jobId" }); return; }
  let ids: bigint[] | undefined;
  try { ids = Array.isArray(req.body?.resultIds) ? req.body.resultIds.map((value: unknown) => BigInt(String(value))) : undefined; }
  catch { res.status(400).json({ error: "Invalid resultIds" }); return; }
  try {
    const results = await readTemplateResultSet(jobId, ids);
    if (!results.length) { res.status(404).json({ error: "No results found" }); return; }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="templates_${jobId}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => res.destroy(error));
    archive.pipe(res);
    for (const result of results) archive.append(Buffer.from(result.fshBytes), { name: `generated_${jobId}_${result.ordinal}.fsh` });
    await archive.finalize();
  } catch (error) { if (!res.headersSent) templateError(res, error, "Failed to build ZIP"); }
});

app.post("/api/template-generator/jobs/:jobId/append", async (req, res) => {
  const jobId = parseBigIntStrict(req.params.jobId);
  const issueId = parseBigIntStrict(req.body?.issueId);
  if (jobId === null || issueId === null) { res.status(400).json({ error: "Invalid jobId or issueId" }); return; }
  let resultIds: bigint[];
  try { resultIds = Array.isArray(req.body?.resultIds) ? req.body.resultIds.map((value: unknown) => BigInt(String(value))) : []; }
  catch { res.status(400).json({ error: "Invalid resultIds" }); return; }
  if (!resultIds.length) { res.status(400).json({ error: "Select at least one result" }); return; }
  try { res.json(await appendTemplatesToIssue(jobId, resultIds, issueId)); }
  catch (error) { templateError(res, error, "Failed to append templates"); }
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    res.status(413).json({
      error: `Payload too large. Maximum request size is ${requestBodyLimit}.`,
    });
    return;
  }
  next(error);
});

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  void resumeTemplateGenerationJobs().catch((error) => console.error("Failed to resume template generation jobs:", error));
});
const stopTemplateCleanup = scheduleTemplateGenerationCleanup();
server.ref();

const closeServer = () => {
  stopTemplateCleanup();
  server.close((error) => {
    if (error) {
      console.error("Failed to stop server cleanly:", error);
      process.exitCode = 1;
    }
  });
};

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
