import type { TemplateMetrics } from "./types";

type Fillability = { converged: boolean; constrainedShare: number };

/** Stop comparison only for a balanced candidate with a completed dictionary precheck. */
export function sufficientTemplateQuality(metrics: TemplateMetrics, check?: Fillability): boolean {
  return check?.converged === true && check.constrainedShare <= 0.05
    && Number.isFinite(metrics.qualityScore) && metrics.qualityScore! <= 0.45
    && Number.isFinite(metrics.lengthDeviation) && metrics.lengthDeviation! <= 0.25
    && Number.isFinite(metrics.repetition) && metrics.repetition! <= 0.45
    && Number.isFinite(metrics.bottleneckShare) && metrics.bottleneckShare! <= 0.02
    && metrics.edgeDirectionDeficit === 0;
}

/** Incomplete propagation is uncertain, never proof that a candidate cannot be filled. */
export function templateSelectionScore(metrics: TemplateMetrics, check?: Fillability): number {
  return (metrics.qualityScore ?? Infinity) + (check ? 0.2 * check.constrainedShare + (check.converged ? 0 : 0.15) : 0);
}
