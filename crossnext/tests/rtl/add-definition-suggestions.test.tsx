import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddDefinitionModal } from "@/components/dictionary/AddDefinitionModal";
import {
  type DefinitionSuggestions,
  GeneratedDefinitions,
} from "@/components/dictionary/add-definition/GeneratedDefinitions";
import type { MetaSection } from "@/components/dictionary/add-definition/MetaSection";
import { useDictionaryStore } from "@/store/dictionary";
import { useUiStore } from "@/store/ui";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key} ${values.count}`,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("react-rnd", () => ({ Rnd: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/components/admin/pending/DefinitionCarousel", () => ({
  DefinitionCarousel: ({ items }: { items: Array<{ key: string; node: ReactNode }> }) => (
    <div>
      {items.map((item) => (
        <div key={item.key}>{item.node}</div>
      ))}
    </div>
  ),
}));
vi.mock("@/lib/useDifficulties", () => ({ useDifficulties: () => ({ data: [1, 2, 3] }) }));
vi.mock("@/components/dictionary/add-definition/MetaSection", () => ({
  MetaSection: (props: ComponentProps<typeof MetaSection>) => (
    <div>
      <input aria-label="note" {...props.noteInput} />
      <button
        type="button"
        onClick={() => {
          props.onDifficultyChange(3);
          props.onEndDateChange(new Date("2030-01-01T00:00:00Z"));
          props.onAddTag({ id: 7, name: "Animals" });
        }}
      >
        set metadata
      </button>
    </div>
  ),
}));

const variants = ["домашний хищник", "усатый питомец", "ночной охотник"];
const nextVariants = ["пушистый любимец", "ловец мышей", "мурлыкающий зверь"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type SavedDefinition = { definition: string; note?: string; difficulty: number; tags: number[]; end_date?: string };

describe("generated definition selection", () => {
  let mobile = false;
  let saved: { definitions: SavedDefinition[] } | undefined;
  let requests: Array<{ existing: string[]; avoid: string[]; count: number }>;
  let generateResponse: (signal?: AbortSignal | null) => Promise<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mobile = false;
    saved = undefined;
    requests = [];
    useUiStore.getState().reset();
    useDictionaryStore.setState({ dictionaryLang: "ru" });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: mobile,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    generateResponse = async () => json({ success: true, text: variants[0], texts: variants });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/dictionary/word/"))
          return json({ opred_v: [{ id: "old", text_opr: "старое определение" }] });
        if (url === "/api/ai/generate-definition") {
          requests.push(JSON.parse(String(init?.body)));
          return generateResponse(init?.signal);
        }
        if (url === "/api/pending/create") {
          saved = JSON.parse(String(init?.body));
          return json({ success: true });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function show() {
    return render(<AddDefinitionModal wordId="10" wordText="кот" open onOpenChange={vi.fn()} />);
  }
  async function generate() {
    await userEvent.click(screen.getAllByRole("button", { name: "generateWithAiTooltip" })[0]);
    await screen.findByRole("checkbox", { name: variants[0] });
  }
  async function add(count: number) {
    await userEvent.click(screen.getByRole("button", { name: `aiAddSelectedDefinitions ${count}` }));
  }

  it.each([
    false,
    true,
  ])("adds multiple suggestions to an empty field and saves only the selection (mobile=%s)", async (isMobile) => {
    mobile = isMobile;
    show();
    await userEvent.type(await screen.findByLabelText("note"), "редакторская заметка");
    await userEvent.click(screen.getByRole("button", { name: "set metadata" }));
    await generate();
    expect(screen.getByRole("button", { name: "aiAddSelectedDefinitions 0" })).toBeDisabled();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByLabelText("definition")).toHaveValue("");
    const first = screen.getByRole("checkbox", { name: variants[0] });
    first.focus();
    await userEvent.keyboard(" ");
    expect(first).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[2] }));
    await add(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("definition").map((node) => (node as HTMLInputElement).value)).toEqual([
      variants[0],
      variants[2],
    ]);
    await userEvent.click(screen.getAllByRole("button", { name: "create" })[0]);
    await waitFor(() => expect(saved?.definitions).toHaveLength(2));
    expect(saved?.definitions[0]).toMatchObject({
      definition: variants[0],
      note: "редакторская заметка",
      difficulty: 3,
      tags: [7],
    });
    expect(saved?.definitions[0].end_date).toContain("2030-01-01");
    expect(saved?.definitions[1]).toMatchObject({ definition: variants[2], difficulty: 1, tags: [] });
    expect(saved?.definitions[1].note).toBeUndefined();
    expect(requests[0]).toMatchObject({ count: 3, existing: ["старое определение"] });
  });

  it("preserves a typed definition and appends a single chosen variant", async () => {
    show();
    await userEvent.type(await screen.findByLabelText("definition"), "мой текст");
    await generate();
    expect(screen.getByLabelText("definition")).toHaveValue("мой текст");
    expect(requests[0].avoid).toContain("мой текст");
    await userEvent.click(screen.getByRole("checkbox", { name: variants[1] }));
    await add(1);
    expect(screen.getAllByLabelText("definition").map((node) => (node as HTMLInputElement).value)).toEqual([
      "мой текст",
      variants[1],
    ]);
  });

  it.each([
    false,
    true,
  ])("shows the existing similarity comparison below each matching suggestion before adding it (mobile=%s)", async (isMobile) => {
    mobile = isMobile;
    const candidate = "автор оперы «Викинги»";
    const existingText = "опера «Викинги», композитор";
    generateResponse = async () => json({ success: true, texts: [candidate, "ночной охотник"] });
    render(
      <AddDefinitionModal
        wordId="42"
        wordText="аав"
        open
        onOpenChange={vi.fn()}
        existing={[{ id: "opera", text: existingText, lang: "ru" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    const checkbox = await screen.findByRole("checkbox", { name: candidate, exact: true });
    expect(screen.getByLabelText("definition")).toHaveValue("");
    expect(screen.getByText("68.29%")).toBeInTheDocument();
    expect(screen.getByText("similarDefsSimilar")).toBeInTheDocument();
    expect(screen.queryByText("similarDefsDuplicate")).not.toBeInTheDocument();
    expect(screen.getAllByText("similarDefsTitle")).toHaveLength(1);
    await userEvent.click(screen.getByText(existingText));
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await add(1);
    expect(screen.getByLabelText("definition")).toHaveValue(candidate);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("68.29%")).toBeInTheDocument();
  });

  it.each([
    false,
    true,
  ])("filters duplicates against fetched definitions and within the generated batch (mobile=%s)", async (isMobile) => {
    mobile = isMobile;
    generateResponse = async () =>
      json({ success: true, texts: ["определение старое", variants[1], "питомец усатый"] });
    show();
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await screen.findByRole("checkbox", { name: variants[1] });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.queryByRole("checkbox", { name: "определение старое" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "питомец усатый" })).not.toBeInTheDocument();
  });

  it("filters duplicates of the current typed definition", async () => {
    show();
    await userEvent.type(await screen.findByLabelText("definition"), "хищник домашний");
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await screen.findByRole("checkbox", { name: variants[1] });
    expect(screen.queryByRole("checkbox", { name: variants[0] })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByLabelText("definition")).toHaveValue("хищник домашний");
  });

  it("removes a selected suggestion when another definition is edited into its duplicate", async () => {
    show();
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    await userEvent.click(screen.getByRole("button", { name: "addAnotherDefinition" }));
    await userEvent.type(screen.getAllByLabelText("definition")[1], "хищник домашний");
    expect(screen.queryByRole("checkbox", { name: variants[0] })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "aiAddSelectedDefinitions 0" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[1] }));
    await add(1);
    expect(screen.getAllByLabelText("definition").map((node) => (node as HTMLInputElement).value)).toEqual([
      variants[1],
      "хищник домашний",
    ]);
  });

  it("remembers rejected variants and keeps the previous selection when every new variant is a duplicate", async () => {
    show();
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    generateResponse = async () => json({ success: true, texts: ["определение старое"] });
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("aiNoUniqueDefinitions"));
    expect(screen.getByRole("checkbox", { name: variants[0] })).toBeChecked();
    generateResponse = async () => json({ success: true, texts: nextVariants });
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await screen.findByRole("checkbox", { name: nextVariants[0] });
    expect(requests.at(-1)?.avoid).toContain("определение старое");
  });

  it("shows feedback without inserting anything when the first batch contains only duplicates", async () => {
    generateResponse = async () => json({ success: true, texts: ["определение старое"] });
    show();
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("aiNoUniqueDefinitions"));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("definition")).toHaveValue("");
    expect(screen.getByRole("button", { name: "generateWithAiTooltip" })).toBeEnabled();
  });

  it("keeps the field and selection when the server rejects a duplicate batch", async () => {
    show();
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    generateResponse = async () => json({ success: false, errorCode: "AI_NO_UNIQUE_DEFINITIONS" }, 422);
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("aiNoUniqueDefinitions"));
    expect(screen.getByRole("checkbox", { name: variants[0] })).toBeChecked();
    expect(screen.getByLabelText("definition")).toHaveValue("");
    expect(requests[0]).toMatchObject({ wordId: "10" });
  });

  it("shows an informational message and preserves drafts when AI has no new candidates", async () => {
    show();
    await userEvent.type(await screen.findByLabelText("definition"), "мой текст");
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    generateResponse = async () => json({ success: false, errorCode: "AI_NO_NEW_DEFINITIONS" }, 422);
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("aiNoNewDefinitions"));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("definition")).toHaveValue("мой текст");
    expect(screen.getByRole("checkbox", { name: variants[0] })).toBeChecked();
    expect(screen.getByRole("button", { name: "generateWithAiTooltip" })).toBeEnabled();
  });

  it("never inserts the reported opera duplicate in the form", async () => {
    generateResponse = async () =>
      json({ success: true, texts: ["композитор оперы «Викинги", "эстонский хоровой дирижёр"] });
    render(
      <AddDefinitionModal
        wordId="42"
        wordText="аав"
        open
        onOpenChange={vi.fn()}
        existing={[{ id: "opera", text: "опера «Викинги», композитор", lang: "ru" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await screen.findByRole("checkbox", { name: "эстонский хоровой дирижёр" });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await userEvent.click(screen.getByRole("checkbox", { name: "эстонский хоровой дирижёр" }));
    await add(1);
    expect(screen.getByLabelText("definition")).toHaveValue("эстонский хоровой дирижёр");
  });

  it("retains suggestions and selection on failure; replaces and clears selection on success", async () => {
    show();
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    generateResponse = async () => json({ message: "failed" }, 502);
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: variants[0] })).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: variants[0] })).toBeChecked();
    expect(requests[1].avoid).toEqual(variants);
    generateResponse = async () => json({ success: true, text: nextVariants[0], texts: nextVariants });
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await screen.findByRole("checkbox", { name: nextVariants[0] });
    expect(screen.queryByRole("checkbox", { name: variants[0] })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "aiAddSelectedDefinitions 0" })).toBeDisabled();
  });

  it.each([
    { success: true, texts: "домашний хищник" },
    { success: true, texts: JSON.stringify(variants) },
    { success: true, texts: { length: 3 } },
    { success: true, texts: [variants[0], null] },
    { success: true, texts: [" "] },
    { success: true, text: variants[0] },
    { success: false, texts: variants },
  ])("keeps the modal and previous selection intact for a malformed response %j", async (response) => {
    show();
    await generate();
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    generateResponse = async () => json(response);
    await userEvent.click(screen.getByRole("button", { name: "generateWithAiTooltip" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("aiError"));
    expect(screen.getByRole("checkbox", { name: variants[0] })).toBeChecked();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    await add(1);
    expect(screen.getByLabelText("definition")).toHaveValue(variants[0]);
  });

  it("ignores malformed suggestion state retained across a hot refresh and renders fresh results", () => {
    const props = { disabled: false, onToggle: vi.fn(), onAdd: vi.fn() };
    const staleSuggestions = { texts: "домашний хищник", selected: [] } as unknown as DefinitionSuggestions;
    const view = render(<GeneratedDefinitions {...props} suggestions={staleSuggestions} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    view.rerender(<GeneratedDefinitions {...props} suggestions={{ texts: variants, selected: [] }} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it.each(["close", "word", "remove"])("ignores a late response after %s", async (change) => {
    let resolveResponse: (response: Response) => void = () => {};
    let signal: AbortSignal | null | undefined;
    generateResponse = (requestSignal) => {
      signal = requestSignal;
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    };
    const view = show();
    if (change === "remove") await userEvent.click(screen.getByRole("button", { name: "addAnotherDefinition" }));
    await userEvent.click(screen.getAllByRole("button", { name: "generateWithAiTooltip" })[0]);
    await waitFor(() => expect(requests).toHaveLength(1));
    if (change === "close")
      view.rerender(<AddDefinitionModal wordId="10" wordText="кот" open={false} onOpenChange={vi.fn()} />);
    if (change === "word") view.rerender(<AddDefinitionModal wordId="11" wordText="пёс" open onOpenChange={vi.fn()} />);
    if (change === "remove") await userEvent.click(screen.getAllByRole("button", { name: "delete" })[0]);
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolveResponse(json({ success: true, text: variants[0], texts: variants }));
    });
    if (change === "close")
      view.rerender(<AddDefinitionModal wordId="10" wordText="кот" open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("definition")).toHaveValue("");
  });

  it("keeps suggestions bound to their field after removing an earlier definition", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "addAnotherDefinition" }));
    await userEvent.click(screen.getAllByRole("button", { name: "generateWithAiTooltip" })[1]);
    await screen.findByRole("checkbox", { name: variants[0] });
    await userEvent.click(screen.getByRole("checkbox", { name: variants[0] }));
    await userEvent.click(screen.getAllByRole("button", { name: "delete" })[0]);
    await add(1);
    expect(screen.getByLabelText("definition")).toHaveValue(variants[0]);
  });
});
