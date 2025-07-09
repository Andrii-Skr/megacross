import { readdirSync } from "fs";
import { join, extname } from "path";
import { parseFsh } from "../utils/parseFsh";   // ← исправили имя
//          ▲ здесь было { parseFshFile }

const SAMPLE_DIR = join(process.cwd(), "sample"); // ← вернули полное имя

export function loadSampleCrosswords() {
  const files = readdirSync(SAMPLE_DIR)
    .filter(f => extname(f).toLowerCase() === ".fsh")
    .map(f => join(SAMPLE_DIR, f));

  return files.map(parseFsh);                    // ← и здесь
}
