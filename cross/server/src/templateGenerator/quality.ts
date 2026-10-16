import { CLUE_MAP, scanSlotsDetailed } from "@megacross/cross-format";
import type { Grid } from "../types";
import type { PictureBounds, TemplateInvariantReport } from "./types";
import { boundaryDirectionMetrics } from "./boundary";

export function targetDoubleArrowCount(slotCount: number): number {
  return Math.min(20, Math.max(0, Math.round(slotCount * 0.035)));
}

/** All components are dimensionless penalties; lower is better. */
export function evaluateTemplateQuality(grid: Grid, pictures: readonly PictureBounds[], report: TemplateInvariantReport, weights?: Readonly<Record<number, number>>) {
  const lengthDeviation = weights ? Array.from({ length: 10 }, (_, i) => Math.abs((report.lengthDistribution[i + 2] ?? 0) / Math.max(1, report.slotCount) - (weights[i + 2] ?? 0))).reduce((sum, value) => sum + value, 0) / 2 : 0;
  const photos = new Uint8Array(grid.rows * grid.cols);
  for (const p of pictures) for (let r = p.row; r < p.row + p.height; r += 1) for (let c = p.col; c < p.col + p.width; c += 1) photos[r * grid.cols + c] = 1;
  const isClue = (r: number, c: number) => r >= 0 && c >= 0 && r < grid.rows && c < grid.cols && grid.data[r][c] === "#" && !photos[r * grid.cols + c];
  const counts = [0, 0, 0, 0];
  const areas = [0, 0, 0, 0];
  let clueCount = 0; let isolated = 0;
  for (let r = 0; r < grid.rows; r += 1) for (let c = 0; c < grid.cols; c += 1) {
    if (photos[r * grid.cols + c] || grid.data[r][c] === "%") continue;
    const quadrant = Number(r >= grid.rows / 2) * 2 + Number(c >= grid.cols / 2);
    areas[quadrant] += 1;
    if (!isClue(r, c)) continue;
    counts[quadrant] += 1; clueCount += 1;
    if (![[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) => isClue(rr, cc))) isolated += 1;
  }
  const isolatedClueShare = isolated / Math.max(1, clueCount);
  const density = clueCount / Math.max(1, areas.reduce((a, b) => a + b, 0));
  const spatialImbalance = counts.reduce((sum, count, i) => sum + Math.abs(count - areas[i] * density), 0) / Math.max(1, 2 * clueCount);
  const pictureImbalance = pictures.length ? Math.hypot(
    pictures.reduce((sum, p) => sum + (p.col + p.width / 2) / grid.cols - 0.5, 0) / pictures.length,
    pictures.reduce((sum, p) => sum + (p.row + p.height / 2) / grid.rows - 0.5, 0) / pictures.length,
  ) / Math.SQRT1_2 : 0;
  // Short diagonal translations expose repeated bands without rewarding empty space.
  let repetition = 0;
  for (const [dr, dc] of [[1, 1], [1, -1], [1, 2], [2, 1], [1, -2], [2, -1], [1, 3], [3, 1]]) {
    let pairs = 0; let matches = 0;
    for (let r = 0; r < grid.rows; r += 1) for (let c = 0; c < grid.cols; c += 1) {
      const rr = r + dr; const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= grid.rows || cc >= grid.cols || photos[r * grid.cols + c] || photos[rr * grid.cols + cc] || grid.data[r][c] === "%" || grid.data[rr][cc] === "%") continue;
      if (isClue(r, c)) { pairs += 1; if (isClue(rr, cc)) matches += 1; }
    }
    if (pairs >= 4) repetition = Math.max(repetition, Math.max(0, matches / pairs - density) / Math.max(0.01, 1 - density));
  }
  // Bridges in the word graph identify areas joined through a single crossing.
  const slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 2 }).slots;
  const { edgeDirectionPenalty, edgeDirectionDeficit, top, left } = boundaryDirectionMetrics(grid, pictures, slots);
  const membership = new Map<number, number[]>();
  slots.forEach((slot, id) => { for (const [r, c] of slot.cells) { const key = r * grid.cols + c; const ids = membership.get(key) ?? []; ids.push(id); membership.set(key, ids); } });
  const graph = slots.map(() => new Set<number>());
  for (const ids of membership.values()) for (const a of ids) for (const b of ids) if (a !== b) graph[a].add(b);
  const entered = new Int32Array(slots.length).fill(-1); const low = new Int32Array(slots.length);
  let time = 0; let bridges = 0;
  const visit = (node: number, parent: number) => {
    entered[node] = low[node] = time++;
    for (const next of graph[node]) {
      if (next === parent) continue;
      if (entered[next] < 0) { visit(next, node); low[node] = Math.min(low[node], low[next]); if (low[next] > entered[node]) bridges += 1; }
      else low[node] = Math.min(low[node], entered[next]);
    }
  };
  for (let id = 0; id < slots.length; id += 1) if (entered[id] < 0) visit(id, -1);
  const bottleneckShare = bridges / Math.max(1, slots.length - 1);
  const doubleArrowCount = grid.codes.flat().filter((code) => CLUE_MAP[code]?.length === 2).length;
  const doubleDeviation = Math.abs(doubleArrowCount - targetDoubleArrowCount(report.slotCount));
  const shortWordExcess = weights ? Math.max(0, (report.lengthDistribution[3] ?? 0) / Math.max(1, report.slotCount) - (weights[3] ?? 0)) : 0;
  return { qualityVersion: 3, edgeDirectionPenalty, edgeDirectionDeficit, topEdgeAlongWords: top.along, leftEdgeAlongWords: left.along, lengthDeviation, isolatedClueShare, doubleArrowCount, spatialImbalance, pictureImbalance, repetition, bottleneckShare,
    qualityScore: lengthDeviation + 3 * shortWordExcess + 0.15 * isolatedClueShare + 0.375 * doubleDeviation + 0.2 * spatialImbalance + 0.1 * pictureImbalance + 0.15 * repetition + 0.25 * bottleneckShare + 0.35 * edgeDirectionPenalty };
}
