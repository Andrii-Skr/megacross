#!/usr/bin/env ts-node
import { parseArgs }           from "node:util";
import { parseFsh }            from "../src/utils/parseFsh";
import { validate, scanSlots } from "../src/utils/grid";
import { solve }               from "../src/utils/solver";
import { loadDictionary }      from "../src/services/dictionary";

(async () => {
  const { values, positionals } = parseArgs({
    options: { file: { type: "string", short: "f" } },
    allowPositionals: true,
  });
  const file = values.file ?? positionals[0];
  if (!file) { console.error("use --file <path>"); process.exit(1); }

  const raw = parseFsh(file);     // 1) parse
  validate(raw);                  // 2) structure check

  const slots = scanSlots(raw);   // 3) find slots
  console.log("slots:", slots.length);

  const dict = await loadDictionary();
  const solved = solve(raw, slots, dict);   // 4) fill

  if (!solved) {
    console.error("can't solve with current dictionary");
    process.exit(1);
  }
  console.log("\n=== filled ===");
  console.log(solved.join("\n"));
})();
