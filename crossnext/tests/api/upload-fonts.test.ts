import { readFileSync } from "node:fs";
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

    const bytes = readFileSync(`${process.cwd()}/../cross/server/assets/fonts/Arimo-Regular.ttf`);
    const file = new File([Uint8Array.from(bytes)], "PinyonScript-Regular.ttf", { type: "font/ttf" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => Uint8Array.from(bytes).buffer });
    const form = new FormData();
    form.append("file", file);

    const response = await POST({ formData: async () => form } as Request);

    expect(response.status).toBe(200);
    expect((await response.json()).font.fileName).toBe("PinyonScript-Regular.ttf");
    expect(queryRaw).toHaveBeenCalledOnce();
  });
  it.each(["woff", "woff2"])("rejects %s before writing a file or updating the library", async (format) => {
    const queryRaw = vi.fn();
    Object.assign(prisma, { $queryRaw: queryRaw });
    const file = new File([new Uint8Array([1, 2, 3])], `font.${format}`, { type: `font/${format}` });
    const form = new FormData();
    form.set("file", file);
    const response = await POST({ formData: async () => form } as Request);
    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe("UPLOAD_UNSUPPORTED_FORMAT");
    expect(writeFile).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    [0, 1, 0, 0],
    [0x77, 0x4f, 0x46, 0x32],
  ])("rejects malformed or renamed web fonts with header %j", async (...header) => {
    const queryRaw = vi.fn();
    Object.assign(prisma, { $queryRaw: queryRaw });
    const bytes = new Uint8Array(header);
    const file = new File([bytes], "broken.ttf", { type: "font/ttf" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
    const form = new FormData();
    form.set("file", file);
    const response = await POST({ formData: async () => form } as Request);
    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe("UPLOAD_INVALID_FONT");
    expect(writeFile).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
