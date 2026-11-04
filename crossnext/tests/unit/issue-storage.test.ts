import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveIssueStorageDirectory } from "@megacross/cross-format/storage-paths";
import { expect, it } from "vitest";
import { replaceDirectory } from "@/lib/replaceDirectory";

it("preserves both issues when uploading labels that previously shared a directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "megacross-issue-storage-"));
  try {
    const first = resolveIssueStorageDirectory(root, "EDITION", "1/2026");
    const second = resolveIssueStorageDirectory(root, "EDITION", "2/2026");
    await replaceDirectory(first, (stage) => writeFile(path.join(stage, "template.fsh"), "first"));
    await replaceDirectory(second, (stage) => writeFile(path.join(stage, "template.fsh"), "second"));
    expect(await readFile(path.join(first, "template.fsh"), "utf8")).toBe("first");
    expect(await readFile(path.join(second, "template.fsh"), "utf8")).toBe("second");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
