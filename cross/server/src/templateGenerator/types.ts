import type { Grid } from "../types";

export const CUTOUT_PRESETS = [
  "none",
  "corner",
  "opposite-corners",
  "edge-bite",
  "opposite-edge-bites",
  "stepped-corner",
  "center-window",
] as const;

export type CutoutPresetId = (typeof CUTOUT_PRESETS)[number];
export type PictureSize = { width: number; height: number };
export type PictureRequest =
  | { mode: "auto"; count: number }
  | { mode: "manual"; items: PictureSize[] };

export type TemplateGenerationRequest = {
  rows: number;
  cols: number;
  resultCount: number;
  dictionaryFilterId?: number | null;
  pictures: PictureRequest;
  cutoutPresetId: CutoutPresetId;
  seed?: string | number | null;
};

export type PictureBounds = PictureSize & { row: number; col: number };

export type TemplateMetrics = {
  slotCount: number;
  intersections: number;
  averageIntersections: number;
  lengthDistribution: Record<string, number>;
  pictureBounds: PictureBounds[];
  cutoutOrientation: string;
  dictionaryVerified: boolean;
};

export type GeneratedTemplate = {
  grid: Grid;
  fsh: Uint8Array;
  fingerprint: string;
  metrics: TemplateMetrics;
  solved?: string[];
};

export type TemplateInvariantReport = {
  valid: boolean;
  errors: string[];
  slotCount: number;
  intersections: number;
  averageIntersections: number;
  lengthDistribution: Record<string, number>;
};
