import {
  InvalidStorageNameError,
  resolveIssueStorageDirectory,
  resolveStorageChild,
  sanitizeStorageName,
} from "@megacross/cross-format/storage-paths";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSamplesDirForIssue } from "../../../cross/server/src/services/fillJobTemplateService";

describe("shared scanword storage paths", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["", ".", "..", "/", "   ", "folder/.."])("rejects unsafe component %j", (name) => {
    expect(() => sanitizeStorageName(name)).toThrow(InvalidStorageNameError);
    expect(() => resolveStorageChild("/tmp/samples", "EDITION", name)).toThrow(InvalidStorageNameError);
    vi.stubEnv("CROSS_SAMPLES_DIR", "/tmp/samples");
    expect(() => getSamplesDirForIssue({ editionCode: "EDITION", issueLabel: name })).toThrow(InvalidStorageNameError);
  });

  it("preserves existing Unicode names and ordinary edition/issue paths", () => {
    expect(sanitizeStorageName("folder/Выпуск 26-38.fsh")).toBe("Выпуск 26-38.fsh");
    expect(resolveStorageChild("/tmp/samples", "EDITION_6", "26-38")).toBe("/tmp/samples/EDITION_6/26-38");
  });
  it("gives colliding labels separate paths and preserves canonical legacy paths", () => {
    const root = "/tmp/samples";
    const labels = ["1/2026", "2/2026", "2026", "A?B", "A*B", "A_B", "A__B", " A_B", "A  B"];
    const paths = labels.map((label) => resolveIssueStorageDirectory(root, "EDITION", label));
    expect(new Set(paths).size).toBe(labels.length);
    expect(resolveIssueStorageDirectory(root, "EDITION", "42 2026")).toBe("/tmp/samples/EDITION/42 2026");
    for (const [index, label] of labels.entries()) {
      vi.stubEnv("CROSS_SAMPLES_DIR", root);
      expect(getSamplesDirForIssue({ editionCode: "EDITION", issueLabel: label })).toBe(paths[index]);
    }
  });
});
