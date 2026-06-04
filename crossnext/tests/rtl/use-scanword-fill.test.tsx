import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFillOverrides, useScanwordFill } from "@/components/scanwords/workspace/hooks/useScanwordFill";
import { DEFAULT_FILL_SETTINGS } from "@/components/scanwords/workspace/model";

const mocked = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  getScanwordFillArchivesAction: vi.fn(),
  getScanwordFillSettingsAction: vi.fn(),
  getScanwordIssueSvgSettingsAction: vi.fn(),
  listScanwordSvgFontsAction: vi.fn(),
  saveScanwordFillSettingsAction: vi.fn(),
  saveScanwordIssueSvgSettingsAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mocked.toast }));
vi.mock("@/app/actions/scanwords", () => ({
  getScanwordFillArchivesAction: (...args: unknown[]) => mocked.getScanwordFillArchivesAction(...args),
  getScanwordFillSettingsAction: (...args: unknown[]) => mocked.getScanwordFillSettingsAction(...args),
  getScanwordIssueSvgSettingsAction: (...args: unknown[]) => mocked.getScanwordIssueSvgSettingsAction(...args),
  listScanwordSvgFontsAction: (...args: unknown[]) => mocked.listScanwordSvgFontsAction(...args),
  saveScanwordFillSettingsAction: (...args: unknown[]) => mocked.saveScanwordFillSettingsAction(...args),
  saveScanwordIssueSvgSettingsAction: (...args: unknown[]) => mocked.saveScanwordIssueSvgSettingsAction(...args),
}));

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {}
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeReviewPayload() {
  return {
    version: 1,
    issue: {
      issueId: "1",
      editionId: 1,
      editionCode: "E1",
      issueLabel: "42",
    },
    options: {
      style: "corel",
      writeCrw: false,
      usageStats: true,
    },
    templates: [
      {
        key: "tpl-1",
        name: "8",
        sourceName: "8.fsh",
        order: 0,
        path: "sample/8.fsh",
        language: "ru",
        langId: 1,
        grid: { rows: 1, cols: 1, data: ["*"], marker: "000", codes: [[1]] },
        slots: [
          {
            slotId: 1,
            r: 0,
            c: 0,
            dir: "right",
            len: 3,
            cells: [[0, 0]],
            word: "КОТ",
            wordId: "10",
            opredId: null,
            definition: "Кот",
            definitionOptions: [{ opredId: null, text: "Кот", difficulty: null }],
            isPhotoDefinition: false,
            intersections: [],
            clueCell: null,
            startNumber: 1,
          },
        ],
        clueGroups: [],
        startPositions: [],
      },
    ],
  };
}

describe("useScanwordFill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("EventSource", MockEventSource);
    mocked.getScanwordFillArchivesAction.mockResolvedValue([]);
    mocked.getScanwordFillSettingsAction.mockResolvedValue(null);
    mocked.getScanwordIssueSvgSettingsAction.mockResolvedValue(null);
    mocked.listScanwordSvgFontsAction.mockResolvedValue([]);
    mocked.saveScanwordFillSettingsAction.mockResolvedValue(null);
    mocked.saveScanwordIssueSvgSettingsAction.mockResolvedValue(null);
  });

  it("loads latest job and sorts template list with errors first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/fill/latest?issueId=1")) {
          return jsonResponse({
            id: "job-1",
            issueId: "1",
            status: "done",
            progress: 100,
            templates: [
              { key: "b", name: "11", sourceName: "11.fsh", status: "done", order: 2 },
              { key: "a", name: "8", sourceName: "8.fsh", status: "error", order: 1, error: "boom" },
              { key: "c", name: "9", sourceName: "9.fsh", status: "done", order: 0 },
            ],
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { result } = renderHook(() =>
      useScanwordFill({
        selectedIssueId: "1",
        selectedTemplateId: 7,
        filesSignature: "files",
        crossApiBase: "http://cross",
        templateSetup: null,
        t: ((key: string) => key) as never,
      }),
    );

    await waitFor(() => expect(result.current.fillJob?.id).toBe("job-1"));
    expect(result.current.templateList.map((item) => item.sourceName ?? item.name)).toEqual([
      "8.fsh",
      "9.fsh",
      "11.fsh",
    ]);
  });

  it("autoloads review payload for jobs in review state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/fill/latest?issueId=1")) {
          return jsonResponse({
            id: "101",
            issueId: "1",
            status: "review",
            progress: 100,
            templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
          });
        }
        if (url.includes("/api/fill/101/review")) {
          return jsonResponse(makeReviewPayload());
        }
        if (url.includes("/api/fill/101")) {
          return jsonResponse({
            id: "101",
            issueId: "1",
            status: "review",
            progress: 100,
            templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { result } = renderHook(() =>
      useScanwordFill({
        selectedIssueId: "1",
        selectedTemplateId: 7,
        filesSignature: "files",
        crossApiBase: "http://cross",
        templateSetup: null,
        t: ((key: string) => key) as never,
      }),
    );

    await waitFor(() => expect(result.current.reviewData?.templates).toHaveLength(1));
    expect(result.current.reviewOpen).toBe(true);
  });

  it("finalizeReview proxies through next route and updates fillJob", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/fill/latest?issueId=1")) {
        return jsonResponse({
          id: "202",
          issueId: "1",
          status: "review",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
        });
      }
      if (url.includes("/api/fill/202/review")) {
        return jsonResponse(makeReviewPayload());
      }
      if (url === "/api/scanwords/fill/finalize") {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          id: "202",
          issueId: "1",
          status: "done",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
        });
      }
      if (url.includes("/api/fill/202")) {
        return jsonResponse({
          id: "202",
          issueId: "1",
          status: "review",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useScanwordFill({
        selectedIssueId: "1",
        selectedTemplateId: 7,
        filesSignature: "files",
        crossApiBase: "http://cross",
        templateSetup: null,
        t: ((key: string) => key) as never,
      }),
    );

    await waitFor(() => expect(result.current.fillJob?.id).toBe("202"));
    await act(async () => {
      await result.current.finalizeReview({
        templates: [
          {
            key: "tpl-1",
            slots: [{ slotId: 1, word: "КОТ", definition: "Кот", wordId: "10", opredId: null }],
          },
        ],
      });
    });

    expect(result.current.fillJob?.status).toBe("done");
    expect(fetchMock).toHaveBeenCalledWith("/api/scanwords/fill/finalize", expect.objectContaining({ method: "POST" }));
  });

  it("regenerates a single template through next route and resets cached review data", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/fill/latest?issueId=1")) {
        return jsonResponse({
          id: "303",
          issueId: "1",
          status: "review",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
        });
      }
      if (url.includes("/api/fill/303/review")) {
        return jsonResponse(makeReviewPayload());
      }
      if (url === "/api/scanwords/fill/regenerate-template") {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          id: "303",
          issueId: "1",
          status: "review",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "error", order: 0, error: "boom" }],
        });
      }
      if (url.includes("/api/fill/303")) {
        return jsonResponse({
          id: "303",
          issueId: "1",
          status: "review",
          progress: 100,
          templates: [{ key: "tpl-1", name: "8", sourceName: "8.fsh", status: "done", order: 0 }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useScanwordFill({
        selectedIssueId: "1",
        selectedTemplateId: 7,
        filesSignature: "files",
        crossApiBase: "http://cross",
        templateSetup: null,
        t: ((key: string) => key) as never,
      }),
    );

    await waitFor(() => expect(result.current.reviewData?.templates).toHaveLength(1));
    await act(async () => {
      await result.current.regenerateTemplate("tpl-1");
    });

    expect(result.current.fillJob?.templates?.[0]?.status).toBe("error");
    expect(result.current.regeneratingTemplateKey).toBeNull();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/scanwords/fill/regenerate-template",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("builds fill overrides from settings defaults", () => {
    expect(buildFillOverrides(DEFAULT_FILL_SETTINGS, 9)).toMatchObject({
      maxNodes: 200_000,
      shuffle: true,
      unique: true,
      lcv: true,
      style: "corel",
      explainFail: true,
      noDefs: true,
      requireNative: true,
      filterTemplateId: 9,
    });
  });
});
