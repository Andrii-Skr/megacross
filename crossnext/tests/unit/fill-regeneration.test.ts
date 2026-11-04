import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FillJobRow } from "../../../cross/server/src/services/fillJobRepository";

const state = vi.hoisted(() => ({ row: null as FillJobRow | null, query: vi.fn(), save: vi.fn() }));
vi.mock("../../../cross/server/src/db/prisma", () => ({
  prisma: { $queryRaw: state.query },
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}));
vi.mock("../../../cross/server/src/services/fillJobRepository", async (original) => ({
  ...(await original<typeof import("../../../cross/server/src/services/fillJobRepository")>()),
  loadFillJobById: async () => ({ ...state.row, reviewData: JSON.parse(JSON.stringify(state.row?.reviewData)) }),
  saveRegeneratedReviewIfCurrent: state.save,
}));
vi.mock("../../../cross/server/src/services/dictionary", async (original) => ({
  ...(await original<typeof import("../../../cross/server/src/services/dictionary")>()),
  loadDictionaryByTemplate: async () => new Map([[3, ["КОТ"]]]),
}));
vi.mock("../../../cross/server/src/services/fillJobTemplateService", async (original) => ({
  ...(await original<typeof import("../../../cross/server/src/services/fillJobTemplateService")>()),
  buildEntries: () => ({ entries: [], lengths: [], invalid: [] }),
}));
vi.mock("../../../cross/server/scripts/crossword-svg", () => ({ buildCrosswordSvg: vi.fn() }));
vi.mock("../../../cross/server/scripts/answer-only-svg", () => ({ buildAnswersOnlySvg: vi.fn() }));
vi.mock("../../../cross/server/src/utils/epsExport", () => ({ exportSvgFilesToEps: vi.fn() }));

import { regenerateFillJobTemplate } from "../../../cross/server/src/services/fillJobService";

function queryRows(strings: TemplateStringsArray) {
  const sql = strings.join("");
  if (sql.includes("FROM issues")) return [{ editionId: 3, filterTemplateId: 1, editionCode: "test", issueLabel: "1" }];
  if (sql.includes("FROM dictionary_filter_templates"))
    return [{ language: "ru", query: "", scope: "word", tagNames: [], excludeTagNames: [] }];
  if (sql.includes("SELECT files"))
    return [
      {
        files: [
          { name: "1.fsh", key: "tpl-0" },
          { name: "2.fsh", key: "tpl-1" },
        ],
      },
    ];
  if (sql.includes("FROM language")) return [{ id: 1 }];
  return [];
}

describe("regeneration review conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const templates = [0, 1].map((order) => ({
      key: `tpl-${order}`,
      name: String(order + 1),
      sourceName: `${order + 1}.fsh`,
      order,
      path: "",
      slots: [],
    }));
    state.row = {
      id: 1n,
      issueId: 2n,
      status: "review",
      progress: 100,
      currentTemplate: null,
      completedTemplates: 2,
      totalTemplates: 2,
      error: null,
      outputPath: null,
      outputSize: null,
      templates: templates.map((t) => ({ ...t, status: "done" })),
      options: { usageStats: false, usageRebalance: false, editionHotBan: false },
      reviewData: {
        version: 1,
        issue: { issueId: "2", editionId: 3, editionCode: "test", issueLabel: "1" },
        options: {},
        templates,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.query.mockImplementation(async (strings) => queryRows(strings));
    state.save.mockImplementation(async (_db, _id, previous, next, statuses) => {
      if (state.row?.status !== "review" || JSON.stringify(state.row.reviewData) !== JSON.stringify(previous))
        return false;
      state.row.reviewData = next;
      state.row.templates = statuses;
      return true;
    });
  });

  it("rejects a stale concurrent result and preserves the first update", async () => {
    const results = await Promise.allSettled([
      regenerateFillJobTemplate(1n, { templateKey: "tpl-0" }),
      regenerateFillJobTemplate(1n, { templateKey: "tpl-1" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const conflict = results.find((result) => result.status === "rejected");
    expect(conflict).toMatchObject({ reason: { status: 409 } });
    const review = state.row?.reviewData as { templates: Array<{ key: string }> };
    expect(review.templates).toHaveLength(1);
    // Retrying against the current review applies the other update without restoring the first template.
    await regenerateFillJobTemplate(1n, { templateKey: review.templates[0].key });
    expect((state.row?.reviewData as { templates: unknown[] }).templates).toEqual([]);
  });

  it("does not reset the job to review if finalization started during regeneration", async () => {
    state.query.mockImplementation(async (strings) => {
      if (!state.row) throw new Error("Missing job fixture");
      state.row.status = "running";
      return queryRows(strings);
    });
    await expect(regenerateFillJobTemplate(1n, { templateKey: "tpl-0" })).rejects.toMatchObject({ status: 409 });
    expect(state.row?.status).toBe("running");
    expect((state.row?.reviewData as { templates: unknown[] }).templates).toHaveLength(2);
  });

  it("also compares the original value when an older job stores the review as a JSON string", async () => {
    if (!state.row) throw new Error("Missing job fixture");
    state.row.reviewData = JSON.stringify(state.row.reviewData);
    await regenerateFillJobTemplate(1n, { templateKey: "tpl-0" });
    expect((state.row.reviewData as { templates: unknown[] }).templates).toHaveLength(1);
  });
});
