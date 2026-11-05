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
  it.each([
    [6, "[]"],
    [3, "[]"],
    [1, ""],
    [1, '""'],
  ] as const)("accepts an explicit empty result for count=%s without a correction request", async (count, text) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(text));
    await expect(generateWithOpenAI({ ...input, count }, opts)).resolves.toEqual({ ok: true, text });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not treat missing or token-truncated content as an explicit empty result", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("[]", "length"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: null }, finish_reason: "stop" }] })),
      );
    await expect(generateWithOpenAI({ ...input, count: 3 }, opts)).resolves.toMatchObject({ ok: false, status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("accepts three distinct clues in one upstream request", async () => {
    const texts = ["small pet", "domestic feline", "furry companion"];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(JSON.stringify(texts)));
    await expect(generateWithOpenAI({ ...input, count: 3 }, opts)).resolves.toEqual({
      ok: true,
      text: JSON.stringify(texts),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("preserves six candidates for server filtering in one upstream request", async () => {
    const texts = [
      "small pet",
      "domestic feline",
      "furry companion",
      "night hunter",
      "mouse catcher",
      "purring animal",
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(JSON.stringify(texts)));
    await expect(generateWithOpenAI({ ...input, count: 6 }, opts)).resolves.toEqual({
      ok: true,
      text: JSON.stringify(texts),
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).max_tokens).toBe(240);
  });

  it("keeps the six-candidate contract when correcting an invalid batch", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("invalid array"))
      .mockResolvedValueOnce(response('["small pet"]'));
    await expect(generateWithOpenAI({ ...input, count: 6 }, opts)).resolves.toEqual({
      ok: true,
      text: '["small pet"]',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).messages.at(-1).content).toContain("up to 6 distinct");
  });
  it("corrects a malformed batch with the same JSON-array contract", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("not a JSON array"))
      .mockResolvedValueOnce(response('["small pet"]'));
    await expect(generateWithOpenAI({ ...input, count: 3 }, opts)).resolves.toEqual({
      ok: true,
      text: '["small pet"]',
    });
    const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(second.messages.at(-1).content).toContain("JSON array");
  });
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
