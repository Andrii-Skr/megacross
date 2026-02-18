import express from "express";
import { existsSync } from "node:fs";
import { getWordsAndDefinitions, getAllTags } from "./services/wordDefinitionService";
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

app.use(express.json());

function parseFillOverrides(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const overrides: {
    maxNodes?: number;
    maxMs?: number;
    restarts?: number;
    parallelRestarts?: number;
    requireNative?: boolean;
    writeCrw?: boolean;
    usageStats?: boolean;
  } = {};
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
  if (typeof raw.writeCrw === "boolean") overrides.writeCrw = raw.writeCrw;
  if (typeof raw.usageStats === "boolean") overrides.usageStats = raw.usageStats;
  if (typeof raw.requireNative === "boolean") overrides.requireNative = raw.requireNative;
  if (
    overrides.restarts !== undefined &&
    overrides.parallelRestarts !== undefined &&
    overrides.restarts < overrides.parallelRestarts
  ) {
    overrides.restarts = overrides.parallelRestarts;
  }
  return overrides;
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

app.get("/api/words", async (req, res) => {
  const { wordText, definitionText, tags } = req.query;
  const tagNames = typeof tags === "string" ? tags.split(",") : undefined;

  try {
    const words = await getWordsAndDefinitions(
      wordText as string,
      definitionText as string,
      tagNames
    );
    res.json(words);
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
  try {
    const issueId = BigInt(issueIdRaw);
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
  try {
    const issueId = BigInt(String(issueIdRaw));
    const job = await getLatestFillJob(issueId);
    res.json(job ?? {});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch job";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/:jobId", async (req, res) => {
  try {
    const jobId = BigInt(req.params.jobId);
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
  try {
    const jobId = BigInt(req.params.jobId);
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
  try {
    const jobId = BigInt(req.params.jobId);
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
  try {
    const jobId = BigInt(req.params.jobId);
    const job = await finalizeFillJob(jobId, req.body ?? {});
    res.json(job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to finalize job";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/fill/:jobId/stream", async (req, res) => {
  try {
    const jobId = BigInt(req.params.jobId);
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
    res.status(500).json({ error: msg });
  }
});

app.get("/api/fill/:jobId/archive", async (req, res) => {
  try {
    const jobId = BigInt(req.params.jobId);
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
