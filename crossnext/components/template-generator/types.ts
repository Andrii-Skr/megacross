export type GenerationRequest = {
  rows: number;
  cols: number;
  resultCount: number;
  dictionaryFilterId?: number | null;
  pictures: { mode: "auto"; count: number } | { mode: "manual"; items: Array<{ width: number; height: number }> };
  cutoutPresetId: string;
  seed?: string | null;
};

export type GenerationJob = {
  id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
  phase: string;
  progress: number;
  requestedCount: number;
  acceptedCount: number;
  attempts: number;
  seed: string;
  parameters: GenerationRequest;
  error: string | null;
};

export type GenerationResult = {
  id: string;
  jobId: string;
  ordinal: number;
  grid: { rows: number; cols: number; data: string[]; codes: number[][] };
  metrics: {
    slotCount: number;
    intersections: number;
    averageIntersections: number;
    lengthDistribution: Record<string, number>;
    pictureBounds: Array<{ row: number; col: number; width: number; height: number }>;
    cutoutOrientation: string;
    dictionaryVerified: boolean;
  };
};
