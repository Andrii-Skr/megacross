import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TemplateSetupPreviewTemplate, TemplateSetupTemplate } from "@/components/scanwords/workspace/model";
import { TemplateSetupPanel } from "@/components/scanwords/workspace/TemplateSetupPanel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="next-image" />,
}));

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
  it("locks letters that come from already fixed intersecting slots", async () => {
    const onFixedSlotChange = vi.fn();
    const template = makeTemplate();
    const templateSetup: TemplateSetupTemplate = {
      templateKey: "tpl-1",
      keyword: null,
      fixedSlots: [{ slotId: 1, wordId: "word-1", word: "РАЗБЕГ" }],
    };

    render(
      <TemplateSetupPanel
        active
        loading={false}
        saving={false}
        dirty={false}
        error={null}
        hasPreview
        dictionaryLanguage="ru"
        dictionaryReady
        templates={[template]}
        templateMap={new Map([["tpl-1", templateSetup]])}
        onKeywordChange={vi.fn()}
        onFixedSlotChange={onFixedSlotChange}
        onFixedSlotClear={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Открыть 4\. ↓ 6/i }));

    const dialog = screen.getByRole("dialog");
    const inputs = within(dialog).getAllByRole("textbox");

    expect(inputs).toHaveLength(6);
    expect(inputs[0]).toHaveValue("Г");
    expect(inputs[0]).toHaveAttribute("readonly");
    expect(inputs[1]).not.toHaveAttribute("readonly");

    await userEvent.type(inputs[0], "А");
    expect(inputs[0]).toHaveValue("Г");

    await userEvent.type(inputs[1], "О");
    expect(inputs[1]).toHaveValue("О");
    expect(onFixedSlotChange).not.toHaveBeenCalled();
  });
});
