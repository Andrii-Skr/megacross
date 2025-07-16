#!/usr/bin/env node
import { parseArgs } from "node:util";
import { parseFsh, validate } from "../src/utils/parseFsh";

const { values, positionals } = parseArgs({
  options: { file: { type: "string", short: "f" } },
  allowPositionals: true,
});

const file = values.file ?? positionals[0];
if (!file) {
  console.error("Usage: npm run fsh -- --file=<path/to/file.fsh>");
  process.exit(1);
}

try {
  const grid = parseFsh(file);
  validate(grid);

  // Вывод: просто печатаем в консоль.
  // Можно вернуть JSON, CSV — на ваше усмотрение.
  console.log(grid.join("\n"));
} catch (e) {
  console.error("Error:", (e as Error).message);
  process.exit(1);
}
