import { normalizeGeneratedDefinition } from "@/lib/ai/prompts";
import type { GenerateInput, ProviderResult } from "@/lib/ai/types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const deepGet = (obj: unknown, path: Array<string | number>): unknown => {
  let cur: unknown = obj;
  for (const key of path) {
    if (Array.isArray(cur) && typeof key === "number") cur = cur[key];
    else if (isObject(cur) && typeof key === "string") cur = cur[key];
    else return undefined;
  }
  return cur;
};

export async function generateWithOpenAI(
  input: GenerateInput,
  opts: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    extraHeaders?: Record<string, string>;
    systemText: string;
    userText: string;
    path?: string; // default /v1/chat/completions
    authHeader?: string; // default Authorization
    authScheme?: string | null; // default Bearer (null/empty => no scheme)
    timeoutMs?: number;
  },
): Promise<ProviderResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.extraHeaders || {}),
  };
  if (opts.apiKey) {
    const h = opts.authHeader || "Authorization";
    const s = opts.authScheme ?? "Bearer";
    headers[h] = `${s ? `${s} ` : ""}${opts.apiKey}`;
  }

  const path = opts.path || "/v1/chat/completions";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1000, opts.timeoutMs ?? 20000));
  const messages = [
    { role: "system", content: opts.systemText },
    { role: "user", content: opts.userText },
  ];
  try {
    // One bounded correction for invalid output; HTTP errors are not retried.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: 0.3,
          max_tokens: Math.max(128, Math.min(1024, Math.ceil(input.maxLength * 2))),
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        return {
          ok: false,
          message: (await res.text().catch(() => "")) || `Upstream error ${res.status}`,
          status: res.status === 429 ? 429 : 502,
        };
      }
      const data: unknown = await res.json();
      const content = deepGet(data, ["choices", 0, "message", "content"]);
      const text = typeof content === "string" ? content : "";
      const cleaned = normalizeGeneratedDefinition(
        text,
        input.word,
        [...input.existing, ...(input.avoid ?? [])],
        input.maxLength,
      );
      if (cleaned && deepGet(data, ["choices", 0, "finish_reason"]) !== "length") return { ok: true, text: cleaned };
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `The previous clue failed validation (length: ${text.trim().length}; maximum: ${input.maxLength} characters including spaces). Rewrite it as a substantially shorter, complete clue in the requested language. Preserve the correct meaning, avoid the answer and exact existing clues. Return only the clue. Do not explain or truncate.`,
      });
    }
    return { ok: false, message: "AI returned invalid content", status: 502 };
  } catch {
    const timedOut = ac.signal.aborted;
    return {
      ok: false,
      message: timedOut ? "OpenAI request timed out" : "OpenAI request failed",
      status: timedOut ? 504 : 502,
    };
  } finally {
    // Keep the timeout active through body reading and both attempts.
    clearTimeout(timer);
  }
}
