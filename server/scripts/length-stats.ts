#!/usr/bin/env ts-node
//---------------------------------------------------------------------
// scripts/length-stats.ts
//---------------------------------------------------------------------
import { parseArgs }          from "node:util";
import { parseFsh }           from "../src/utils/parseFsh";
import { validate, scanSlots, lengthStats }
                              from "../src/utils/grid";

function printStats(stats: Record<string, number>) {
  const lines = Object.entries(stats)
    .filter(([k]) => k !== "total")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([len, cnt]) => `${len.padStart(2, " ")}-буквенных : ${cnt}`);
  lines.push("──────────────────────────");
  lines.push(`Всего слов      : ${stats.total}`);
  console.log(lines.join("\n"));
}

(async () => {
  const { values, positionals } = parseArgs({
    options: { file: { type: "string", short: "f" } },
    allowPositionals: true,
  });

  const file = values.file ?? positionals[0];
  if (!file) {
    console.error("Usage: pnpm run length-stats -- <path.fsh>");
    process.exit(1);
  }

  const rows  = parseFsh(file);
  validate(rows);

  const stats = lengthStats(scanSlots(rows));
  printStats(stats);
})();
