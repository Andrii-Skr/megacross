import { describe, expect, it } from "vitest";
import {
  sufficientTemplateQuality,
  templateSelectionScore,
} from "../../../cross/server/src/templateGenerator/selection";
import type { TemplateMetrics } from "../../../cross/server/src/templateGenerator/types";

const metrics: TemplateMetrics = {
  slotCount: 160,
  intersections: 360,
  averageIntersections: 4.5,
  lengthDistribution: {},
  pictureBounds: [],
  cutoutOrientation: "none",
  dictionaryVerified: false,
  qualityScore: 0.45,
  lengthDeviation: 0.2,
  repetition: 0.3,
  bottleneckShare: 0.01,
  edgeDirectionDeficit: 0,
};
const completed = { converged: true, constrainedShare: 0 };
describe("template candidate selection", () => {
  it("stops for a sufficiently balanced candidate only after completed propagation", () => {
    expect(sufficientTemplateQuality(metrics, completed)).toBe(true);
    expect(sufficientTemplateQuality(metrics)).toBe(false);
    expect(sufficientTemplateQuality(metrics, { ...completed, converged: false })).toBe(false);
    expect(sufficientTemplateQuality(metrics, { ...completed, constrainedShare: 0.1 })).toBe(false);
  });
  it.each([
    { qualityScore: 0.6 },
    { lengthDeviation: 0.3 },
    { repetition: 0.5 },
    { bottleneckShare: 0.1 },
    { edgeDirectionDeficit: 1 },
    { qualityScore: undefined },
    { qualityScore: NaN },
    { lengthDeviation: undefined },
  ])("continues comparison when quality is insufficient: %j", (override) => {
    expect(sufficientTemplateQuality({ ...metrics, ...override }, completed)).toBe(false);
  });
  it("uses propagation uncertainty and narrow domains when ranking comparable geometries", () => {
    const reliable = templateSelectionScore(metrics, completed);
    expect(templateSelectionScore(metrics, { ...completed, converged: false })).toBeGreaterThan(reliable);
    expect(templateSelectionScore(metrics, { ...completed, constrainedShare: 0.2 })).toBeGreaterThan(reliable);
  });
});
