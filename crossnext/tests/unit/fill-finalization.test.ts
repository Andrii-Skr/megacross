import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FillJobPatch, FillJobRow } from "../../../cross/server/src/services/fillJobRepository";
import type { ReviewTemplate } from "../../../cross/server/src/services/fillJobReviewService";

const state = vi.hoisted(() => ({
  row: null as FillJobRow | null,
  claim: vi.fn(),
  patch: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  wordStat: vi.fn(),
  opredStat: vi.fn(),
  load: vi.fn(),
}));

vi.mock("../../../cross/server/src/db/prisma", () => {
  const tx = {
    $queryRaw: state.query,
    $executeRaw: state.execute,
    edition_word_stat: { upsert: state.wordStat },
    edition_opred_stat: { upsert: state.opredStat },
    word_v: { findMany: async () => [{ id: 10n, word_text: "КОТ", word_text_norm: "КОТ" }] },
  };
  return {
    prisma: { ...tx, $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) },
    Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
  };
});
vi.mock("../../../cross/server/src/services/fillJobRepository", async (original) => ({
  ...(await original<typeof import("../../../cross/server/src/services/fillJobRepository")>()),
  claimFillJobForFinalization: state.claim,
  loadFillJobById: state.load,
  patchFillJob: state.patch,
}));
vi.mock("../../../cross/server/src/services/fillWordImageService", () => ({
  loadWordImagesByIds: async () => new Map(),
  loadWordImagesByWordIds: async () => new Map(),
  buildWordImageAbsolutePath: (value: string) => value,
}));
vi.mock("../../../cross/server/scripts/crossword-svg", () => ({
  buildCrosswordSvg: () => ({ svg: "<svg/>", svgRaw: "<svg/>", usedWords: "КОТ" }),
}));
vi.mock("../../../cross/server/scripts/answer-only-svg", () => ({ buildAnswersOnlySvg: () => "<svg/>" }));
vi.mock("../../../cross/server/src/utils/epsExport", () => ({ exportSvgFilesToEps: vi.fn(async () => undefined) }));
vi.mock("../../../cross/server/src/utils/crosswordTextExport", () => ({ buildCrosswordTextFiles: () => null }));

import { finalizeFillJob } from "../../../cross/server/src/services/fillJobService";
import { exportSvgFilesToEps } from "../../../cross/server/src/utils/epsExport";

function template(photo: boolean, order: number): ReviewTemplate {
  return {
    key: `tpl-${order}`,
    name: String(order + 1),
    sourceName: `${order + 1}.fsh`,
    path: "",
    order,
    language: "ru",
    langId: 1,
    grid: { rows: 1, cols: 3, data: ["***"], marker: "000", codes: [[1, 1, 1]] },
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "right",
        len: 3,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
        ],
        word: "КОТ",
        wordId: photo ? "10" : "20",
        opredId: photo ? "100" : "200",
        definition: "Животное",
        definitionOptions: [],
        isPhotoDefinition: photo,
        photoAreaBounds: photo ? { minRow: 0, minCol: 0, maxRow: 0, maxCol: 1 } : null,
        availableImages: [],
        selectedImageId: null,
        intersections: [],
        startNumber: 1,
        clueCell: { key: "clue", row: 0, col: 0 },
      },
    ],
    clueGroups: [{ key: "clue", row: 0, col: 0, slotIds: [1], areaCellCount: photo ? 2 : 1 }],
    startPositions: [],
  };
}

describe("fill finalization", () => {
  let directory: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    directory = await mkdtemp(path.join(os.tmpdir(), "megacross-finalization-"));
    vi.stubEnv("CROSS_OUTPUT_DIR", directory);
    state.row = {
      id: 1n,
      issueId: 2n,
      status: "review",
      progress: 100,
      currentTemplate: null,
      completedTemplates: 0,
      totalTemplates: 2,
      error: null,
      outputPath: null,
      outputSize: null,
      templates: null,
      options: { usageStats: true, editionHotBan: false, writeCrw: false },
      reviewData: {
        version: 1,
        issue: { issueId: "2", editionId: 3, editionCode: "test", issueLabel: "1" },
        options: { style: "corel", writeCrw: false, usageStats: true },
        templates: [template(true, 0), template(false, 1)],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.claim.mockImplementation(async () => state.row);
    state.load.mockImplementation(async () => state.row);
    state.query.mockResolvedValue([]);
    state.patch.mockImplementation(async (_db, _id, patch: FillJobPatch) => Object.assign(state.row ?? {}, patch));
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects a second export while the first is acquiring its database claim", async () => {
    let release!: (row: FillJobRow | null) => void;
    state.claim.mockImplementationOnce(
      () =>
        new Promise<FillJobRow | null>((resolve) => {
          release = resolve;
        }),
    );
    const first = finalizeFillJob(1n, {});
    await expect(finalizeFillJob(1n, {})).rejects.toMatchObject({ status: 409 });
    expect(state.claim).toHaveBeenCalledTimes(1);
    release(null);
    await expect(first).rejects.toMatchObject({ status: 409 });
    expect(state.patch).not.toHaveBeenCalled();
  });

  it("does not reset another process's job when the atomic claim fails", async () => {
    state.claim.mockResolvedValueOnce(null);
    await expect(finalizeFillJob(1n, {})).rejects.toMatchObject({ status: 409 });
    expect(state.patch).not.toHaveBeenCalled();
    state.claim.mockResolvedValueOnce(null);
    await expect(finalizeFillJob(1n, {})).rejects.toMatchObject({ status: 409 });
    expect(state.claim).toHaveBeenCalledTimes(2);
  });

  it("excludes a failed photo template from usage and allows its words/definitions in a successful neighbor", async () => {
    const result = await finalizeFillJob(1n, { templates: [{ key: "tpl-0", slots: [{ slotId: 1, imageId: "999" }] }] });
    expect(result).toMatchObject({ status: "done", completedTemplates: 1 });
    expect(state.wordStat).toHaveBeenCalledTimes(1);
    expect(state.wordStat).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editionId_wordId: { editionId: 3, wordId: 20n } } }),
    );
    expect(state.opredStat).toHaveBeenCalledTimes(1);
    expect(state.opredStat).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editionId_opredId: { editionId: 3, opredId: 200n } } }),
    );
    const errors = JSON.parse(
      execFileSync("unzip", ["-p", String(state.row?.outputPath), "failures.json"], { encoding: "utf8" }),
    );
    expect(errors).toEqual(["Template 1: image 999 not found for slot 1"]);
  });

  it("keeps a committed archive finalized if the notification read fails", async () => {
    state.load.mockImplementation(async () => {
      if (state.row?.status === "done") throw new Error("notification read failed");
      return state.row;
    });
    await expect(finalizeFillJob(1n, {})).rejects.toThrow("notification read failed");
    expect(state.row?.status).toBe("done");
    expect(state.row?.outputPath).toBeTruthy();
    const entries = execFileSync("unzip", ["-Z1", String(state.row?.outputPath)], { encoding: "utf8" });
    expect(entries).toContain("2/crossword.svg");
  });

  it("does not reuse files from a failed export attempt", async () => {
    const review = state.row?.reviewData as { templates: ReviewTemplate[] };
    review.templates = [template(false, 0), template(false, 1)];
    vi.mocked(exportSvgFilesToEps).mockRejectedValueOnce(new Error("EPS failed"));
    await expect(finalizeFillJob(1n, {})).rejects.toThrow("EPS failed");
    const issueRoot = path.join(directory, "test", "1");
    expect(await readdir(issueRoot)).toEqual([]);
    const result = await finalizeFillJob(1n, { templates: [{ key: "tpl-0", slots: [{ slotId: 1, word: "" }] }] });
    expect(result.completedTemplates).toBe(1);
    const entries = execFileSync("unzip", ["-Z1", String(state.row?.outputPath)], { encoding: "utf8" });
    expect(entries).not.toContain("1/crossword.svg");
    expect(entries).toContain("2/crossword.svg");
    expect((await readdir(issueRoot)).filter((name) => name.startsWith(".job-"))).toEqual([]);
  });
});
