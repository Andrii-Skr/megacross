vi.mock("@/auth", () => ({ authOptions: {} as unknown }));

import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "../../app/api/dictionary/def/[id]/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

describe("/api/dictionary/def/[id] (PUT)", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "u1", role: "ADMIN" });
  });

  it("creates pending edit card for definition and returns pending id", async () => {
    const expiry = new Date("2027-01-01T00:00:00Z");
    prisma.opred_v.findUnique.mockResolvedValueOnce({
      id: BigInt(777),
      word_id: BigInt(5),
      difficulty: 1,
      end_date: expiry,
      langId: 3,
      word_v: { id: BigInt(5), word_text: "w", length: 1 },
    });
    prisma.pendingWords.findFirst.mockResolvedValueOnce(null);
    prisma.pendingWords.create.mockResolvedValueOnce({ id: BigInt(66) });
    const req = makeReq("PUT", "http://localhost/api/dictionary/def/777", { text_opr: "def" });
    const res = await PUT(req, makeCtx({ id: "777" }));
    const { status, json } = await readJson<{ success: boolean; id: string }>(res);
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe("66");
    const createArgs = prisma.pendingWords.create.mock.calls[0]?.[0] as
      | {
          data?: {
            id?: unknown;
            descriptions?: { create?: Array<{ id?: unknown; end_date?: Date }> };
          };
        }
      | undefined;
    expect(createArgs?.data?.id).toBeUndefined();
    expect(createArgs?.data?.descriptions?.create?.[0]?.id).toBeUndefined();
    expect(createArgs?.data?.descriptions?.create?.[0]?.end_date).toEqual(expiry);
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
      makeReq("PUT", "http://localhost/api/dictionary/def/1", { text_opr: " \t\n " }),
      makeCtx({ id: "1" }),
    );
    expect(response.status).toBe(400);
    expect(prisma.pendingWords.create).not.toHaveBeenCalled();
  });

  it("returns 404 if definition not found", async () => {
    prisma.opred_v.findUnique.mockResolvedValueOnce(null);
    const req = makeReq("PUT", "http://localhost/api/dictionary/def/1", { text_opr: "def" });
    const res = await PUT(req, makeCtx({ id: "1" }));
    const { status, json } = await readJson<{ success: boolean; message: string }>(res);
    expect(status).toBe(404);
    expect(json.message).toContain("Definition not found");
  });
});
