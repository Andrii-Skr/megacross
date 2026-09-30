import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TemplateResultsGallery from "@/components/template-generator/TemplateResultsGallery";
import type { GenerationResult } from "@/components/template-generator/types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("react-virtuoso", () => ({
  VirtuosoGrid: ({ totalCount, itemContent }: { totalCount: number; itemContent: (index: number) => ReactNode }) => (
    <div>{Array.from({ length: totalCount }, (_, index) => itemContent(index))}</div>
  ),
}));

afterEach(cleanup);

describe("template result gallery", () => {
  it("counts only real double-arrow codes, not diagonal single-arrow code 07", () => {
    const result: GenerationResult = {
      id: "result",
      jobId: "job",
      ordinal: 1,
      grid: { rows: 1, cols: 3, data: ["↘↘↘"], codes: [[0x07, 0x0a, 0x11]] },
      metrics: {
        slotCount: 3,
        intersections: 0,
        averageIntersections: 0,
        lengthDistribution: {},
        pictureBounds: [],
        cutoutOrientation: "none",
        dictionaryVerified: true,
      },
    };
    render(
      <TemplateResultsGallery
        items={[result]}
        selected={new Set()}
        rejected={new Set()}
        onSelectedChange={() => undefined}
        onReject={() => undefined}
      />,
    );
    expect(screen.getByText(/doubleArrows:/).textContent).toContain("2");
  });
});
