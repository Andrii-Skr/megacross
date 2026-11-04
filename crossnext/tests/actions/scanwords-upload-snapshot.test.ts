import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getScanwordUploadSnapshotAction } from "@/app/actions/scanwords";
import { buildFsh } from "@/utils/cross/parseFsh";
import { setAuthed } from "../mocks";

const { findUnique, upsert, findIssue } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  findIssue: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { scanwordUploadSnapshot: { findUnique, upsert }, issue: { findUnique: findIssue } },
}));
vi.mock("@/lib/authz", () => ({
  Permissions: { AdminAccess: "admin:access" },
  requirePermissionAsync: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));

describe("legacy scanword upload snapshots", () => {
  let root: string;
  let directory: string;
  const bytes = buildFsh({
    rows: 2,
    cols: 2,
    data: ["**", "**"],
    codes: [
      [0, 0],
      [0, 0],
    ],
    marker: "",
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    root = await mkdtemp(path.join(os.tmpdir(), "scanword-snapshot-"));
    vi.stubEnv("CROSS_SAMPLES_DIR", root);
    directory = path.join(root, "edition", "old-issue");
    await mkdir(directory, { recursive: true });
    findIssue.mockResolvedValue({ edition: { code: "edition" }, issueNumber: { label: "old-issue" } });
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({ id: 1 });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("restores files and word counts for both the UI and the fill service", async () => {
    await writeFile(path.join(directory, "10.fsh"), bytes);
    await writeFile(path.join(directory, "2.fsh"), bytes);
    await writeFile(path.join(directory, "archive.zip"), "ignored");
    const snapshot = await getScanwordUploadSnapshotAction({ issueId: "42" });
    expect(snapshot?.files.map((file) => file.name)).toEqual(["2.fsh", "10.fsh"]);
    expect(snapshot).toMatchObject({ fileCount: 2, errorCount: 0, neededStats: { "2": 8, total: 8 } });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issueId: 42n },
        create: expect.objectContaining({ fileCount: 2, files: snapshot?.files }),
      }),
    );
  });

  it("preserves setup when recovering an empty snapshot", async () => {
    const templateSetup = {
      version: 1,
      templates: [{ templateKey: `2.fsh:${bytes.length}`, keyword: "TEST", fixedSlots: [] }],
    };
    findUnique.mockResolvedValue({ fileCount: 0, files: [], templateId: 7, templateName: "filter", templateSetup });
    await writeFile(path.join(directory, "2.fsh"), bytes);
    const snapshot = await getScanwordUploadSnapshotAction({ issueId: "42" });
    expect(snapshot).toMatchObject({ templateId: 7, templateName: "filter", templateSetup });
    expect(upsert.mock.calls[0][0].update.templateSetup).toEqual(templateSetup);
  });

  it("reports invalid templates so generation remains blocked", async () => {
    await writeFile(path.join(directory, "broken.fsh"), "invalid");
    const snapshot = await getScanwordUploadSnapshotAction({ issueId: "42" });
    expect(snapshot).toMatchObject({ fileCount: 1, errorCount: 1 });
    expect(snapshot?.errors[0]).toMatchObject({ name: "broken.fsh" });
  });

  it("does not enable generation when the issue directory is missing", async () => {
    await rm(directory, { recursive: true });
    expect(await getScanwordUploadSnapshotAction({ issueId: "42" })).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps snapshots older than 30 days without filesystem access", async () => {
    findUnique.mockResolvedValue({
      templateId: 7,
      templateName: "filter",
      fileCount: 1,
      errorCount: 0,
      files: [{ key: "old.fsh:12", name: "old.fsh", size: 12 }],
      errors: [],
      neededStats: { total: 1 },
      templateSetup: null,
      updatedAt: new Date("2020-01-01"),
    });
    expect(await getScanwordUploadSnapshotAction({ issueId: "42" })).toMatchObject({ fileCount: 1 });
    expect(findIssue).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
