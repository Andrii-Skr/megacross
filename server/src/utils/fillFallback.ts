import type { Slot } from "../types";
import { solve, type SolveFailInfo } from "./solver";

const PROBE_NODES_RATIO = 0.08;
const PROBE_NODES_MIN = 40_000;
const PROBE_NODES_MAX = 120_000;
const PROBE_NODES_BASE = 2_000_000;
const PROBE_MS_RATIO = 0.2;
const PROBE_MS_MIN = 800;
const PROBE_MS_MAX = 1_500;
const PROBE_MS_BASE = 7_500;

const STRICT_LIMITED_NODES_RATIO = 0.3;
const STRICT_LIMITED_NODES_MIN = 250_000;
const STRICT_LIMITED_NODES_MAX = 600_000;
const STRICT_LIMITED_NODES_BASE = 2_000_000;
const STRICT_LIMITED_MS_RATIO = 0.3;
const STRICT_LIMITED_MS_MIN = 4_000;
const STRICT_LIMITED_MS_MAX = 12_000;
const STRICT_LIMITED_MS_BASE = 40_000;

export type ProbeOutcome = "solved" | "unsat" | "unknown";

export type CspProbeResult = {
  solved: string[] | null;
  outcome: ProbeOutcome;
  failInfo: SolveFailInfo | null;
};

type CspProbeOptions = {
  label?: string;
  maxNodes?: number;
  maxMs?: number;
  uniqueWords?: boolean;
  wordPriority?: Map<string, number>;
  lcvPrioritySlack?: number;
};

function toPositiveInt(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeWordKey(word: string): string {
  return word.trim().toUpperCase();
}

export function resolveProbeBudget(maxNodes?: number, maxMs?: number): {
  maxNodes: number;
  maxMs: number;
} {
  const baseNodes = toPositiveInt(maxNodes) ?? PROBE_NODES_BASE;
  const baseMs = toPositiveInt(maxMs) ?? PROBE_MS_BASE;
  return {
    maxNodes: clampInt(baseNodes * PROBE_NODES_RATIO, PROBE_NODES_MIN, PROBE_NODES_MAX),
    maxMs: clampInt(baseMs * PROBE_MS_RATIO, PROBE_MS_MIN, PROBE_MS_MAX),
  };
}

export function resolveStrictLimitedBudget(maxNodes?: number, maxMs?: number): {
  maxNodes: number;
  maxMs: number;
} {
  const baseNodes = toPositiveInt(maxNodes) ?? STRICT_LIMITED_NODES_BASE;
  const baseMs = toPositiveInt(maxMs) ?? STRICT_LIMITED_MS_BASE;
  return {
    maxNodes: clampInt(
      baseNodes * STRICT_LIMITED_NODES_RATIO,
      STRICT_LIMITED_NODES_MIN,
      STRICT_LIMITED_NODES_MAX
    ),
    maxMs: clampInt(baseMs * STRICT_LIMITED_MS_RATIO, STRICT_LIMITED_MS_MIN, STRICT_LIMITED_MS_MAX),
  };
}

export function resolveProbeOutcome(
  solved: string[] | null,
  failInfo: SolveFailInfo | null
): ProbeOutcome {
  if (solved) return "solved";
  if (!failInfo) return "unknown";
  return failInfo.reason === "aborted" ? "unknown" : "unsat";
}

export function runCspProbe(
  rawRows: string[],
  slots: Slot[],
  dict: Map<number, string[]>,
  options: CspProbeOptions = {}
): CspProbeResult {
  const budget = resolveProbeBudget(options.maxNodes, options.maxMs);
  let failInfo: SolveFailInfo | null = null;
  const solved = solve(rawRows, slots, dict, {
    engine: "csp",
    nativeDlx: false,
    shuffle: false,
    lcv: true,
    lcvPrioritySlack: options.lcvPrioritySlack,
    uniqueWords: options.uniqueWords ?? true,
    splitComponents: true,
    restarts: 1,
    parallelRestarts: 1,
    maxNodes: budget.maxNodes,
    maxMs: budget.maxMs,
    label: options.label,
    wordPriority: options.wordPriority,
    onFail: (info) => {
      failInfo = info;
    },
  });
  return {
    solved,
    outcome: resolveProbeOutcome(solved, failInfo),
    failInfo,
  };
}

export function sortDictionaryByPriority(
  dict: Map<number, string[]>,
  priority?: Map<string, number>
): Map<number, string[]> {
  if (!priority?.size) return dict;
  const sorted = new Map<number, string[]>();
  for (const [len, words] of dict) {
    const ordered = [...words];
    ordered.sort((a, b) => {
      const aPriority = priority.get(normalizeWordKey(a)) ?? 0;
      const bPriority = priority.get(normalizeWordKey(b)) ?? 0;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.localeCompare(b, "ru");
    });
    sorted.set(len, ordered);
  }
  return sorted;
}
