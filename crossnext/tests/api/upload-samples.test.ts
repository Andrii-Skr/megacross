import { buildFsh, markerFor } from "@megacross/cross-format";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/upload/samples/route";
import { prisma, resetMocks, setAuthed } from "../mocks";

const { mkdir, rm, access, writeFile, findFirst, findUnique } = vi.hoisted(() => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ default: { mkdir, rm, access, writeFile } }));
vi.mock("@/lib/authz", () => ({
  Permissions: { DictionaryWrite: "dictionary:write" },
  hasPermissionAsync: vi.fn().mockResolvedValue(true),
}));

const validBytes = buildFsh({ rows: 1, cols: 3, marker: markerFor(1, 3), data: ["→**"], codes: [[0x18, 1, 1]] });
const uncoveredBytes = buildFsh({
  rows: 3,
  cols: 3,
  marker: markerFor(3, 3),
  data: ["*##", "→**", "*##"],
  codes: [
    [1, 2, 2],
    [0x18, 1, 1],
    [1, 2, 2],
  ],
});

async function upload(contents: Uint8Array[] = [validBytes]) {
  const form = new FormData();
  form.append("issueId", "74");
  for (const [index, bytes] of contents.entries()) {
    const file = new File([Uint8Array.from(bytes)], index === 0 ? "new.fsh" : `new-${index}.fsh`);
    Object.defineProperty(file, "arrayBuffer", { value: async () => Uint8Array.from(bytes).buffer });
    form.append("files", file);
  }
  return POST({ formData: async () => form } as Request);
}

describe("/api/upload/samples job protection", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    vi.stubEnv("CROSS_SAMPLES_DIR", "/tmp/samples");
    mkdir.mockReset().mockResolvedValue(undefined);
    rm.mockReset().mockResolvedValue(undefined);
    access.mockReset().mockRejectedValue(new Error("not found"));
    writeFile.mockReset().mockResolvedValue(undefined);
    findUnique.mockReset().mockResolvedValue({ edition: { code: "EDITION_6" }, issueNumber: { label: "26-38" } });
    findFirst.mockReset();
    Object.assign(prisma.issue, { findUnique });
    Object.assign(prisma, { scanwordFillJob: { findFirst } });
  });

  it("allows replacement after a completed job despite older reviews", async () => {
    const history = [
      { id: 119n, status: "done" },
      { id: 118n, status: "review" },
    ];
    findFirst.mockImplementation(async (query) => {
      if (query.where.status) {
        return history.find((row) => query.where.status.in.includes(row.status)) ?? null;
      }
      expect(query.orderBy).toEqual({ id: "desc" });
      return history[0];
    });

    const response = await upload();

    expect(response.status).toBe(200);
    expect((await response.json()).saved).toEqual([{ name: "new.fsh", size: validBytes.length }]);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("rejects uncovered cells with coordinates before replacing any files in the batch", async () => {
    const response = await upload([validBytes, uncoveredBytes]);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: "UPLOAD_UNCOVERED_CELLS",
      fileName: "new-1.fsh",
      cells: [
        { row: 1, column: 1 },
        { row: 3, column: 1 },
      ],
    });
    expect(rm).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects malformed files before replacing templates", async () => {
    const response = await upload([new Uint8Array([1, 2])]);

    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe("UPLOAD_INVALID_TEMPLATE");
    expect(rm).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("preserves templates while the current review is pending", async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: "review" });

    const response = await upload();

    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("UPLOAD_REVIEW_PENDING");
    expect(rm).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each(["queued", "running"])("preserves templates for a %s job", async (status) => {
    findFirst.mockResolvedValueOnce({ id: 120n, status });

    const response = await upload();

    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("UPLOAD_FILL_RUNNING");
    expect(findFirst).toHaveBeenCalledOnce();
    expect(rm).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
