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
