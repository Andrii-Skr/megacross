import { promises as fs } from "fs";
import { join, extname } from "path";

import { parseFsh } from "./utils/parseFsh";
import { extractSlots } from "./utils/slots";
import { loadDictionary } from "./services/dictionary";
import { solve } from "./utils/solver";
import { buildSvg } from "./utils/svgBuilder";

/** 0 → решаем полную сетку, >0 → только первые N строк (для быстрого теста) */
const TEST_ROWS = 10;             // ← меняйте здесь

const SAMPLE_DIR = join(process.cwd(), "sample");

(async () => {
  /** 1. загружаем словарь из words_v */
  const dict = await loadDictionary();

  /** 2. все .fsh в sample/ */
  const files = (await fs.readdir(SAMPLE_DIR)).filter(
    f => extname(f).toLowerCase() === ".fsh"
  );

  for (const f of files) {
    /** 2a. полное чтение файла */
    const full = parseFsh(join(SAMPLE_DIR, f));

    /** 2b. опционально «режем» до TEST_ROWS */
    const parsed =
      TEST_ROWS > 0
        ? {
            ...full,
            rows: Math.min(TEST_ROWS, full.rows),
            grid: full.grid.slice(0, TEST_ROWS),
          }
        : full;

    /** 3. проверяем, все ли длины слов есть в словаре */
    const needLens = [...new Set(extractSlots(parsed.grid).map(s => s.len))];
    const missing = needLens.filter(l => !dict.has(l));
    if (missing.length) {
      console.warn(
        `${parsed.fileName}: нет слов длины ${missing.join(", ")} — пропускаю`
      );
      continue;
    }

    /** 4. решаем и измеряем время */
    const t0 = Date.now();
    const { filled, used } = solve(parsed.grid, dict);
    const secs = ((Date.now() - t0) / 1000).toFixed(2);

    /** 5. сохраняем SVG + список использованных слов */
    const base = parsed.fileName + (TEST_ROWS ? `_top${TEST_ROWS}` : "");
    await fs.writeFile(`${base}_used_words.txt`, used.join("\n"), "utf-8");
    buildSvg(filled, 20, `${base}.svg`);

    console.log(`✔ ${base}: ${used.length} слов, ${secs}s`);
  }
})();
