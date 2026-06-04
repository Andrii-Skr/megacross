#!/usr/bin/env tsx
import { DIRS, type Slot } from "../src/types";
import { solve } from "../src/utils/solver";
import { isNativeCspAvailable } from "../src/utils/nativeDlx";

const rows = [
  ".....",
  ".....",
  ".....",
  ".....",
  ".....",
];

const slots: Slot[] = [
  { id: 0, r: 0, c: 0, dir: DIRS.right, len: 5, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 1, r: 2, c: 0, dir: DIRS.right, len: 5, cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
  { id: 2, r: 4, c: 0, dir: DIRS.right, len: 5, cells: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] },
  { id: 3, r: 0, c: 0, dir: DIRS.down, len: 5, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: 4, r: 0, c: 2, dir: DIRS.down, len: 5, cells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] },
  { id: 5, r: 0, c: 4, dir: DIRS.down, len: 5, cells: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
];

const dict = new Map<number, string[]>([
  [5, [
    "ALERT", "ANGLE", "ALTER", "AGILE", "BRAIN", "BRAVE", "CRANE", "CLEAN",
    "DREAM", "DRIVE", "EAGER", "EARTH", "FAITH", "FRAME", "GLARE", "GRACE",
    "HEART", "HONEY", "IDEAL", "INDEX", "JELLY", "KNIFE", "LEARN", "LEVEL",
    "MANGO", "METAL", "NERVE", "NOBLE", "OCEAN", "OPERA", "PLANE", "PLANT",
    "QUEST", "QUICK", "RANGE", "RIVER", "SCALE", "SHINE", "TABLE", "TIGER",
    "ULTRA", "UNION", "VIVID", "VOICE", "WATER", "WHEEL", "XENON", "YOUTH", "ZEBRA",
  ]],
]);

type RunStat = {
  parallel: number;
  solved: boolean;
  elapsedMs: number;
  nodes: number;
  nodesPerSec: number;
  backtracks: number;
  rejectForward: number;
};

function run(parallelRestarts: number): RunStat {
  const startedAt = Date.now();
  let lastProgress:
    | { nodes?: number; nodesPerSec?: number; stats?: { backtracks?: number; rejectForward?: number } }
    | null = null;
  const solved = solve(rows, slots, dict, {
    engine: "csp",
    shuffle: true,
    lcv: true,
    uniqueWords: false,
    splitComponents: false,
    restarts: 4,
    parallelRestarts,
    maxMs: 3_000,
    maxNodes: 200_000,
    logEveryNodes: 1,
    onProgress: (info) => {
      lastProgress = info;
    },
  });
  const elapsedMs = Date.now() - startedAt;
  return {
    parallel: parallelRestarts,
    solved: !!solved,
    elapsedMs,
    nodes: (lastProgress as { nodes?: number } | null)?.nodes ?? 0,
    nodesPerSec: (lastProgress as { nodesPerSec?: number } | null)?.nodesPerSec ?? 0,
    backtracks:
      (lastProgress as { stats?: { backtracks?: number } } | null)?.stats?.backtracks ?? 0,
    rejectForward:
      (lastProgress as { stats?: { rejectForward?: number } } | null)?.stats?.rejectForward ?? 0,
  };
}

function main(): void {
  if (!isNativeCspAvailable()) {
    console.log("solver csp perf smoke skipped (native csp solver not available)");
    return;
  }

  const runs = [1, 2, 4].map((parallel) => run(parallel));
  for (const stat of runs) {
    console.log(
      `csp perf: parallel=${stat.parallel} solved=${stat.solved ? "yes" : "no"} elapsed=${stat.elapsedMs}ms nodes=${stat.nodes} nps=${stat.nodesPerSec} backtracks=${stat.backtracks} rejectForward=${stat.rejectForward}`
    );
  }
}

main();
