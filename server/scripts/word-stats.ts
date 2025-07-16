import { join } from "path";
import { parseFsh } from "../src/utils/parseFsh";
import { extractSlots } from "../src/utils/slots";

function stats(file: string) {
  const parsed = parseFsh(file);          // уже row-major (Grid = Cell[][])
  const slots  = extractSlots(parsed.grid);

  const byLen = new Map<number, number>();
  for (const s of slots) byLen.set(s.len, (byLen.get(s.len) ?? 0) + 1);

  let total = 0;
  console.log(`\n--- ${parsed.fileName} ---`);
  [...byLen.keys()].sort((a, b) => a - b).forEach(len => {
    const n = byLen.get(len)!;
    total += n;
    console.log(`  из ${len} букв : ${n}`);
  });
  console.log(`  -----------------------\n  всего слов : ${total}`);
}

stats(join(process.cwd(), "sample", "3_ Сканворд.fsh"));
