import type { Prisma, PrismaClient } from "@prisma/client";
import { loadEditionWordUsageByWord } from "./editionHotBan";
import { buildLenMeanUsagePriority, type UsageRebalanceMode } from "./usageRebalance";

type Dict = Map<number, string[]>;
type PrismaLike = PrismaClient | Prisma.TransactionClient;
type UsagePriorityMode = "safe" | "aggressive";

export type EditionUsageSnapshot = {
  usageByWord: Map<string, number>;
  priorityByWord: Map<string, number>;
  priorityMode: UsagePriorityMode;
};

export function resolveEditionUsagePriorityMode(
  usageRebalanceEnabled: boolean,
  usageRebalanceMode: UsageRebalanceMode
): UsagePriorityMode {
  if (!usageRebalanceEnabled) return "safe";
  return usageRebalanceMode === "aggressive" || usageRebalanceMode === "cost"
    ? "aggressive"
    : "safe";
}

export function buildEditionUsagePrioritySnapshot(
  dict: Dict,
  usageByWord: Map<string, number>,
  priorityMode: UsagePriorityMode
): Map<string, number> {
  if (!usageByWord.size) return new Map();
  return buildLenMeanUsagePriority(dict, usageByWord, priorityMode);
}

export async function loadEditionUsageSnapshot(
  dict: Dict,
  editionId: number,
  options: {
    usageRebalanceEnabled: boolean;
    usageRebalanceMode: UsageRebalanceMode;
    db?: PrismaLike;
  }
): Promise<EditionUsageSnapshot> {
  const usageByWord = await loadEditionWordUsageByWord(editionId, options.db);
  const priorityMode = resolveEditionUsagePriorityMode(
    options.usageRebalanceEnabled,
    options.usageRebalanceMode
  );
  const priorityByWord = buildEditionUsagePrioritySnapshot(dict, usageByWord, priorityMode);
  return {
    usageByWord,
    priorityByWord,
    priorityMode,
  };
}
