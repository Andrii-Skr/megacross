vi.mock("@/auth", () => ({ authOptions: {} as unknown }));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/template-generator/jobs/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

const requestBody = {
  rows: 23,
  cols: 31,
  resultCount: 3,
  dictionaryFilterId: null,
  pictures: { mode: "auto", count: 1 },
  cutoutPresetId: "corner",
  seed: "api-test",
};

describe("/api/template-generator/jobs", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "12", role: "ADMIN" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires AdminAccess", async () => {
    setAuthed({ id: "13", role: "USER" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      makeReq("POST", "http://localhost/api/template-generator/jobs", requestBody),
      makeCtx({}),
    );
    const { status } = await readJson(response);
    expect(status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores the current user's latest job without trusting a browser-stored ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "91", status: "running", acceptedCount: 2 }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(makeReq("GET", "http://localhost/api/template-generator/jobs"), makeCtx({}));
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe("91");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/template-generator/jobs?userId=12");
  });

  it("reads the active job from the shared database while cross is running older code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Cannot GET", { status: 404 })));
    const now = new Date("2026-09-15T23:00:00.000Z");
    prisma.scanwordTemplateGenerationJob.findFirst
      .mockResolvedValueOnce({
        id: 5n,
        rngPosition: 123n,
        status: "running",
        acceptedCount: 3,
        createdAt: now,
        updatedAt: now,
        expiresAt: now,
      })
      .mockResolvedValueOnce(null);
    const response = await GET(makeReq("GET", "http://localhost/api/template-generator/jobs"), makeCtx({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "5", status: "running", acceptedCount: 3 });
    expect(prisma.scanwordTemplateGenerationJob.findFirst).toHaveBeenCalledTimes(2);
  });

  it("does not expose job lookup to non-admin users", async () => {
    setAuthed({ id: "13", role: "USER" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(makeReq("GET", "http://localhost/api/template-generator/jobs"), makeCtx({}));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates and proxies the request with the numeric user id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "91", status: "queued" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      makeReq("POST", "http://localhost/api/template-generator/jobs", requestBody),
      makeCtx({}),
    );
    expect(response.status).toBe(202);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ ...requestBody, userId: 12 });
  });

  it("rejects impossible dimensions before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      makeReq("POST", "http://localhost/api/template-generator/jobs", { ...requestBody, rows: 4 }),
      makeCtx({}),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
