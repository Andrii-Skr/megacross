import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replaceDirectory } from "@/lib/replaceDirectory";

describe("template directory replacement", () => {
  let root: string;
  let destination: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "megacross-upload-"));
    destination = path.join(root, "issue");
    await fs.mkdir(destination);
    await fs.writeFile(path.join(destination, "old.fsh"), "original");
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });
  it("preserves the original directory after a partial staged write", async () => {
    await expect(
      replaceDirectory(destination, async (stage) => {
        await fs.writeFile(path.join(stage, "new.fsh"), "partial");
        throw new Error("ENOSPC");
      }),
    ).rejects.toThrow("ENOSPC");
    expect(await fs.readFile(path.join(destination, "old.fsh"), "utf8")).toBe("original");
    expect(await fs.readdir(root)).toEqual(["issue"]);
  });
  it("restores the original directory when publication fails", async () => {
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation(async (source, target) => {
      if (String(source).includes(".upload-") && !String(source).endsWith(".previous") && target === destination) {
        throw new Error("publish failed");
      }
      return rename(source, target);
    });
    await expect(
      replaceDirectory(destination, async (stage) => {
        await fs.writeFile(path.join(stage, "new.fsh"), "new");
      }),
    ).rejects.toThrow("publish failed");
    expect(await fs.readFile(path.join(destination, "old.fsh"), "utf8")).toBe("original");
    expect(await fs.readdir(root)).toEqual(["issue"]);
  });
  it("publishes a complete replacement and cleans the backup", async () => {
    const result = await replaceDirectory(destination, async (stage) => {
      await fs.writeFile(path.join(stage, "new.fsh"), "complete");
      return 1;
    });
    expect(result).toBe(1);
    expect(await fs.readdir(destination)).toEqual(["new.fsh"]);
    expect(await fs.readFile(path.join(destination, "new.fsh"), "utf8")).toBe("complete");
    expect(await fs.readdir(root)).toEqual(["issue"]);
  });
  it("publishes the first upload when no destination exists", async () => {
    const target = path.join(root, "new-issue");
    await replaceDirectory(target, async (stage) => {
      await fs.writeFile(path.join(stage, "new.fsh"), "new");
    });
    expect(await fs.readFile(path.join(target, "new.fsh"), "utf8")).toBe("new");
  });
});
