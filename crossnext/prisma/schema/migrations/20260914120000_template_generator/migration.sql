CREATE TABLE "scanword_template_generation_jobs" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" INTEGER,
  "status" VARCHAR(16) NOT NULL DEFAULT 'queued',
  "phase" VARCHAR(32) NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "requestedCount" INTEGER NOT NULL,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "parameters" JSONB NOT NULL,
  "seed" VARCHAR(128) NOT NULL,
  "rngPosition" BIGINT NOT NULL DEFAULT 0,
  "dictionaryCounts" JSONB,
  "targetDistribution" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "scanword_template_generation_results" (
  "id" BIGSERIAL PRIMARY KEY,
  "jobId" BIGINT NOT NULL REFERENCES "scanword_template_generation_jobs"("id") ON DELETE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "fshBytes" BYTEA NOT NULL,
  "grid" JSONB NOT NULL,
  "metrics" JSONB NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "template_generation_results_job_ordinal_key" ON "scanword_template_generation_results"("jobId", "ordinal");
CREATE UNIQUE INDEX "template_generation_results_job_fingerprint_key" ON "scanword_template_generation_results"("jobId", "fingerprint");
CREATE INDEX "idx_template_generation_results_page" ON "scanword_template_generation_results"("jobId", "id");
CREATE INDEX "idx_template_generation_jobs_queue" ON "scanword_template_generation_jobs"("status", "createdAt");
CREATE INDEX "idx_template_generation_jobs_user" ON "scanword_template_generation_jobs"("userId", "createdAt");
CREATE INDEX "idx_template_generation_jobs_expires" ON "scanword_template_generation_jobs"("expiresAt");
CREATE UNIQUE INDEX "template_generation_single_active_job" ON "scanword_template_generation_jobs" ((1)) WHERE "status" IN ('queued', 'running');
