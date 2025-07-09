import { readdirSync } from "fs";
import { join, extname } from "path";
import { parseFshFile, ParsedFsh } from "../utils/parseFsh";

const SAMPLE_DIR = join(process.cwd(), "sample");

export function loadSampleCrosswords(): ParsedFsh[] {
  const files = readdirSync(SAMPLE_DIR)
    .filter((f) => extname(f).toLowerCase() === ".fsh")
    .map((f) => join(SAMPLE_DIR, f));

  return files.map(parseFshFile);
}

// Показываем превью: имя файла + первые 10 столбцов
export function printPreview(list: ParsedFsh[]): void {
  list.forEach(({ fileName, grid }) => {
    console.log(`\n--- ${fileName} ---`);
    console.log(grid.slice(0, 10));
  });
}
