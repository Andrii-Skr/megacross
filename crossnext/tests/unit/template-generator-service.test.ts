import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFsh, markerFor } from "@megacross/cross-format";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateGenerationJobRow } from "../../../cross/server/src/templateGenerator/repository";
import type { TemplateGenerationRequest } from "../../../cross/server/src/templateGenerator/types";

const state = vi.hoisted(() => ({
  job: null as TemplateGenerationJobRow | null,
  solve: vi.fn(),
  insert: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
  results: vi.fn(),
  candidate: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("../../../cross/server/src/db/prisma", () => ({
  createPrismaClient: () => ({ $disconnect: state.disconnect, $executeRaw: state.execute, $queryRaw: state.query }),
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}));
vi.mock("../../../cross/server/src/services/dictionary", () => ({
  loadDictionary: async () => new Map([[3, ["КОТ"]]]),
}));
vi.mock("../../../cross/server/src/utils/nativeDlx", () => ({ solveCspNativeAsync: state.solve }));
vi.mock("../../../cross/server/src/templateGenerator/generator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../cross/server/src/templateGenerator/generator")>()),
  normalizeGenerationRequest: (request: TemplateGenerationRequest) => request,
  assertGeometryCompatible: vi.fn(),
  generateStructuralCandidate: state.candidate,
}));
vi.mock("../../../cross/server/src/templateGenerator/repository", () => ({
  cleanupExpiredTemplateJobs: vi.fn(),
  listRecoverableTemplateJobs: async () => [state.job],
  createTemplateJob: async () => state.job,
  getTemplateJob: async () => state.job && { ...state.job },
  getTemplateResultsByIds: state.results,
  patchTemplateJob: async (_prisma: unknown, _id: bigint, patch: Partial<TemplateGenerationJobRow>) => {
    if (!state.job || !["queued", "running"].includes(state.job.status)) return false;
    Object.assign(state.job, patch);
    return true;
  },
  insertTemplateResult: state.insert,
}));

import {
  appendTemplatesToIssue,
  cancelTemplateGeneration,
  resumeTemplateGenerationJobs,
  startTemplateGeneration,
} from "../../../cross/server/src/templateGenerator/service";

const request: TemplateGenerationRequest = {
  rows: 23,
  cols: 31,
  resultCount: 1,
  pictures: { mode: "auto", count: 0 },
  cutoutPresetId: "none",
  seed: "test",
};
const grid = { rows: 1, cols: 3, marker: markerFor(1, 3), data: ["***"], codes: [[1, 1, 1]] };
const metrics = {
  slotCount: 1,
  intersections: 0,
  averageIntersections: 0,
  lengthDistribution: { 3: 1 },
  pictureBounds: [],
  cutoutOrientation: "none",
  dictionaryVerified: false,
};
let directory: string | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  state.job = {
    id: 1n,
    userId: 1,
    status: "queued",
    phase: "queued",
    progress: 0,
    requestedCount: 1,
    acceptedCount: 0,
    attempts: 0,
    parameters: request,
    seed: "test",
    rngPosition: 0n,
    dictionaryCounts: null,
    targetDistribution: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 10000),
  };
  state.results.mockResolvedValue([]);
  state.insert.mockResolvedValue(true);
  state.execute.mockResolvedValue(1);
  state.candidate.mockImplementation(() => ({
    grid,
    fsh: buildFsh(grid),
    fingerprint: "test",
    metrics: { ...metrics },
  }));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});
describe("template generation cancellation", () => {
  it.each(["success", "failure"])("preserves cancellation when the solver returns %s", async (outcome) => {
    let settle: () => void = () => {
      throw new Error("solver not started");
    };
    state.solve.mockImplementation(
      () =>
        new Promise<string[]>((resolve, reject) => {
          settle = () => (outcome === "success" ? resolve(["КОТ"]) : reject(new Error("solver failed")));
        }),
    );
    await startTemplateGeneration(request, 1);
    await vi.waitFor(() => expect(state.solve).toHaveBeenCalledOnce());
    await cancelTemplateGeneration(1n);
    const disconnects = state.disconnect.mock.calls.length;
    settle();
    await vi.waitFor(() => expect(state.disconnect.mock.calls.length).toBeGreaterThan(disconnects));
    expect(state.job?.status).toBe("cancelled");
    expect(state.job?.phase).toBe("cancelled");
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("persists and completes a successful job", async () => {
    state.solve.mockResolvedValue(["КОТ"]);
    await startTemplateGeneration(request, 1);
    await vi.waitFor(() => expect(state.job?.status).toBe("completed"));
    expect(state.insert).toHaveBeenCalledOnce();
    expect(state.job?.acceptedCount).toBe(1);
  });
});
describe("append templates snapshot", () => {
  it.each(["42", "42 2026"])("preserves existing files and snapshot entries for issue %s", async (issueLabel) => {
    directory = await mkdtemp(path.join(os.tmpdir(), "megacross-snapshot-"));
    vi.stubEnv("CROSS_SAMPLES_DIR", directory);
    const issueDirectory = path.join(directory, "edition", issueLabel);
    await mkdir(issueDirectory, { recursive: true });
    const bytes = buildFsh(grid);
    await writeFile(path.join(issueDirectory, "existing.fsh"), bytes);
    state.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ editionCode: "edition", issueLabel }]);
    state.results.mockResolvedValue([{ id: 2n, ordinal: 1, fshBytes: bytes }]);
    const result = await appendTemplatesToIssue(1n, [2n], 42n);
    expect(result.fileCount).toBe(2);
    const sql = state.execute.mock.calls[0][0] as { values: unknown[] };
    expect(JSON.parse(sql.values[3] as string)).toEqual(
      ["existing.fsh", "generated_1_1.fsh"].map((name) => ({
        name,
        key: `${name}:${bytes.length}`,
        size: bytes.length,
      })),
    );
  });
});
describe("repository cancellation guards", () => {
  it("guards updates and locks the active job before inserting a result", async () => {
    const repository = await vi.importActual<typeof import("../../../cross/server/src/templateGenerator/repository")>(
      "../../../cross/server/src/templateGenerator/repository",
    );
    const { createPrismaClient } = await import("../../../cross/server/src/db/prisma");
    const prisma = createPrismaClient();
    state.execute.mockResolvedValue(0);
    expect(await repository.patchTemplateJob(prisma, 1n, { status: "completed" })).toBe(false);
    expect((state.execute.mock.calls[0][0] as { strings: string[] }).strings.join("")).toContain(
      "AND status IN ('queued', 'running')",
    );
    expect(await repository.insertTemplateResult(prisma, 1n, 1, buildFsh(grid), grid, metrics, "test")).toBe(false);
    const sql = (state.execute.mock.calls[1][0] as { strings: string[] }).strings.join("");
    expect(sql).toContain("status = 'running' FOR UPDATE");
    expect(sql).toContain("FROM active_job");
  });
});

describe("template generation recovery", () => {
  it("completes a recovered job whose result was saved before its counter", async () => {
    state.results.mockResolvedValue([{ ordinal: 1, fingerprint: "saved" }]);
    await resumeTemplateGenerationJobs();
    await vi.waitFor(() => expect(state.job?.status).toBe("completed"));
    expect(state.job?.acceptedCount).toBe(1);
    expect(state.solve).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("continues after the highest persisted ordinal and counts saved results", async () => {
    if (!state.job) throw new Error("missing test job");
    state.job.parameters = { ...request, resultCount: 2 };
    state.results.mockResolvedValue([{ ordinal: 5, fingerprint: "saved" }]);
    state.solve.mockResolvedValue(["КОТ"]);
    await resumeTemplateGenerationJobs();
    await vi.waitFor(() => expect(state.job?.status).toBe("completed"));
    expect(state.job?.acceptedCount).toBe(2);
    expect(state.insert.mock.calls[0][2]).toBe(6);
  });
  it("marks an unexpected insert conflict as failed instead of abandoning a running job", async () => {
    state.insert.mockResolvedValue(false);
    state.solve.mockResolvedValue(["КОТ"]);
    await startTemplateGeneration(request, 1);
    await vi.waitFor(() => expect(state.job?.status).toBe("failed"));
    expect(state.job?.acceptedCount).toBe(0);
  });
  it("preserves cancellation between the solver check and result insertion", async () => {
    state.solve.mockResolvedValue(["КОТ"]);
    state.insert.mockImplementation(async () => {
      await cancelTemplateGeneration(1n);
      return false;
    });
    await startTemplateGeneration(request, 1);
    await vi.waitFor(() => expect(state.insert).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(state.job?.status).toBe("cancelled"));
    expect(state.job?.acceptedCount).toBe(0);
  });
});
