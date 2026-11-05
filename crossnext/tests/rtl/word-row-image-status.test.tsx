import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WordRow } from "@/components/dictionary/word-list/WordRow";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/dictionary/AddDefinitionModal", () => ({ AddDefinitionModal: () => null }));
vi.mock("@/components/dictionary/DefTagsModal", () => ({ DefTagsModal: () => null }));

function renderRow(isImageable: boolean, hasImage: boolean) {
  return render(
    <WordRow
      word={{ id: "1", word_text: "cat", isImageable, hasImage, opred_v: [] }}
      onEditWordStart={vi.fn()}
      onEditDefStart={vi.fn()}
      onRequestDeleteWord={vi.fn()}
      onRequestDeleteDef={vi.fn()}
      isAddDefinitionOpen={false}
      onAddDefinitionOpenChange={vi.fn()}
      openTagsForDefId={null}
      onDefTagsOpenChange={vi.fn()}
      onDefTagsSaved={vi.fn()}
    />,
  );
}

describe("word image status", () => {
  it.each([false, true])("hides both indicators for non-imageable words (hasImage=%s)", (hasImage) => {
    renderRow(false, hasImage);
    expect(screen.queryByLabelText("wordIsImageable")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("wordHasImage")).not.toBeInTheDocument();
    expect(screen.getByText("cat").firstElementChild).toHaveClass("controls-hover-visible");
  });

  it("shows only the imageability indicator when no image is saved", () => {
    renderRow(true, false);
    expect(screen.getByLabelText("wordIsImageable")).toBeVisible();
    expect(screen.queryByLabelText("wordHasImage")).not.toBeInTheDocument();
  });

  it("shows both indicators in a separate block under the word", () => {
    renderRow(true, true);
    const indicator = screen.getByLabelText("wordIsImageable");
    const row = indicator.parentElement;
    expect(row?.previousSibling?.textContent).toBe("cat");
    expect(row).toContainElement(screen.getByLabelText("wordHasImage"));
    expect(indicator.querySelector("svg")).toHaveClass("size-4");
    expect(row).toHaveClass("flex", "text-muted-foreground");
  });

  it("opens tooltips on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    renderRow(true, true);
    await user.hover(screen.getByLabelText("wordIsImageable"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("wordIsImageable");
    await user.unhover(screen.getByLabelText("wordIsImageable"));
    await user.tab();
    expect(screen.getByLabelText("wordIsImageable")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("wordHasImage")).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("wordHasImage");
  });
});
