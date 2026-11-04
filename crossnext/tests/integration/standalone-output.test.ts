import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe.skipIf(process.env.MEGACROSS_CHECK_STANDALONE !== "1")("production standalone artifacts", () => {
  const root = path.join(process.cwd(), ".next", "standalone");
  it("does not package project tests or source modules", () => {
    expect(existsSync(path.join(root, "crossnext", "tests"))).toBe(false);
    expect(existsSync(path.join(root, "crossnext", "app", "actions", "scanwords.ts"))).toBe(false);
    expect(existsSync(path.join(root, "crossnext", "AGENTS.md"))).toBe(false);
  });
  it("includes the arrow assets used by template previews", () => {
    expect(existsSync(path.join(root, "cross", "server", "src", "arrows", "01.svg"))).toBe(true);
  });
  it("loads the native image runtime from the standalone server", () => {
    const require = createRequire(path.join(root, "crossnext", "server.js"));
    expect(require("sharp").versions.vips).toBeTruthy();
  });
});
