import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { arrowCellForCode, buildFsh, CLUE_MAP, CLUE_POSITION_OFFSETS, markerFor } from "@megacross/cross-format";
import { boundaryDirectionMetrics } from "./boundary";
import { verifyClueOwnership } from "./clueMatcher";
import { geometryFingerprint, isDiverseGeometry } from "./diversity";
import { buildCutout, normalizeGenerationRequest, recognizePictureBounds, verifyTemplateInvariants } from "./generator";
import { evaluateTemplateQuality } from "./quality";
import { templateSupplyDeficit } from "./weights";
import type { GeneratedTemplate, PictureBounds, TemplateGenerationRequest } from "./types";
import type { Grid } from "../types";

type NativeModule = {
  createGenerationControl(): number;
  cancelGeneration(id: number): void;
  releaseGenerationControl(id: number): void;
  generateTemplate(json: string, control: number): string;
};
let native: NativeModule | undefined;
function addon(): NativeModule {
  if (native) return native;
  const target = process.env.CROSS_TEMPLATE_NATIVE_PATH || fileURLToPath(new URL("../../native/template-generator/template_generator.node", import.meta.url));
  try { native = createRequire(import.meta.url)(target) as NativeModule; }
  catch (cause) { throw new Error("Rust template generator is unavailable; run pnpm build:template-native in cross/server", { cause }); }
  if (typeof native.generateTemplate !== "function" || typeof native.createGenerationControl !== "function" || typeof native.cancelGeneration !== "function" || typeof native.releaseGenerationControl !== "function") {
    native = undefined;
    throw new Error("Rust template generator has an incompatible API; rebuild with pnpm build:template-native");
  }
  return native;
}
export const createGenerationControl = () => addon().createGenerationControl();
export const cancelGeneration = (id: number) => addon().cancelGeneration(id);
export const releaseGenerationControl = (id: number) => addon().releaseGenerationControl(id);

export const TEMPLATE_NATIVE_ARROWS = Object.entries(CLUE_MAP).map(([key, entries]) => {
  const code = Number(key);
  const cell = arrowCellForCode(code);
  return {
    code, directions: entries.map((e) => e.dirKey),
    offsets: entries.map((e) => CLUE_POSITION_OFFSETS[e.cluePos]),
    renderDirections: cell === "↘" ? [8, 6] : cell === "↓" ? [8] : cell === "→" ? [6] : [],
  };
});
export type NativeSearchInput = {
  request: TemplateGenerationRequest;
  rngPosition: number;
  fingerprints: string[];
  diversityFingerprints?: string[];
  weights?: Readonly<Record<number, number>>;
  dictionaryCounts?: Readonly<Record<number, number>>;
  attemptBudget?: number;
  poolSize?: number;
  adaptiveSearch?: boolean;
  profile?: boolean;
  regionalRepair?: boolean;
  maskFamily?: string;
  maxMs?: number;
};
type NativeCandidate = {
  slotCount: number; intersections: number; rows: number; cols: number; mask: string[]; codes: number[][]; pictures: PictureBounds[];
  orientation: string; fingerprint: string; quality: ReturnType<typeof evaluateTemplateQuality>;
  regionalRepairCount: number; maskFamily: string;
};
export type NativeSearchResult = { candidate: GeneratedTemplate | null; rngPosition: number; diagnostics: Record<string, number>; stopped: boolean };

export function generateNativeCandidate(input: NativeSearchInput, control: number): NativeSearchResult {
  const request = normalizeGenerationRequest(input.request);
  const output = JSON.parse(addon().generateTemplate(JSON.stringify({ ...input, request, diversityFingerprints: input.diversityFingerprints ?? input.fingerprints, arrows: TEMPLATE_NATIVE_ARROWS }), control)) as {
    candidate: NativeCandidate | null; rngPosition: number; diagnostics: Record<string, number>; stopped: boolean;
  };
  if (!output.candidate) return { ...output, candidate: null };
  const c = output.candidate;
  const fail = (reason: string): never => { throw new Error(`Rust template failed independent validation: ${reason}`); };
  if (c.rows !== request.rows || c.cols !== request.cols || c.mask.length !== c.rows || c.codes.length !== c.rows || c.mask.some((r) => r.length !== c.cols || !/^[*#%]+$/u.test(r)) || c.codes.some((r) => r.length !== c.cols)) fail("dimensions or mask");
  const grid: Grid = {
    rows: c.rows, cols: c.cols, marker: markerFor(c.rows, c.cols, 2), formatVersion: 2,
    templateTypeCode: "S", templateType: "scanword", codes: c.codes,
    data: c.mask.map((row, r) => [...row].map((cell, col) => cell === "*" && c.codes[r][col] ? arrowCellForCode(c.codes[r][col]) : cell).join("")),
  };
  const orientationNames = request.cutoutPresetId === "edge-bite" ? ["left", "right", "top", "bottom"]
    : request.cutoutPresetId === "opposite-edge-bites" ? ["left-right", "top-bottom"]
    : request.cutoutPresetId === "none" ? ["none"] : request.cutoutPresetId === "center-window" ? ["center"]
    : ["top-left", "top-right", "bottom-right", "bottom-left"];
  const orientation = orientationNames.indexOf(c.orientation);
  if (orientation < 0) fail("cutout orientation");
  const expectedCutout = buildCutout(request, { int: () => orientation }).cells;
  for (let r = 0; r < grid.rows; r += 1) for (let col = 0; col < grid.cols; col += 1) {
    if ((grid.data[r][col] === "%") !== expectedCutout.has(`${r},${col}`)) fail("cutout cells");
  }
  if (c.pictures.some((p) => ![p.row, p.col, p.width, p.height].every(Number.isInteger) || p.row < 0 || p.col < 0 || p.width < 4 || p.height < 4 || p.row + p.height > grid.rows || p.col + p.width > grid.cols)) fail("photo dimensions");
  const report = verifyTemplateInvariants(grid);
  if (!report.valid) fail(report.errors.join(", "));
  if (report.slotCount !== c.slotCount || report.intersections !== c.intersections) fail("topology counters");
  if (verifyClueOwnership(grid, c.pictures).length) fail("clue ownership");
  const sorted = (items: readonly PictureBounds[]) => [...items].sort((a, b) => a.row - b.row || a.col - b.col || a.width - b.width || a.height - b.height);
  if (JSON.stringify(sorted(recognizePictureBounds(grid))) !== JSON.stringify(sorted(c.pictures))) fail("photo bounds");
  const expectedPictures = request.pictures.mode === "auto" ? request.pictures.count : request.pictures.items.length;
  if (c.pictures.length !== expectedPictures || request.pictures.mode === "manual" && request.pictures.items.some((size, i) => size.width !== c.pictures[i].width || size.height !== c.pictures[i].height)) fail("requested photos");
  const fingerprint = geometryFingerprint(grid);
  if (fingerprint !== c.fingerprint || input.fingerprints.includes(fingerprint) || !isDiverseGeometry(fingerprint, input.diversityFingerprints ?? input.fingerprints)) fail("diversity");
  if (templateSupplyDeficit(report.lengthDistribution, report.slotCount, input.dictionaryCounts, input.weights)) fail("dictionary length supply");
  if (boundaryDirectionMetrics(grid, c.pictures).edgeDirectionDeficit) fail("boundary directions");
  const quality = evaluateTemplateQuality(grid, c.pictures, report, input.weights);
  for (const [key, value] of Object.entries(quality)) {
    const actual = c.quality[key as keyof typeof quality];
    if (!Number.isFinite(actual) || Math.abs(actual - value) > 1e-10) fail(`quality component ${key}`);
  }
  return { ...output, candidate: {
    grid, fsh: buildFsh(grid), fingerprint,
    metrics: { slotCount: report.slotCount, intersections: report.intersections, averageIntersections: report.averageIntersections,
      lengthDistribution: report.lengthDistribution, pictureBounds: c.pictures, cutoutOrientation: c.orientation,
      dictionaryVerified: false, regionalRepairCount: c.regionalRepairCount, maskFamily: c.maskFamily, generationEngine: "rust", ...quality },
  } };
}
