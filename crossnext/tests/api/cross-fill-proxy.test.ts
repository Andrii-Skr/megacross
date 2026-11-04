import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cross/[...path]/route";
import { resetMocks, setAuthed } from "../mocks";
import { makeReq } from "./_utils";

const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

describe("authenticated fill proxy", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "12", role: "EDITOR" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([null, { id: "13", role: "USER" }])("blocks users without fill access (%j)", async (user) => {
    setAuthed(user);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(
      makeReq("GET", "http://localhost/api/cross/api/fill/latest"),
      context("api/fill/latest"),
    );
    expect(response.status).toBe(user ? 403 : 401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose admin generator endpoints or direct finalization", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const path of ["api/template-generator/jobs", "api/fill/1/finalize", "api/fill/1/../finalize"]) {
      const response = await POST(makeReq("POST", "http://localhost/api/cross/test", {}), context(path));
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds a scoped server credential and forwards start payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"1"}', { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const body = { issueId: "5" };
    const response = await POST(
      makeReq("POST", "http://localhost/api/cross/api/fill/start", body),
      context("api/fill/start"),
    );
    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual(body);
    const secret = process.env.CROSS_API_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
    const token = createHmac("sha256", secret).update("megacross:cross-api:v1").digest("hex");
    expect(init.headers.get("authorization")).toBe(`Bearer ${token}`);
  });

  it.each(["stream", "archive"])("streams %s bodies and preserves download/event headers", async (kind) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("payload", {
        headers: {
          "content-type": kind === "stream" ? "text/event-stream" : "application/zip",
          "content-disposition": 'attachment; filename="issue.zip"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(
      makeReq("GET", `http://localhost/api/cross/api/fill/1/${kind}?file=issue.zip`),
      context(`api/fill/1/${kind}`),
    );
    expect(await response.text()).toBe("payload");
    expect(response.headers.get("content-disposition")).toContain("issue.zip");
    expect(fetchMock.mock.calls[0][0]).toContain(`/${kind}?file=issue.zip`);
    if (kind === "stream") expect(response.headers.get("cache-control")).toContain("no-transform");
  });
});
