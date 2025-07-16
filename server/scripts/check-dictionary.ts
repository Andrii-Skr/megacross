import { promises as fs } from "fs";
import { join, extname } from "path";

import { parseFsh } from "../src/utils/parseFsh";
import { extractSlots } from "../src/utils/slots";
import { loadDictionary } from "../src/services/dictionary";

async function main() {
  const dict = await loadDictionary();             // длина → слова
  const sampleDir = join(process.cwd(), "sample");
  const files = (await fs.readdir(sampleDir)).filter(f => extname(f) === ".fsh");

  for (const file of files) {
    const { fileName, grid } = parseFsh(join(sampleDir, file));
    const lengths = Array.from(
      new Set(extractSlots(grid).map(s => s.len))    // все длины в сетке
    ).sort((a, b) => a - b);

    console.log(`\n--- ${fileName} ---`);
    lengths.forEach(len => {
      const have = dict.get(len)?.length ?? 0;
      const status = have ? "OK" : "MISSING";
      console.log(`  длина ${len.toString().padStart(2)} : ${have.toString().padStart(5)}  ${status}`);
    });
  }
}

main().catch(err => console.error(err));
