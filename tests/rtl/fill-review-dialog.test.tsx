import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FillReviewDialog } from "@/components/scanwords/workspace/FillReviewDialog";
import type { FillReviewPayload } from "@/components/scanwords/workspace/model";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: () => null,
}));

vi.mock("@/components/dictionary/AddDefinitionModal", () => ({
  AddDefinitionModal: () => null,
}));

vi.mock("@/components/dictionary/EditDefinitionModal", () => ({
  EditDefinitionModal: () => null,
}));

vi.mock("@/components/dictionary/NewWordModal", () => ({
  NewWordModal: () => null,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeReviewPayload(): FillReviewPayload {
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

describe("FillReviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("clears persisted draft after successful finalize", async () => {
    const draftStorageKey = "scanwords:fillReviewDraft:job-1";
    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        version: 2,
        rows: [{ templateKey: "tpl-1", slotId: 1, word: "ДОМ", definition: "Дом", wordId: "11", opredId: null }],
      }),
    );

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/scanwords/fill-review-draft?jobId=job-1" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ available: false, rows: [] });
      }
      if (url === "/api/scanwords/fill-review-draft?jobId=job-1" && init?.method === "DELETE") {
        return jsonResponse({ available: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onFinalize = vi.fn().mockResolvedValue(undefined);
    render(
      <FillReviewDialog
        open
        onOpenChange={vi.fn()}
        reviewJobId="job-1"
        reviewData={makeReviewPayload()}
        definitionLimits={{ maxPerCell: 30, maxPerHalfCell: 15 }}
        loading={false}
        finalizing={false}
        error={null}
        onFinalize={onFinalize}
        onRequestCandidates={vi.fn().mockResolvedValue([])}
      />,
    );

    await waitFor(() => expect(screen.getByText("Дом")).toBeInTheDocument());
    const finalizeButtons = screen.getAllByRole("button", { name: "scanwordsReviewFinalize" });
    await userEvent.click(finalizeButtons[finalizeButtons.length - 1]);

    await waitFor(() => expect(onFinalize).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(draftStorageKey)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scanwords/fill-review-draft?jobId=job-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
