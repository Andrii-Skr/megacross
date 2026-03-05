import type { Slot } from "../types";
import { solveDlxNative } from "./nativeDlx";

export type Dict = Map<number, string[]>;

export type SolveProgress = {
  label?: string;
  attempt: number;
  restarts: number;
  engine: "dlx";
  nodes: number;
  elapsedMs: number;
  nodesPerSec: number;
  unfilled: number;
  depth: number;
  lastPick?: {
    id: number;
    len: number;
    degree: number;
    candidates: number;
    pattern: string;
  };
  stats: {
    rejectIntersect: number;
    rejectForward: number;
    zeroPick: number;
    backtracks: number;
  };
};

export type SolveFailInfo = {
  label?: string;
  attempt: number;
  engine: "dlx";
  reason: "zero-pick" | "forward-check" | "aborted" | "no-solution";
  detail?: {
    slot?: {
      id: number;
      r: number;
      c: number;
      len: number;
      dir: "down" | "right";
    };
    pattern?: string;
    column?: {
      name: string;
      type: "slot" | "cell" | "word" | "other";
      slot?: {
        id: number;
        r: number;
        c: number;
        len: number;
        dir: "down" | "right";
      };
      cell?: { r: number; c: number };
      word?: string;
    };
    limit?: "maxMs" | "maxNodes";
  };
};

export type SolveOptions = {
  shuffle?: boolean;
  lcv?: boolean;
  lcvPrioritySlack?: number;
  beamWidth?: number;
  restarts?: number;
  parallelRestarts?: number;
  uniqueWords?: boolean;
  engine?: "dlx";
  splitComponents?: boolean;
  nativeDlx?: boolean;
  debugDlx?: boolean;
  maxMs?: number;
  maxNodes?: number;
  logEveryMs?: number;
  logEveryNodes?: number;
  label?: string;
  wordPriority?: Map<string, number>;
  progressStdout?: boolean;
  failStdout?: boolean;
  onProgress?: (info: SolveProgress) => void;
  onFail?: (info: SolveFailInfo) => void;
};

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
  return Math.floor(value as number);
}

function normalizeNonNegativeInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) < 0) return fallback;
  return Math.floor(value as number);
}

export function solve(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  shuffleOrOptions: boolean | SolveOptions = false
): string[] | null {
  const optionsRaw =
    typeof shuffleOrOptions === "boolean" ? { shuffle: shuffleOrOptions } : shuffleOrOptions ?? {};
  const engine = optionsRaw.engine ?? "dlx";
  if (engine !== "dlx") throw new Error("Only DLX engine is supported.");
  if (optionsRaw.nativeDlx === false) {
    throw new Error("nativeDlx=false is no longer supported. Native DLX is required.");
  }

  const result = solveDlxNative(rawRows, slots, dict, {
    ...optionsRaw,
    engine: "dlx",
    nativeDlx: true,
    shuffle: optionsRaw.shuffle ?? false,
    lcv: optionsRaw.lcv ?? false,
    lcvPrioritySlack: normalizeNonNegativeInt(optionsRaw.lcvPrioritySlack, 0),
    restarts: normalizePositiveInt(optionsRaw.restarts, 1),
    parallelRestarts: normalizePositiveInt(optionsRaw.parallelRestarts, 1),
    uniqueWords: optionsRaw.uniqueWords ?? true,
    splitComponents: optionsRaw.splitComponents ?? true,
    logEveryMs: normalizeNonNegativeInt(optionsRaw.logEveryMs, 0),
    logEveryNodes: normalizeNonNegativeInt(optionsRaw.logEveryNodes, 0),
  });
  if (result === undefined) {
    throw new Error("Native DLX solver is not available or failed to run.");
  }
  return result;
}
