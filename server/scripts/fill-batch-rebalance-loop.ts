#!/usr/bin/env ts-node
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const FILL_BATCH_ARGS = [
  "--native-dlx",
  "-s",
  "-u",
  "--style",
  "corel",
  "--lcv",
  "--restarts",
  "1",
  "--max-nodes",
  "500000",
  "--parallel",
  "1",
  "--no-defs",
  "--explain-fail",
  "--report-duplicates",
  "--filter-template-id",
  "1",
  "--edition-id",
  "18",
  "--usage-rebalance",
  "--template-parallel",
   "1"
];

const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const DEFAULT_LOG_FILE = join("out", "fill-batch-rebalance-loop.log");

function parseCount(): number {
  const { values, positionals } = parseArgs({
    options: {
      count: { type: "string", short: "n" },
    },
    allowPositionals: true,
  });

  const rawCount = values.count ?? positionals[0];
  const count = rawCount ? Number.parseInt(rawCount, 10) : Number.NaN;

  if (!Number.isInteger(count) || count <= 0) {
    console.error("Usage: pnpm run fill-batch-rebalance-loop -- <N>");
    console.error("N must be a positive integer.");
    process.exit(1);
  }

  return count;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeOutputToLines(stdout: string, stderr: string): string[] {
  return `${stdout}\n${stderr}`
    .replace(/\r/gu, "")
    .split("\n")
    .map((line) => stripAnsiColor(line).trimEnd())
    .filter((line) => line.length > 0);
}

function stripAnsiColor(input: string): string {
  const esc = String.fromCharCode(27);
  const prefix = `${esc}[`;
  let output = input;
  let start = output.indexOf(prefix);

  while (start !== -1) {
    const tail = output.slice(start + prefix.length);
    const end = tail.indexOf("m");
    if (end === -1) break;
    output = `${output.slice(0, start)}${tail.slice(end + 1)}`;
    start = output.indexOf(prefix);
  }

  return output;
}

function pickLine(lines: string[], prefix: string): string | undefined {
  return lines.find((line) => line.startsWith(prefix));
}

function pickLineBySubstring(lines: string[], marker: string): string | undefined {
  return lines.find((line) => line.includes(marker));
}

function buildSummaryLines(lines: string[]): string[] {
  return [
    pickLine(lines, "📈 edition usage stats updated:"),
    pickLine(lines, "Итог: успешно заполнены"),
    pickLine(lines, "Все файлы обработаны."),
    pickLine(lines, "🔁 unique fallback:"),
    pickLine(lines, "📐 usage-balance-by-len worst="),
    pickLine(lines, "🧊 rebalance:"),
    pickLine(lines, "🧊 rebalance-by-len:"),
    pickLine(lines, "📊 отчёт по дублям слов"),
    pickLineBySubstring(lines, "слов-дублей="),
  ].filter((line): line is string => typeof line === "string");
}

function appendLinesToLog(logPath: string, lines: string[]): void {
  appendFileSync(logPath, `${lines.join("\n")}\n`, "utf8");
}

function printSummaryLog(lines: string[], logPath: string): void {
  const summary = buildSummaryLines(lines);
  if (summary.length > 0) {
    console.log(summary.join("\n"));
    appendLinesToLog(logPath, summary);
    return;
  }

  console.log("Итоговые строки не найдены, хвост вывода:");
  appendLinesToLog(logPath, ["Итоговые строки не найдены, хвост вывода:"]);
  const tail = lines.slice(-40);
  for (const line of tail) {
    console.log(line);
    appendLinesToLog(logPath, [line]);
  }
}

function runIteration(iteration: number, total: number, logPath: string): number {
  const command = `pnpm run fill-batch -- ${FILL_BATCH_ARGS.join(" ")}`;
  const startedAt = new Date();
  const startLine = `[${iteration}/${total}] дата: ${formatDateLocal(startedAt)}`;
  const commandLine = `команда запуска: "${command}"`;
  console.log(`\n${startLine}`);
  console.log(commandLine);
  appendLinesToLog(logPath, ["", startLine, commandLine]);
  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  const result = spawnSync(pnpmBin, ["run", "fill-batch", "--", ...FILL_BATCH_ARGS], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });

  const finishedAt = new Date();
  const elapsedSec = ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);
  const exitCode = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const lines = normalizeOutputToLines(stdout, stderr);

  if (result.error) {
    const errorLine = `[${iteration}/${total}] failed to start: ${result.error.message}`;
    console.error(errorLine);
    appendLinesToLog(logPath, [errorLine]);
    return 1;
  }

  if (exitCode !== 0) {
    const failLine = `[${iteration}/${total}] failed with code ${exitCode} in ${elapsedSec}s`;
    console.error(failLine);
    appendLinesToLog(logPath, [failLine]);
    const tail = lines.slice(-60);
    if (tail.length > 0) {
      console.error("Последние строки вывода:");
      appendLinesToLog(logPath, ["Последние строки вывода:"]);
      for (const line of tail) {
        console.error(line);
        appendLinesToLog(logPath, [line]);
      }
    }
    return exitCode;
  }

  printSummaryLog(lines, logPath);
  const doneLine = `[${iteration}/${total}] done in ${elapsedSec}s, дата: ${formatDateLocal(finishedAt)}`;
  console.log(doneLine);
  appendLinesToLog(logPath, [doneLine]);
  return 0;
}

function main(): void {
  const count = parseCount();
  mkdirSync(dirname(DEFAULT_LOG_FILE), { recursive: true });
  writeFileSync(DEFAULT_LOG_FILE, "", "utf8");
  appendLinesToLog(DEFAULT_LOG_FILE, [
    `fill-batch rebalance loop log`,
    `дата старта: ${formatDateLocal(new Date())}`,
    `итераций: ${count}`,
  ]);
  console.log(`Лог-файл: ${DEFAULT_LOG_FILE}`);

  for (let iteration = 1; iteration <= count; iteration += 1) {
    const exitCode = runIteration(iteration, count, DEFAULT_LOG_FILE);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }

  const completedLine = `Completed ${count}/${count} iterations.`;
  console.log(`\n${completedLine}`);
  appendLinesToLog(DEFAULT_LOG_FILE, ["", completedLine, `дата завершения: ${formatDateLocal(new Date())}`]);
}

main();
