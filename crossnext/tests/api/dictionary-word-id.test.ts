vi.mock("@/auth", () => ({ authOptions: {} as unknown }));

import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "../../app/api/dictionary/word/[id]/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

describe("/api/dictionary/word/[id] (PUT)", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "u1", role: "ADMIN" });
  });

  it("creates pending rename card and returns pending id", async () => {
    prisma.word_v.findUnique.mockResolvedValueOnce({ id: BigInt(123), langId: 3 });
    prisma.pendingWords.findFirst.mockResolvedValueOnce(null);
    prisma.pendingWords.create.mockResolvedValueOnce({ id: BigInt(55) });
    const req = makeReq("PUT", "http://localhost/api/dictionary/word/123", { word_text: "abc" });
    const res = await PUT(req, makeCtx({ id: "123" }));
    const { status, json } = await readJson<{ success: boolean; id: string }>(res);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe("55");
  });

  it.each([true, false, undefined])("queues imageability %s without changing the live word", async (isImageable) => {
    prisma.word_v.findUnique.mockResolvedValueOnce({ id: 123n, langId: 3 });
    prisma.pendingWords.findFirst.mockResolvedValueOnce(null);
    prisma.pendingWords.create.mockResolvedValueOnce({ id: 55n });
    const res = await PUT(
      makeReq("PUT", "http://localhost/api/dictionary/word/123", { word_text: "кактус", isImageable }),
      makeCtx({ id: "123" }),
    );
    expect(res.status).toBe(200);
    const note = JSON.parse(prisma.pendingWords.create.mock.calls[0][0].data.note);
    expect(note.isImageable).toBe(isImageable);
    expect(Object.hasOwn(note, "isImageable")).toBe(isImageable !== undefined);
    expect(prisma.word_v.update).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only edits before creating a moderation card", async () => {
    prisma.word_v.findUnique.mockResolvedValue({ id: 1n, langId: 3 });
    prisma.opred_v.findUnique.mockResolvedValue({
      id: 1n,
      word_id: 1n,
      langId: 3,
      difficulty: 1,
      word_v: { id: 1n, word_text: "word", length: 4 },
    });
    prisma.pendingWords.create.mockResolvedValue({ id: 55n });
    const response = await PUT(
      makeReq("PUT", "http://localhost/api/dictionary/word/1", { word_text: " \t\n " }),
      makeCtx({ id: "1" }),
    );
    expect(response.status).toBe(400);
    expect(prisma.pendingWords.create).not.toHaveBeenCalled();
  });

  it("returns 404 if base word not found", async () => {
    prisma.word_v.findUnique.mockResolvedValueOnce(null);
    const req = makeReq("PUT", "http://localhost/api/dictionary/word/1", { word_text: "abc" });
    const res = await PUT(req, makeCtx({ id: "1" }));
    const { status, json } = await readJson<{ success: boolean; message: string }>(res);
    expect(status).toBe(404);
    expect(json.message).toContain("Word not found");
  });
});
