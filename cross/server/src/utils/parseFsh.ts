import { readFileSync } from "node:fs";
import { parseFshBytes } from "@megacross/cross-format";
import type { Grid } from "../types";

export { buildFsh, markerFor, parseFshBytes } from "@megacross/cross-format";

export function parseFsh(path: string): Grid {
  return parseFshBytes(readFileSync(path));
}
