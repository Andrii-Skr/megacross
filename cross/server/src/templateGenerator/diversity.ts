import type { Grid } from "../types";

function variants(rows: readonly string[]): string[] {
  const result: string[] = [];
  for (const transpose of [false, true]) {
    if (transpose && rows.length !== rows[0]?.length) continue;
    const matrix = transpose ? Array.from({ length: rows.length }, (_, c) => rows.map((row) => row[c]).join("")) : rows;
    for (const flipRows of [false, true]) for (const flipCols of [false, true]) {
      const ordered = flipRows ? [...matrix].reverse() : matrix;
      result.push(ordered.map((row) => flipCols ? [...row].reverse().join("") : row).join("/"));
    }
  }
  return result;
}

export function geometryFingerprint(grid: Grid): string {
  return variants(grid.data.map((row) => [...row].map((cell) => cell === "#" || cell === "%" ? cell : "*").join(""))).sort()[0] ?? "";
}

/** Minimum blocker-mask Jaccard distance over the same symmetries as fingerprints.
 * Shared letters and cutouts do not dilute the distance on large sparse grids.
 */
export function geometryDistance(left: string, right: string): number {
  const rows = left.split("/");
  const other = right.split("/");
  if (rows.length !== other.length || rows.some((row, i) => row.length !== other[i].length)) return 1;
  let minimum = 1;
  for (const candidate of variants(other)) {
    let different = 0;
    let union = 0;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] === "/") continue;
      if (left[i] === "#" || candidate[i] === "#" || left[i] !== candidate[i]) union += 1;
      if (left[i] !== candidate[i]) different += 1;
    }
    minimum = Math.min(minimum, different / Math.max(1, union));
  }
  return minimum;
}

export const MIN_GEOMETRY_DISTANCE = 0.12;

export function isDiverseGeometry(fingerprint: string, accepted: readonly string[]): boolean {
  return accepted.every((previous) => geometryDistance(fingerprint, previous) >= MIN_GEOMETRY_DISTANCE);
}
