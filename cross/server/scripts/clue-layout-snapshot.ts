#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { loadDefinitions, loadDictionary } from "../src/services/dictionary";
import { scanSlots, validate } from "../src/utils/grid";
import { parseFsh } from "../src/utils/parseFsh";
import { solve } from "../src/utils/solver";
import { buildClueLayouts } from "../src/utils/clues";
import type { Grid, Slot } from "../src/types";

type TemplateSnapshot = {
  file: string;
  slotCount: number;
  layoutCount: number;
  expandedCount: number;
  clusterCount: number;
  entries: string[];
};

type Snapshot = {
  generatedAt: string;
  templateCount: number;
  skippedCount: number;
  hash: string;
  templates: TemplateSnapshot[];
  skipped: Array<{ file: string; error: string }>;
};

type CriticalTemplateGuard = {
  file: string;
  expandedCount: number;
  clusterCount: number;
  requiredEntries: string[];
};

type PreparedTemplate = {
  file: string;
  grid: Grid;
  slots: Slot[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_ROOT = path.join(__dirname, "..", "sample");
const SNAPSHOT_FILE = path.join(__dirname, "fixtures", "clue-layout-snapshot.json");
const CRITICAL_TEMPLATE_GUARDS: CriticalTemplateGuard[] = [
  {
    file: "sample/01/43.fsh",
    expandedCount: 1,
    clusterCount: 2,
    requiredEntries: ["0,9|a16|c0|t1", "19,11|a1|c14|t1", "19,12|a1|c14|t1"],
  },
  {
    file: "sample/01/47.fsh",
    expandedCount: 1,
    clusterCount: 4,
    requiredEntries: ["18,0|a16|c0|t1", "0,5|a1|c100|t1", "5,5|a1|c100|t1", "10,9|a1|c100|t1", "11,9|a1|c100|t1"],
  },
  {
    file: "sample/01/55.fsh",
    expandedCount: 1,
    clusterCount: 1,
    requiredEntries: ["11,6|a16|c0|t1", "19,9|a1|c14|t1"],
  },
  {
    file: "sample/01/91.fsh",
    expandedCount: 1,
    clusterCount: 0,
    requiredEntries: ["10,6|a16|c0|t1"],
  },
];

const { values } = parseArgs({
  options: {
    update: { type: "boolean" },
    file: { type: "string" },
  },
  allowPositionals: false,
});

function collectFshFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".fsh")) continue;
      out.push(fullPath);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function computeEntriesHash(entries: string[]): string {
  return createHash("sha256").update(entries.join("\n")).digest("hex").slice(0, 16);
}

function buildSnapshotHash(
  templates: TemplateSnapshot[],
  skipped: Array<{ file: string; error: string }>
): string {
  const serialized = templates
    .map((template) =>
      [
        template.file,
        template.slotCount,
        template.layoutCount,
        template.expandedCount,
        template.clusterCount,
        ...template.entries,
      ].join("|")
    )
    .join("\n");
  const skippedSerialized = skipped
    .map((item) => item.file)
    .join("\n");
  return createHash("sha256")
    .update(serialized)
    .update("\n---\n")
    .update(skippedSerialized)
    .digest("hex")
    .slice(0, 16);
}

function normalizePathForSnapshot(filePath: string): string {
  return path.relative(path.join(__dirname, ".."), filePath).split(path.sep).join("/");
}

function readSnapshot(snapshotPath: string): Snapshot | null {
  if (!statExists(snapshotPath)) return null;
  const raw = readFileSync(snapshotPath, "utf8");
  return JSON.parse(raw) as Snapshot;
}

function statExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function summarizeTemplateDiff(
  expected: TemplateSnapshot,
  actual: TemplateSnapshot
): string[] {
  const lines: string[] = [];
  if (expected.slotCount !== actual.slotCount) {
    lines.push(`slotCount ${expected.slotCount} -> ${actual.slotCount}`);
  }
  if (expected.layoutCount !== actual.layoutCount) {
    lines.push(`layoutCount ${expected.layoutCount} -> ${actual.layoutCount}`);
  }
  if (expected.expandedCount !== actual.expandedCount) {
    lines.push(`expandedCount ${expected.expandedCount} -> ${actual.expandedCount}`);
  }
  if (expected.clusterCount !== actual.clusterCount) {
    lines.push(`clusterCount ${expected.clusterCount} -> ${actual.clusterCount}`);
  }
  const expectedHash = computeEntriesHash(expected.entries);
  const actualHash = computeEntriesHash(actual.entries);
  if (expectedHash !== actualHash) {
    lines.push(`entriesHash ${expectedHash} -> ${actualHash}`);
  }
  return lines;
}

function summarizeSkippedDiff(
  expected: Array<{ file: string; error: string }>,
  actual: Array<{ file: string; error: string }>
): string[] {
  const expectedSet = new Set(expected.map((item) => item.file));
  const actualSet = new Set(actual.map((item) => item.file));
  const diffs: string[] = [];
  for (const value of expectedSet) {
    if (!actualSet.has(value)) diffs.push(`missing skipped entry: ${value}`);
  }
  for (const value of actualSet) {
    if (!expectedSet.has(value)) diffs.push(`new skipped entry: ${value}`);
  }
  return diffs;
}

function printSnapshotDiff(expected: Snapshot, actual: Snapshot): void {
  const expectedByFile = new Map(expected.templates.map((item) => [item.file, item]));
  const actualByFile = new Map(actual.templates.map((item) => [item.file, item]));

  const missingFiles = [...expectedByFile.keys()].filter((file) => !actualByFile.has(file));
  const newFiles = [...actualByFile.keys()].filter((file) => !expectedByFile.has(file));
  const changedFiles: Array<{ file: string; diffs: string[] }> = [];

  for (const [file, expectedItem] of expectedByFile) {
    const actualItem = actualByFile.get(file);
    if (!actualItem) continue;
    const diffs = summarizeTemplateDiff(expectedItem, actualItem);
    if (diffs.length > 0) changedFiles.push({ file, diffs });
  }

  console.error("clue-layout snapshot mismatch");
  console.error(`expected hash: ${expected.hash}`);
  console.error(`actual hash:   ${actual.hash}`);
  if (missingFiles.length) {
    console.error(`missing files (${missingFiles.length}):`);
    for (const file of missingFiles.slice(0, 20)) console.error(`  - ${file}`);
  }
  if (newFiles.length) {
    console.error(`new files (${newFiles.length}):`);
    for (const file of newFiles.slice(0, 20)) console.error(`  + ${file}`);
  }
  if (changedFiles.length) {
    console.error(`changed files (${changedFiles.length}):`);
    for (const item of changedFiles.slice(0, 30)) {
      console.error(`  * ${item.file}: ${item.diffs.join(", ")}`);
    }
  }
  const skippedDiffs = summarizeSkippedDiff(expected.skipped ?? [], actual.skipped ?? []);
  if (skippedDiffs.length) {
    console.error(`skipped diff (${skippedDiffs.length}):`);
    for (const line of skippedDiffs.slice(0, 30)) console.error(`  ! ${line}`);
  }
  console.error(`re-run with --update to refresh ${path.relative(path.join(__dirname, ".."), SNAPSHOT_FILE)}`);
}

function assertCriticalTemplateGuards(snapshot: Snapshot): void {
  const templateByFile = new Map(snapshot.templates.map((item) => [item.file, item]));
  for (const guard of CRITICAL_TEMPLATE_GUARDS) {
    const template = templateByFile.get(guard.file);
    if (!template) {
      throw new Error(`critical template guard failed: missing template ${guard.file}`);
    }
    if (template.expandedCount !== guard.expandedCount) {
      throw new Error(
        `critical template guard failed for ${guard.file}: expandedCount ${template.expandedCount} != ${guard.expandedCount}`
      );
    }
    if (template.clusterCount !== guard.clusterCount) {
      throw new Error(
        `critical template guard failed for ${guard.file}: clusterCount ${template.clusterCount} != ${guard.clusterCount}`
      );
    }
    const entrySet = new Set(template.entries);
    for (const entry of guard.requiredEntries) {
      if (!entrySet.has(entry)) {
        throw new Error(`critical template guard failed for ${guard.file}: missing entry ${entry}`);
      }
    }
  }
}

async function buildCurrentSnapshot(
  fshFiles: string[],
  onlyFile?: string
): Promise<Snapshot> {
  const prepared: PreparedTemplate[] = [];
  const skipped: Array<{ file: string; error: string }> = [];
  const allLengths = new Set<number>();

  for (const file of fshFiles) {
    if (onlyFile && !file.endsWith(onlyFile)) continue;
    try {
      const grid = parseFsh(file);
      validate(grid);
      const slots = scanSlots(grid);
      prepared.push({ file, grid, slots });
      for (const slot of slots) allLengths.add(slot.len);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({
        file: normalizePathForSnapshot(file),
        error: message,
      });
    }
  }

  const dict = await loadDictionary({
    langCode: "ru",
    lengths: [...allLengths].sort((a, b) => a - b),
  });

  const solvedByFile = new Map<string, string[]>();
  const words = new Set<string>();
  for (const item of prepared) {
    const solved = solve(item.grid.data, item.slots, dict, false);
    if (!solved) {
      skipped.push({
        file: normalizePathForSnapshot(item.file),
        error: "solve failed",
      });
      continue;
    }
    solvedByFile.set(item.file, solved);
    for (const slot of item.slots) {
      const word = slot.cells.map(([row, col]) => solved[row][col]).join("").toUpperCase();
      words.add(word);
    }
  }

  const definitions = await loadDefinitions([...words], { langCode: "ru" });
  const templates: TemplateSnapshot[] = [];
  for (const item of prepared) {
    const solved = solvedByFile.get(item.file);
    if (!solved) continue;
    const layouts = buildClueLayouts(item.grid, item.slots, solved, definitions, { expand02Area: true });
    const markers = layouts
      .filter((layout) => layout.areaCells.length > 1 || (layout.clusterCells?.length ?? 0) > 1)
      .map((layout) => {
        const area = layout.areaCells.length;
        const cluster = layout.clusterCells?.length ?? 0;
        const hasText = layout.text.trim().length > 0 ? 1 : 0;
        return `${layout.key}|a${area}|c${cluster}|t${hasText}`;
      })
      .sort();

    templates.push({
      file: normalizePathForSnapshot(item.file),
      slotCount: item.slots.length,
      layoutCount: layouts.length,
      expandedCount: markers.filter((line) => line.includes("|a") && !line.includes("|a1|")).length,
      clusterCount: markers.filter((line) => line.includes("|c") && !line.includes("|c0|")).length,
      entries: markers,
    });
  }

  templates.sort((a, b) => a.file.localeCompare(b.file));
  skipped.sort((a, b) => a.file.localeCompare(b.file) || a.error.localeCompare(b.error));
  return {
    generatedAt: new Date().toISOString(),
    templateCount: templates.length,
    skippedCount: skipped.length,
    hash: buildSnapshotHash(templates, skipped),
    templates,
    skipped,
  };
}

async function main(): Promise<void> {
  const update = values.update === true;
  const snapshotPath = values.file ? path.resolve(values.file) : SNAPSHOT_FILE;
  const fshFiles = collectFshFiles(SAMPLE_ROOT);
  const current = await buildCurrentSnapshot(fshFiles);
  assertCriticalTemplateGuards(current);

  if (update) {
    mkdirSync(path.dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    console.log(
      `clue-layout snapshot updated: ${path.relative(path.join(__dirname, ".."), snapshotPath)} (${current.templateCount} templates, hash=${current.hash})`
    );
    return;
  }

  const expected = readSnapshot(snapshotPath);
  if (!expected) {
    console.error(`snapshot file not found: ${path.relative(path.join(__dirname, ".."), snapshotPath)}`);
    console.error("run with --update to create it");
    process.exitCode = 1;
    return;
  }

  const expectedNormalized: Snapshot = {
    ...expected,
    generatedAt: current.generatedAt,
  };
  const actualNormalized: Snapshot = {
    ...current,
  };

  const equal = JSON.stringify(expectedNormalized) === JSON.stringify(actualNormalized);
  if (!equal) {
    printSnapshotDiff(expected, current);
    process.exitCode = 1;
    return;
  }

  console.log(
    `clue-layout snapshot checks passed (${current.templateCount} templates, skipped=${current.skippedCount}, hash=${current.hash})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
