#!/usr/bin/env tsx
//------------------------------------------------------------------
import { parseArgs }           from "node:util";
import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import { solve }               from "../src/utils/solver";
import { loadDictionary }      from "../src/services/dictionary";
import { Grid }                from "../src/types";

(async () => {
  /* ---- 0. CLI ---- */
  const { values, positionals } = parseArgs({
    options: { file: { type: "string", short: "f" } },
    allowPositionals: true,
  });
  const file = values.file ?? positionals[0];
  if (!file) {
    console.error("Usage: pnpm run fill -- --file <path/to/file.fsh>");
    process.exit(1);
  }

  /* ---- 1. parse + validate ---- */
  const grid: Grid = parseFsh(file);   // { rows, cols, marker, data[] }
  validate(grid);

  /* ---- 2. slots ---- */
  const slots = scanSlots(grid);
  console.log("slots:", slots.length);

  /* ---- 3. dictionary + solve ---- */
  const lengths = [...new Set(slots.map((s) => s.len))];
  const dict = await loadDictionary({ langCode: "ru", lengths });
  const solved = solve(grid.data, slots, dict);   // grid.data = массив строк

  if (!solved) {
    console.error("can't solve with current dictionary");
    process.exit(1);
  }

  /* ---- 4. output ---- */
  console.log("\n=== filled ===");
  console.log(solved.join("\n"));
})();
