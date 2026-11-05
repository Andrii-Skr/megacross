vi.mock("@/auth", () => ({ authOptions: {} as unknown }));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/ai/generate-definition/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

const ENV_KEYS = [
  "AI_PROVIDER",
  "AI_MODEL",
  "AI_API_KEY",
  "AI_REQUIRE_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_API_KEY",
  "NVIDIA_API_KEY",
  "NVIDIA_MODEL",
  "NVIDIA_BASE_URL",
  "NVIDIA_PATH",
  "NVIDIA_AUTH_HEADER",
  "NVIDIA_AUTH_SCHEME",
] as const;

describe("/api/ai/generate-definition (POST)", () => {
  const envSnapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "u-ai", role: "ADMIN" });
    for (const key of ENV_KEYS) envSnapshot[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = envSnapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it.each([
    "openai",
    "anthropic",
    "gemini",
    "nvidia",
  ])("reports an explicit empty batch from %s as no new definitions", async (provider) => {
    process.env.AI_PROVIDER = provider;
    process.env.AI_API_KEY = "test-key";
    const upstream =
      provider === "anthropic"
        ? { content: [{ text: "[]" }] }
        : provider === "gemini"
          ? { candidates: [{ content: { parts: [{ text: "[]" }] } }] }
          : { choices: [{ message: { content: "[]" }, finish_reason: "stop" }] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(upstream)));
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "аав",
        count: 3,
        language: "ru",
        existing: ["опера «Викинги», композитор"],
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false, errorCode: "AI_NO_NEW_DEFINITIONS" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    "openai",
    "anthropic",
    "gemini",
    "nvidia",
  ])("returns batch suggestions through %s with one provider request", async (provider) => {
    process.env.AI_PROVIDER = provider;
    process.env.AI_API_KEY = "test-key";
    const text = JSON.stringify(["домашний хищник", "усатый питомец", "ночной охотник"]);
    const upstream =
      provider === "anthropic"
        ? { content: [{ text }] }
        : provider === "gemini"
          ? { candidates: [{ content: { parts: [{ text }] } }] }
          : { choices: [{ message: { content: text } }] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(upstream)));
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        count: 3,
        language: "ru",
        maxLength: 60,
      }),
      makeCtx({}),
    );
    const { status, json } = await readJson<{ text: string; texts: string[] }>(res);
    expect(status).toBe(200);
    expect(json.texts).toEqual(JSON.parse(text));
    expect(json.text).toBe(json.texts[0]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("JSON array");
  });

  it("returns available valid variants without duplicates", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    const text = JSON.stringify(["старое определение", "новая формулировка", "Новая формулировка."]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: text } }] })),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        count: 3,
        existing: ["старое определение"],
        maxLength: 60,
      }),
      makeCtx({}),
    );
    expect(await res.json()).toEqual({ success: true, text: "новая формулировка", texts: ["новая формулировка"] });
  });

  it.each([
    "openai",
    "anthropic",
    "gemini",
    "nvidia",
  ])("keeps candidates beyond the first three through %s and filters before limiting the response", async (provider) => {
    process.env.AI_PROVIDER = provider;
    process.env.AI_API_KEY = "test-key";
    const candidates = [
      "хищник домашний",
      "домашний хищник",
      "ещё один домашний хищник",
      "усатый питомец",
      "ночной охотник",
      "ловец мышей",
    ];
    const text = JSON.stringify(candidates);
    const upstream =
      provider === "anthropic"
        ? { content: [{ text }] }
        : provider === "gemini"
          ? { candidates: [{ content: { parts: [{ text }] } }] }
          : { choices: [{ message: { content: text }, finish_reason: "stop" }] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(upstream)));
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        language: "ru",
        count: 3,
        maxLength: 60,
        existing: ["домашний хищник"],
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      text: "усатый питомец",
      texts: ["усатый питомец", "ночной охотник", "ловец мышей"],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const userContext =
      provider === "anthropic"
        ? requestBody.messages[0].content[0].text.split("\n\n").at(-1)
        : provider === "gemini"
          ? requestBody.contents[0].parts[0].text
          : requestBody.messages[1].content;
    expect(JSON.parse(userContext).count).toBe(6);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("up to six");
  });

  it("returns at most three definitions from six acceptable candidates", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "test-key";
    const candidates = [
      "усатый питомец",
      "ночной охотник",
      "ловец мышей",
      "домашний хищник",
      "мурлыкающий компаньон",
      "любитель молока",
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(candidates) }, finish_reason: "stop" }],
        }),
      ),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        language: "ru",
        count: 3,
      }),
      makeCtx({}),
    );
    expect(await res.json()).toEqual({ success: true, text: candidates[0], texts: candidates.slice(0, 3) });
  });

  it("filters the reordered opera clue from the reported screenshot before returning suggestions", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    const duplicate = "композитор оперы «Викинги»";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify([duplicate, "эстонский хоровой дирижёр"]) } }],
        }),
      ),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "аав",
        language: "ru",
        count: 3,
        existing: ["опера «Викинги», композитор"],
      }),
      makeCtx({}),
    );
    expect(await res.json()).toEqual({
      success: true,
      text: "эстонский хоровой дирижёр",
      texts: ["эстонский хоровой дирижёр"],
    });
  });

  it("never returns a near duplicate to clients requesting a single definition", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "композитор оперы «Викинги»" } }],
        }),
      ),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "аав",
        language: "ru",
        existing: ["опера «Викинги», композитор"],
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false, errorCode: "AI_NO_UNIQUE_DEFINITIONS" });
  });

  it("loads dictionary definitions by word id even when the client sends an incomplete context", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    prisma.word_v.findFirst.mockResolvedValue({ opred_v: [{ text_opr: "опера «Викинги», композитор" }] });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify(["композитор оперы «Викинги»", "эстонский хоровой дирижёр"]) } },
          ],
        }),
      ),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "аав",
        wordId: "42",
        language: "ru",
        count: 3,
        existing: [],
      }),
      makeCtx({}),
    );
    expect(await res.json()).toMatchObject({ texts: ["эстонский хоровой дирижёр"] });
    expect(prisma.word_v.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42n, is_deleted: false, language: { code: "ru" } },
        select: {
          opred_v: expect.objectContaining({
            where: expect.objectContaining({ is_deleted: false, language: { code: "ru" }, OR: expect.any(Array) }),
          }),
        },
      }),
    );
    const upstream = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(JSON.parse(upstream.messages[1].content).existing).toContain("опера «Викинги», композитор");
  });

  it("rejects an unavailable word before calling AI", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    prisma.word_v.findFirst.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "аав",
        wordId: "42",
        language: "ru",
        count: 3,
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters near duplicates between candidates and rejected variants on the server", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(["хищник домашний", "усатый питомец", "питомец усатый"]) } }],
        }),
      ),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        language: "ru",
        count: 3,
        avoid: ["домашний хищник"],
      }),
      makeCtx({}),
    );
    expect(await res.json()).toEqual({ success: true, text: "усатый питомец", texts: ["усатый питомец"] });
  });

  it("rejects a batch with no valid variants", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] })),
    );
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "кот",
        count: 3,
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(502);
  });

  it.each([0, 2, 4, "3"])("rejects unsupported count %s", async (count) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", { word: "кот", count }),
      makeCtx({}),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses OpenAI as default provider and sends expected request payload", async () => {
    delete process.env.AI_PROVIDER;
    process.env.AI_REQUIRE_API_KEY = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_MODEL;
    delete process.env.AI_MODEL;
    delete process.env.NVIDIA_MODEL;

    const fetchMock = vi
      .spyOn(global, "fetch" as never)
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "краткое определение" } }] }), { status: 200 }),
      );

    const req = makeReq("POST", "http://localhost/api/ai/generate-definition", {
      word: "слово",
      language: "ru",
      existing: [],
      maxLength: 48,
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ success: boolean; text: string }>(res);

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.text).toBe("краткое определение");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");

    const body = JSON.parse(String(init.body)) as {
      model: string;
      stream: boolean;
      temperature: number;
      top_p: number;
    };
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.temperature).toBe(0.3);
  });

  it("passes dictionary definitions and rejected variants as separate context", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "овощ с острым вкусом" } }] })));
    const res = await POST(
      makeReq("POST", "http://localhost/api/ai/generate-definition", {
        word: "лук",
        language: "ru",
        existing: ["репчатый овощ", "оружие с тетивой"],
        avoid: ["растение для стрельбы"],
        maxLength: 60,
      }),
      makeCtx({}),
    );
    expect(res.status).toBe(200);
    const upstream = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const context = JSON.parse(upstream.messages[1].content);
    expect(context.word).toBe("лук");
    expect(context.existing).toEqual(["репчатый овощ", "оружие с тетивой"]);
    expect(context.avoid).toEqual(["растение для стрельбы"]);
    expect(context.existing).not.toContain("растение для стрельбы");
  });

  it("returns 400 for NVIDIA when API key is missing", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.AI_REQUIRE_API_KEY = "true";
    delete process.env.NVIDIA_API_KEY;
    delete process.env.AI_API_KEY;

    const fetchMock = vi
      .spyOn(global, "fetch" as never)
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "noop" } }] }), { status: 200 }),
      );

    const req = makeReq("POST", "http://localhost/api/ai/generate-definition", {
      word: "слово",
      language: "ru",
      existing: [],
      maxLength: 40,
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ success: boolean; message: string }>(res);

    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe("AI provider is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers OPENAI_MODEL over AI_MODEL when provider=openai", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_REQUIRE_API_KEY = "true";
    process.env.AI_API_KEY = "sk-test";
    process.env.AI_MODEL = "google/gemma-3n-e4b-it";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const fetchMock = vi
      .spyOn(global, "fetch" as never)
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "openai answer" } }] }), { status: 200 }),
      );

    const req = makeReq("POST", "http://localhost/api/ai/generate-definition", {
      word: "river",
      language: "en",
      existing: [],
      maxLength: 60,
    });
    const res = await POST(req, makeCtx({}));
    const { status, json } = await readJson<{ success: boolean; text: string }>(res);

    expect(status).toBe(200);
    expect(json.success).toBe(true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("gpt-4o-mini");
  });
});
