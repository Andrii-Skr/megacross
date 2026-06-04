import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { GenerationPanel } from "@/components/scanwords/workspace/GenerationPanel";
import type { FillTemplateStatus } from "@/components/scanwords/workspace/model";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

function makeTemplate(status: FillTemplateStatus["status"], name: string, key = name): FillTemplateStatus {
  return {
    key,
    name,
    sourceName: `${name}.fsh`,
    status,
    error: status === "error" ? "boom" : null,
    order: 0,
  };
}

describe("GenerationPanel", () => {
  const baseProps = {
    active: true,
    fillReady: true,
    fillError: null,
    fillJob: null,
    fillStatus: "done" as const,
    hasTemplateErrors: false,
    fillStatusLabel: "done",
    fillProgress: 100,
    fillCompleted: 1,
    fillTotal: 1,
    archiveUrl: null,
    latestArchiveOnly: true,
    fillCanStart: true,
    fillStarting: false,
    finalizing: false,
    reviewAvailable: false,
    templateList: [makeTemplate("done", "8"), makeTemplate("error", "9")],
    regeneratingTemplateKey: null,
    templateStatusLabel: (status: FillTemplateStatus["status"]) => `status:${status}`,
    templateErrorText: (error?: string | null) => error ?? null,
    onSettingsOpen: vi.fn(),
    onFillStart: vi.fn(),
    onLatestArchiveOnlyChange: vi.fn(),
    onOpenArchivesDialog: vi.fn(),
    onOpenReview: vi.fn(),
    onRegenerateTemplate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPanel(props = baseProps) {
    return render(
      <TooltipProvider>
        <GenerationPanel {...props} />
      </TooltipProvider>,
    );
  }

  it("renders template statuses and errors", () => {
    renderPanel();

    expect(screen.getAllByText("8.fsh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9.fsh").length).toBeGreaterThan(0);
    expect(screen.getByText("status:done")).toBeInTheDocument();
    expect(screen.getByText("status:error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("uses confirm flow before restarting while in review", async () => {
    renderPanel({ ...baseProps, fillStatus: "review", reviewAvailable: true });

    await userEvent.click(screen.getAllByRole("button", { name: "scanwordsFillStart" })[0]);
    expect(screen.getByText("scanwordsFillRestartTitle")).toBeInTheDocument();

    const startButtons = screen.getAllByRole("button", { name: "scanwordsFillStart" });
    await userEvent.click(startButtons[startButtons.length - 1]);
    expect(baseProps.onFillStart).toHaveBeenCalledTimes(1);
  });

  it("shows review and regenerate actions only in review state", async () => {
    renderPanel({ ...baseProps, fillStatus: "review", reviewAvailable: true });

    expect(screen.getAllByRole("button", { name: "scanwordsFillReviewOpen" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /scanwordsTemplateRegenerate/i })).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: /scanwordsTemplateRegenerate/i })[0]);
    expect(baseProps.onRegenerateTemplate).toHaveBeenCalledWith("8");
  });

  it("disables regenerate actions while finalize is running", () => {
    renderPanel({ ...baseProps, fillStatus: "review", reviewAvailable: true, finalizing: true });

    for (const button of screen.getAllByRole("button", { name: /scanwordsTemplateRegenerate/i })) {
      expect(button).toBeDisabled();
    }
  });
});
