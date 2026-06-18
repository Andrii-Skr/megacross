import { describe, expect, it } from "vitest";
import { DEFAULT_FILL_SETTINGS, normalizeFillSettings } from "@/components/scanwords/workspace/model";

describe("scanword fill settings", () => {
  it("defaults SVG clue typography percentages to 80", () => {
    expect(normalizeFillSettings(null)).toMatchObject({
      clueGlyphWidthPct: 80,
      clueLineHeightPct: 80,
      svgPhotoCluesGrayscale: true,
    });
  });

  it("defaults SVG clue font sizes to base 9 and minimum 7.6", () => {
    expect(normalizeFillSettings(null)).toMatchObject({
      clueFontBasePt: 9,
      clueFontMinPt: 7.6,
    });
  });

  it("clamps SVG clue typography percentages to supported bounds", () => {
    expect(
      normalizeFillSettings({
        clueGlyphWidthPct: 12,
        clueLineHeightPct: 260,
      }),
    ).toMatchObject({
      clueGlyphWidthPct: 40,
      clueLineHeightPct: 200,
    });
  });

  it("preserves fractional SVG clue font sizes", () => {
    expect(
      normalizeFillSettings({
        clueFontBasePt: 7.6,
        clueFontMinPt: 6.4,
      }),
    ).toMatchObject({
      clueFontBasePt: 7.6,
      clueFontMinPt: 6.4,
    });
  });

  it("falls back to default SVG clue typography percentages for invalid values", () => {
    expect(
      normalizeFillSettings({
        clueGlyphWidthPct: Number.NaN,
        clueLineHeightPct: "bad",
      }),
    ).toMatchObject({
      clueGlyphWidthPct: DEFAULT_FILL_SETTINGS.clueGlyphWidthPct,
      clueLineHeightPct: DEFAULT_FILL_SETTINGS.clueLineHeightPct,
    });
  });

  it("normalizes photo clue mode from persisted values", () => {
    expect(
      normalizeFillSettings({
        photoCluesGrayscale: false,
      }),
    ).toMatchObject({
      svgPhotoCluesGrayscale: false,
    });
  });
});
