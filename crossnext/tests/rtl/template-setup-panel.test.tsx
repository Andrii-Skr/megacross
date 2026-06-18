import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateSetupPreviewTemplate, TemplateSetupTemplate } from "@/components/scanwords/workspace/model";
import { TemplateSetupPanel } from "@/components/scanwords/workspace/TemplateSetupPanel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="next-image" />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderPanel(props: ComponentProps<typeof TemplateSetupPanel>) {
  return render(<TemplateSetupPanel {...props} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [],
        nextCursor: null,
        images: [],
      }),
    })),
  );
});

function makeTemplate(): TemplateSetupPreviewTemplate {
  return {
    key: "tpl-1",
    name: "8",
    sourceName: "8.fsh",
    order: 0,
    grid: {
      rows: 6,
      cols: 6,
      data: ["******", "******", "******", "******", "******", "******"],
      marker: "000000",
      codes: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 1)),
    },
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "right",
        len: 6,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [0, 4],
          [0, 5],
        ],
        startNumber: 1,
        isPhotoDefinition: false,
        photoAreaBounds: null,
      },
      {
        slotId: 4,
        r: 0,
        c: 5,
        dir: "down",
        len: 6,
        cells: [
          [0, 5],
          [1, 5],
          [2, 5],
          [3, 5],
          [4, 5],
          [5, 5],
        ],
        startNumber: 4,
        isPhotoDefinition: true,
        photoAreaBounds: { minRow: 0, minCol: 0, maxRow: 2, maxCol: 2 },
      },
    ],
    startPositions: [
      { number: 1, r: 0, c: 0, dir: "right", slotId: 1 },
      { number: 4, r: 0, c: 5, dir: "down", slotId: 4 },
    ],
    cells: [{ row: 0, col: 5, isIntersection: true, slotIds: [1, 4] }],
    arrows: [],
    setup: null,
  };
}

describe("TemplateSetupPanel", () => {
  it("keeps the current slot word visible while editing that same slot", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: "word-1", word_text: "РАЗБЕГ" }],
        nextCursor: null,
      }),
    } as Response);

    const template = makeTemplate();
    const templateSetup: TemplateSetupTemplate = {
      templateKey: "tpl-1",
      keyword: null,
      fixedSlots: [{ slotId: 1, wordId: "word-1", word: "РАЗБЕГ" }],
    };

    renderPanel({
      active: true,
      loading: false,
      error: null,
      dictionaryFilter: null,
      dictionaryLanguage: "ru",
      dictionaryReady: true,
      templates: [template],
      templateMap: new Map([["tpl-1", templateSetup]]),
      onKeywordChange: vi.fn(),
      onFixedSlotChange: vi.fn(),
      onFixedSlotClear: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: /Открыть 1\. → 6/i }));
    const dialog = screen.getByRole("dialog");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "РАЗБЕГ" })).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  });
});
