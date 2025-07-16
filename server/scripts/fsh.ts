#!/usr/bin/env node
//------------------------------------------------------------------
import { parseArgs }           from "node:util";
import { parseFsh }            from "../src/utils/parseFsh.js";   // .js если ESM
import { validate }            from "../src/utils/grid.js";
import { Grid }                from "../src/types.js";

/* ---------- CLI ---------- */
const { values, positionals } = parseArgs({
  options: {
    file: { type: "string", short: "f" },
    json: { type: "boolean", short: "j" }, // -j чтобы вывести JSON
  },
  allowPositionals: true,
});

const file = values.file ?? positionals[0];
if (!file) {
  console.error("Usage: pnpm run fsh -- --file <path.fsh> [-j]");
  process.exit(1);
}

/* ---------- main ---------- */
try {
  const grid: Grid = parseFsh(file); // { rows, cols, marker, data[] }
  validate(grid);

  if (values.json) {
    console.log(JSON.stringify(grid, null, 2));
  } else {
    console.log(grid.data.join("\n")); // печатаем как «ASCII-кроссворд»
  }
} catch (e) {
  console.error("Error:", (e as Error).message);
  process.exit(1);
}
