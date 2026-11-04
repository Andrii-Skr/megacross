import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithOpenAI } from "@/lib/ai/providers/openai";

const input = { word: "cat", language: "en" as const, existing: [], maxLength: 20 };
const opts = {
  baseUrl: "https://api.openai.com",
  apiKey: "test",
  model: "gpt-4o-mini",
  systemText: "rules",
  userText: "data",
};
const response = (content: string, finish_reason = "stop") =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason }] }));
afterEach(() => vi.restoreAllMocks());

describe("OpenAI definition correction", () => {
  it("rewrites an overlong clue once without cutting it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("domesticated feline often kept as a pet"))
      .mockResolvedValueOnce(response("small household pet"));
    await expect(generateWithOpenAI(input, opts)).resolves.toEqual({ ok: true, text: "small household pet" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(second.messages.at(-1).content).toContain("maximum: 20 characters");
  });
  it("also excludes previous generated variants without treating them as dictionary context", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("small household pet"))
      .mockResolvedValueOnce(response("domestic feline"));
    await expect(generateWithOpenAI({ ...input, avoid: ["small household pet"] }, opts)).resolves.toEqual({
      ok: true,
      text: "domestic feline",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("stops after two invalid clues", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => response("a clue far beyond the twenty character limit"));
    await expect(generateWithOpenAI(input, opts)).resolves.toMatchObject({ ok: false, status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not retry quota errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("quota", { status: 429 }));
    await expect(generateWithOpenAI(input, opts)).resolves.toMatchObject({ ok: false, status: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("rejects token-truncated clues even when their length fits", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("small household pe", "length"))
      .mockResolvedValueOnce(response("small household pet"));
    await expect(generateWithOpenAI(input, opts)).resolves.toEqual({ ok: true, text: "small household pet" });
  });
  it("turns malformed upstream JSON into a controlled error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid json"));
    await expect(generateWithOpenAI(input, opts)).resolves.toMatchObject({ ok: false, status: 502 });
  });
});
