import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const semanticOpacityUtility =
  /(?:bg|border|text|ring|outline|shadow|divide)-(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(?:-foreground)?\/\d+/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("Chrome 109 color compatibility", () => {
  it("does not use semantic opacity utilities that fall back to opaque colors", () => {
    const matches = ["app", "components", "lib"].flatMap((directory) =>
      sourceFiles(path.join(process.cwd(), directory)).flatMap((file) => {
        const utilities = readFileSync(file, "utf8").match(semanticOpacityUtility) ?? [];
        return utilities.map((utility) => `${path.relative(process.cwd(), file)}: ${utility}`);
      }),
    );

    expect(matches).toEqual([]);
  });
});
