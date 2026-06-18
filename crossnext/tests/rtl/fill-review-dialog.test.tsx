import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactNode } from "react";
import { vi } from "vitest";
import { AddDefinitionModal } from "@/components/dictionary/AddDefinitionModal";
import { FillReviewDialog } from "@/components/scanwords/workspace/FillReviewDialog";
import type { FillReviewPayload } from "@/components/scanwords/workspace/model";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: () => null,
}));

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/admin/pending/DefinitionCarousel", () => ({
  DefinitionCarousel: ({ items }: { items: Array<{ node: ReactNode }> }) => <div>{items[0]?.node ?? null}</div>,
}));

vi.mock("@/lib/useDifficulties", () => ({
  useDifficulties: () => ({ data: [1, 2, 3] }),
}));

vi.mock("@/lib/useGenerateDefinition", () => ({
  useGenerateDefinition: () => ({
    generate: vi.fn(),
    loading: false,
  }),
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
            availableImages: [],
            selectedImageId: null,
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

function makeSharedClusterReviewPayload(): FillReviewPayload {
  return {
    version: 1,
    issue: {
      issueId: "2",
      editionId: 1,
      editionCode: "E1",
      issueLabel: "43",
    },
    options: {
      style: "corel",
      writeCrw: false,
      usageStats: true,
    },
    templates: [
      {
        key: "tpl-shared",
        name: "4",
        sourceName: "4.fsh",
        order: 0,
        path: "sample/4.fsh",
        language: "ru",
        langId: 1,
        grid: {
          rows: 6,
          cols: 6,
          data: ["#####*", "#####*", "#####*", "#####*", "*↓#↓**", "*******"],
          marker: "000000",
          codes: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 1)),
        },
        slots: [
          {
            slotId: 1,
            r: 4,
            c: 1,
            dir: "down",
            len: 2,
            cells: [
              [4, 1],
              [5, 1],
            ],
            word: "АС",
            wordId: "11",
            opredId: null,
            definition: "Якорный кластер",
            definitionOptions: [{ opredId: null, text: "Якорный кластер", difficulty: null }],
            isPhotoDefinition: true,
            photoAreaBounds: { minRow: 0, minCol: 0, maxRow: 3, maxCol: 4 },
            availableImages: [
              {
                id: "img-anchor",
                wordId: "11",
                fileName: "anchor.png",
                mimeType: "image/png",
                width: 500,
                height: 400,
                aspectRatio: 1.25,
                url: "/api/dictionary/word-images/img-anchor",
              },
            ],
            selectedImageId: "img-anchor",
            intersections: [],
            clueCell: { key: "3,1", row: 3, col: 1 },
            startNumber: 1,
          },
          {
            slotId: 2,
            r: 4,
            c: 3,
            dir: "down",
            len: 2,
            cells: [
              [4, 3],
              [5, 3],
            ],
            word: "БД",
            wordId: "12",
            opredId: null,
            definition: "Хвост",
            definitionOptions: [{ opredId: null, text: "Хвост", difficulty: null }],
            isPhotoDefinition: false,
            photoAreaBounds: null,
            availableImages: [],
            selectedImageId: null,
            intersections: [],
            clueCell: { key: "4,2", row: 4, col: 2 },
            startNumber: 2,
          },
        ],
        clueGroups: [
          { key: "3,1", row: 3, col: 1, slotIds: [1], areaCellCount: 20 },
          { key: "4,2", row: 4, col: 2, slotIds: [2], areaCellCount: 1 },
        ],
        startPositions: [],
      },
    ],
  };
}

describe("FillReviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
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

  it("shows image controls only for photo-definition slots", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/scanwords/fill-review-draft?jobId=job-2" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ available: false, rows: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = makeReviewPayload();
    const firstTemplate = payload.templates[0];
    const firstSlot = firstTemplate?.slots[0];
    if (!firstTemplate || !firstSlot) {
      throw new Error("Missing review slot fixture");
    }
    firstTemplate.slots[0] = {
      ...firstSlot,
      isPhotoDefinition: true,
      photoAreaBounds: { minRow: 0, minCol: 0, maxRow: 0, maxCol: 1 },
      availableImages: [
        {
          id: "img-1",
          wordId: "10",
          fileName: "cat.png",
          mimeType: "image/png",
          width: 200,
          height: 100,
          aspectRatio: 2,
          url: "/api/dictionary/word-images/img-1",
        },
      ],
      selectedImageId: "img-1",
    };

    render(
      <FillReviewDialog
        open
        onOpenChange={vi.fn()}
        reviewJobId="job-2"
        reviewData={payload}
        definitionLimits={{ maxPerCell: 30, maxPerHalfCell: 15 }}
        loading={false}
        finalizing={false}
        error={null}
        onFinalize={vi.fn().mockResolvedValue(undefined)}
        onRequestCandidates={vi.fn().mockResolvedValue([])}
      />,
    );

    await waitFor(() => expect(screen.getByText("Кот")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "scanwordsReviewImageUpload" })).toBeInTheDocument();
    expect(screen.getByText("scanwordsReviewImageChoose")).toBeInTheDocument();
    expect(screen.getAllByAltText("cat.png")).toHaveLength(2);
  });

  it("does not block finalize on a non-photo tail slot without image", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/scanwords/fill-review-draft?jobId=job-tail" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ available: false, rows: [] });
      }
      if (url === "/api/scanwords/fill-review-draft?jobId=job-tail" && init?.method === "DELETE") {
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
        reviewJobId="job-tail"
        reviewData={makeSharedClusterReviewPayload()}
        definitionLimits={{ maxPerCell: 30, maxPerHalfCell: 15 }}
        loading={false}
        finalizing={false}
        error={null}
        onFinalize={onFinalize}
        onRequestCandidates={vi.fn().mockResolvedValue([])}
      />,
    );

    await waitFor(() => expect(screen.getByText("Якорный кластер")).toBeInTheDocument());
    const finalizeButtons = screen.getAllByRole("button", { name: "scanwordsReviewFinalize" });
    await userEvent.click(finalizeButtons[finalizeButtons.length - 1]);

    await waitFor(() => expect(onFinalize).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("scanwordsReviewFinalizeConfirmTitle")).not.toBeInTheDocument();
  });

  it("ignores stale photo flag on a tail slot when its clue area is a single cell", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/scanwords/fill-review-draft?jobId=job-stale-tail" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ available: false, rows: [] });
      }
      if (url === "/api/scanwords/fill-review-draft?jobId=job-stale-tail" && init?.method === "DELETE") {
        return jsonResponse({ available: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = makeSharedClusterReviewPayload();
    const tailSlot = payload.templates[0]?.slots[1];
    if (!tailSlot) throw new Error("Missing tail slot fixture");
    payload.templates[0]!.slots[1] = {
      ...tailSlot,
      isPhotoDefinition: true,
      photoAreaBounds: { minRow: 0, minCol: 0, maxRow: 3, maxCol: 4 },
    };

    const onFinalize = vi.fn().mockResolvedValue(undefined);
    render(
      <FillReviewDialog
        open
        onOpenChange={vi.fn()}
        reviewJobId="job-stale-tail"
        reviewData={payload}
        definitionLimits={{ maxPerCell: 30, maxPerHalfCell: 15 }}
        loading={false}
        finalizing={false}
        error={null}
        onFinalize={onFinalize}
        onRequestCandidates={vi.fn().mockResolvedValue([])}
      />,
    );

    await waitFor(() => expect(screen.getByText("Якорный кластер")).toBeInTheDocument());
    expect(screen.queryByText("scanwordsReviewImageWordRequired")).not.toBeInTheDocument();

    const finalizeButtons = screen.getAllByRole("button", { name: "scanwordsReviewFinalize" });
    await userEvent.click(finalizeButtons[finalizeButtons.length - 1]);

    await waitFor(() => expect(onFinalize).toHaveBeenCalledTimes(1));
  });

  it("allows typing into nested add-definition modal opened from fill review", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/scanwords/fill-review-draft?jobId=job-3" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ available: false, rows: [] });
      }
      if (url === "/api/dictionary/word/10") {
        return jsonResponse({
          opred_v: [{ id: "101", text_opr: "Старое определение" }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FillReviewDialog
        open
        onOpenChange={vi.fn()}
        reviewJobId="job-3"
        reviewData={makeReviewPayload()}
        definitionLimits={{ maxPerCell: 30, maxPerHalfCell: 15 }}
        loading={false}
        finalizing={false}
        error={null}
        onFinalize={vi.fn().mockResolvedValue(undefined)}
        onRequestCandidates={vi.fn().mockResolvedValue([])}
      />,
    );

    await waitFor(() => expect(screen.getByText("Кот")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: "addDefinition" });
    await userEvent.click(openButtons[0]);

    const input = await screen.findByLabelText("definition");
    await userEvent.click(input);
    await userEvent.type(input, "Новое определение");

    expect(input).toHaveValue("Новое определение");
  });

  it("still allows typing in standalone add-definition modal", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/dictionary/word/10") {
        return jsonResponse({
          opred_v: [{ id: "101", text_opr: "Старое определение" }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AddDefinitionModal wordId="10" open onOpenChange={vi.fn()} wordText="КОТ" existing={[]} />);

    const input = await screen.findByLabelText("definition");
    await userEvent.click(input);
    await userEvent.type(input, "Самостоятельное определение");

    expect(input).toHaveValue("Самостоятельное определение");
  });
});
