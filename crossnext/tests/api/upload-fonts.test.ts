import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/upload/fonts/route";
import { prisma, resetMocks, setAuthed } from "../mocks";

const { mkdir, access, writeFile } = vi.hoisted(() => ({
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ default: { mkdir, access, writeFile } }));
vi.mock("@/lib/authz", () => ({
  Permissions: { AdminAccess: "admin:access" },
  hasPermissionAsync: vi.fn().mockResolvedValue(true),
}));

describe("/api/upload/fonts", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    mkdir.mockReset().mockResolvedValue(undefined);
    access.mockReset().mockRejectedValue(new Error("not found"));
    writeFile.mockReset().mockResolvedValue(undefined);
  });

  it("sets updatedAt when inserting a new TTF font", async () => {
    const queryRaw = vi.fn().mockImplementation(async (query: Prisma.Sql) => {
      const sql = query.strings.join("?");
      if (!sql.includes('"createdBy", "updatedAt"') || !sql.includes("?, NOW())")) {
        throw new Error('null value in column "updatedAt" violates not-null constraint');
      }
      const now = new Date("2026-09-30T10:00:00.000Z");
      return [
        {
          id: 1n,
          displayName: "PinyonScript-Regular",
          familyName: "PinyonScript-Regular",
          format: "ttf",
          mimeType: "font/ttf",
          fileName: "PinyonScript-Regular.ttf",
          sha256: "hash",
          sizeBytes: 4n,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
    Object.assign(prisma, { $queryRaw: queryRaw });

    const file = new File([new Uint8Array([0, 1, 0, 0])], "PinyonScript-Regular.ttf", { type: "font/ttf" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array([0, 1, 0, 0]).buffer });
    const form = new FormData();
    form.append("file", file);

    const response = await POST({ formData: async () => form } as Request);

    expect(response.status).toBe(200);
    expect((await response.json()).font.fileName).toBe("PinyonScript-Regular.ttf");
    expect(queryRaw).toHaveBeenCalledOnce();
  });
});
