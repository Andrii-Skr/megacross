export type FillSolverEngine = "csp" | "dlx";
export const DEFAULT_FILL_SOLVER: FillSolverEngine = "csp";

export function resolveFillSolverEngine(value?: unknown, flags: { nativeDlx?: boolean; nativeCsp?: boolean } = {}): FillSolverEngine {
  const requested = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (requested === "dlx" || requested === "csp") return requested;
  if (flags.nativeCsp) return "csp";
  if (flags.nativeDlx) return "dlx";
  return DEFAULT_FILL_SOLVER;
}

export function fillSolverSearchProfile(engine: FillSolverEngine, firstSolution = false) {
  return { strongPropagation: engine === "csp", firstSolution };
}
