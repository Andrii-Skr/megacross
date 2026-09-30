import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FillSettingsDialog } from "@/components/scanwords/workspace/FillSettingsDialog";
import { DEFAULT_FILL_SETTINGS } from "@/components/scanwords/workspace/model";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

function makeProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    selectedEditionName: "Edition A",
    selectedIssueLabel: "Issue 1",
    settingsDraft: DEFAULT_FILL_SETTINGS,
    settingsSaving: false,
    svgFonts: [],
    svgFontsLoading: false,
    fontUploading: false,
    speedOptions: [{ value: "fast" as const, label: "Fast", maxNodes: 100 }],
    onSpeedPresetChange: vi.fn(),
    onDefinitionMaxPerCellChange: vi.fn(),
    onDefinitionMaxPerHalfCellChange: vi.fn(),
    onTemplateCellSizeMmChange: vi.fn(),
    onAnswerCellSizeMmChange: vi.fn(),
    onType0CellSizeMmChange: vi.fn(),
    onClueFontBasePtChange: vi.fn(),
    onClueFontMinPtChange: vi.fn(),
    onClueGlyphWidthPctChange: vi.fn(),
    onClueLineHeightPctChange: vi.fn(),
    onSvgPhotoCluesGrayscaleChange: vi.fn(),
    onSvgFontIdChange: vi.fn(),
    onSvgSystemFontFamilyChange: vi.fn(),
    onUploadSvgFont: vi.fn(async () => {}),
    onSave: vi.fn(),
  };
}

describe("FillSettingsDialog tabs", () => {
  it("groups settings and supports keyboard navigation while keeping Save available", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<FillSettingsDialog {...props} />);

    expect(screen.getByRole("tab", { name: "scanwordsFillSettingsTabFill" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("scanwordsFillDefinitionMaxPerCellLabel")).toBeVisible();
    expect(screen.queryByLabelText("scanwordsSvgTemplateCellSizeMmLabel")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "scanwordsFillSettingsTabCells" }));
    expect(screen.getByLabelText("scanwordsSvgTemplateCellSizeMmLabel")).toBeVisible();
    await user.clear(screen.getByLabelText("scanwordsSvgTemplateCellSizeMmLabel"));
    await user.type(screen.getByLabelText("scanwordsSvgTemplateCellSizeMmLabel"), "12.5");
    expect(props.onTemplateCellSizeMmChange).toHaveBeenLastCalledWith(12.5);

    await user.click(screen.getByRole("tab", { name: "scanwordsFillSettingsTabCells" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "scanwordsFillSettingsTabSvg" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("scanwordsSvgClueFontBasePtLabel")).toBeVisible();
    expect(screen.getByLabelText("scanwordsSvgSystemFontFamilyLabel")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "save" }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });
});
