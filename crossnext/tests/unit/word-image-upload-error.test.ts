import { describe, expect, it, vi } from "vitest";
import { formatWordImageUploadError } from "@/components/scanwords/workspace/wordImageUploadError";

describe("formatWordImageUploadError", () => {
  it("formats structured aspect-ratio details", () => {
    const t = vi.fn((key: string) => key);

    expect(
      formatWordImageUploadError(
        {
          errorCode: "UPLOAD_IMAGE_BAD_RATIO",
          details: {
            imageWidth: 400,
            imageHeight: 500,
            targetWidth: 4,
            targetHeight: 4,
            tolerancePercent: 8,
          },
        },
        t,
        "fallback",
      ),
    ).toBe("scanwordsImageBadRatio");
    expect(t).toHaveBeenCalledWith("scanwordsImageBadRatio", {
      imageWidth: 400,
      imageHeight: 500,
      targetWidth: 4,
      targetHeight: 4,
      tolerance: 8,
    });
  });

  it("uses localized messages for known processing failures", () => {
    const t = vi.fn((key: string) => key);

    expect(formatWordImageUploadError({ errorCode: "UPLOAD_IMAGE_DIMENSIONS_INVALID" }, t, "fallback")).toBe(
      "scanwordsImageInvalidFile",
    );
    expect(formatWordImageUploadError({ errorCode: "UPLOAD_IMAGE_PROCESSOR_UNAVAILABLE" }, t, "fallback")).toBe(
      "scanwordsImageProcessorUnavailable",
    );
  });
});
