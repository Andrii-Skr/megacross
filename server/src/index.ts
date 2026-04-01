import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { getWordsAndDefinitions, getAllTags } from "./services/wordDefinitionService";
import type { UsageRebalanceMode } from "./utils/usageRebalance";
import {
  finalizeFillJob,
  getFillJob,
  getFillJobReview,
  getFillWordCandidates,
  getJobArchivePath,
  getLatestFillJob,
  startFillJob,
  subscribeFillJob,
} from "./services/fillJobService";

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
    const overrides = parseFillOverrides(req.body?.options);
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
  if (jobId === null) {
    res.status(400).json({ error: "Invalid jobId" });
    return;
  }
  try {
    const archivePath = await getJobArchivePath(jobId);
    if (!archivePath || !existsSync(archivePath)) {
      res.status(404).json({ error: "Archive not found" });
      return;
    }
    res.download(archivePath, `scanwords_${jobId}.zip`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to download archive";
    res.status(500).json({ error: msg });
  }
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
