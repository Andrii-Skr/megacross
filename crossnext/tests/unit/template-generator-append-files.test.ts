import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendTemplateFiles } from "../../../cross/server/src/templateGenerator/appendFiles";

let directory: string;
const file = { stem: "generated_1_1", bytes: Buffer.from("template") };
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "megacross-append-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const persist = async (written: string[]) => written;

describe("appending template files", () => {
  it("reuses identical files on repeated requests instead of adding suffixed duplicates", async () => {
    expect(await appendTemplateFiles(directory, [file], persist)).toEqual(["generated_1_1.fsh"]);
    expect(await appendTemplateFiles(directory, [file], persist)).toEqual([]);
    expect(await readdir(directory)).toEqual(["generated_1_1.fsh"]);
  });
  it("rolls back only new files on persistence failure and allows a clean retry", async () => {
    await writeFile(path.join(directory, "existing.fsh"), "keep");
    await expect(
      appendTemplateFiles(directory, [file], async () => {
        throw new Error("snapshot unavailable");
      }),
    ).rejects.toThrow("snapshot unavailable");
    expect(await readdir(directory)).toEqual(["existing.fsh"]);
    expect(await appendTemplateFiles(directory, [file], persist)).toEqual(["generated_1_1.fsh"]);
    expect(await readFile(path.join(directory, "existing.fsh"), "utf8")).toBe("keep");
  });
  it("cleans the first file and staging directory if publishing the next file fails", async () => {
    const save = vi.fn();
    await expect(
      appendTemplateFiles(directory, [file, { ...file, stem: "x".repeat(300) }], save),
    ).rejects.toMatchObject({ code: "ENAMETOOLONG" });
    expect(save).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
  });
  it("preserves a conflicting file, reuses an identical legacy suffix, and keeps it on failure", async () => {
    await writeFile(path.join(directory, "generated_1_1.fsh"), "different");
    expect(await appendTemplateFiles(directory, [file], persist)).toEqual(["generated_1_1_2.fsh"]);
    await expect(
      appendTemplateFiles(directory, [file], async () => {
        throw new Error("snapshot unavailable");
      }),
    ).rejects.toThrow("snapshot unavailable");
    expect((await readdir(directory)).sort()).toEqual(["generated_1_1.fsh", "generated_1_1_2.fsh"]);
    expect(await readFile(path.join(directory, "generated_1_1.fsh"), "utf8")).toBe("different");
  });
  it("serializes concurrent appends through persistence so snapshots include both batches", async () => {
    let resume!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = appendTemplateFiles(directory, [file], async () => {
      entered();
      await gate;
    });
    await started;
    const saveSecond = vi.fn(async () => (await readdir(directory)).filter((name) => name.endsWith(".fsh")).sort());
    const second = appendTemplateFiles(directory, [{ ...file, stem: "generated_2_1" }], saveSecond);
    expect(saveSecond).not.toHaveBeenCalled();
    resume();
    await first;
    expect(await second).toEqual(["generated_1_1.fsh", "generated_2_1.fsh"]);
  });
  it("creates a missing issue directory", async () => {
    const nested = path.join(directory, "edition", "42");
    expect(await appendTemplateFiles(nested, [file], persist)).toEqual(["generated_1_1.fsh"]);
    expect(await readdir(nested)).toEqual(["generated_1_1.fsh"]);
  });
});
