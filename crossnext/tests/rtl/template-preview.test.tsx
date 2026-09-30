import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TemplatePreview } from "@/components/template-generator/TemplatePreview";
import type { GenerationResult } from "@/components/template-generator/types";

afterEach(cleanup);

describe("template preview arrows", () => {
  it("distinguishes a diagonal single arrow from a real double arrow by FSH code", () => {
    const result: GenerationResult = {
      id: "fixture",
      jobId: "job",
      ordinal: 1,
      grid: { rows: 1, cols: 2, data: ["↘↘"], codes: [[0x07, 0x0a]] },
      metrics: {
        slotCount: 0,
        intersections: 0,
        averageIntersections: 0,
        lengthDistribution: {},
        pictureBounds: [],
        cutoutOrientation: "none",
        dictionaryVerified: true,
      },
    };
    render(<TemplatePreview result={result} />);
    const glyphs = [...screen.getByRole("img").querySelectorAll("text")].map((element) => element.textContent);
    expect(glyphs).toEqual(["↘", "→", "↓"]);
  });
});
