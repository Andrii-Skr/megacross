type TranslationValues = Record<string, string | number>;

type Translate = (key: string, values?: TranslationValues) => string;

export type WordImageUploadErrorPayload = {
  errorCode?: string;
  details?: {
    imageWidth?: number;
    imageHeight?: number;
    targetWidth?: number;
    targetHeight?: number;
    tolerancePercent?: number;
  };
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function formatWordImageUploadError(
  payload: WordImageUploadErrorPayload,
  t: Translate,
  fallbackKey: string,
): string {
  const details = payload.details;
  if (
    payload.errorCode === "UPLOAD_IMAGE_BAD_RATIO" &&
    isPositiveNumber(details?.imageWidth) &&
    isPositiveNumber(details.imageHeight) &&
    isPositiveNumber(details.targetWidth) &&
    isPositiveNumber(details.targetHeight)
  ) {
    return t("scanwordsImageBadRatio", {
      imageWidth: details.imageWidth,
      imageHeight: details.imageHeight,
      targetWidth: details.targetWidth,
      targetHeight: details.targetHeight,
      tolerance: isPositiveNumber(details.tolerancePercent) ? details.tolerancePercent : 8,
    });
  }

  if (payload.errorCode === "UPLOAD_UNSUPPORTED_IMAGE_FORMAT") {
    return t("scanwordsImageUnsupportedFormat");
  }
  if (payload.errorCode === "UPLOAD_IMAGE_DIMENSIONS_INVALID") {
    return t("scanwordsImageInvalidFile");
  }
  if (payload.errorCode === "UPLOAD_IMAGE_PROCESSOR_UNAVAILABLE") {
    return t("scanwordsImageProcessorUnavailable");
  }
  if (payload.errorCode === "UPLOAD_FILE_TOO_LARGE") {
    return t("scanwordsImageTooLarge");
  }
  if (payload.errorCode === "UPLOAD_FORM_INVALID" || payload.errorCode === "UPLOAD_FILE_READ_FAILED") {
    return t("scanwordsImageRequestInvalid");
  }
  if (payload.errorCode === "UPLOAD_STORAGE_WRITE_FAILED") {
    return t("scanwordsImageStorageError");
  }
  if (payload.errorCode === "UPLOAD_DB_READ_FAILED" || payload.errorCode === "UPLOAD_DB_WRITE_FAILED") {
    return t("scanwordsImageDatabaseError");
  }
  if (payload.errorCode === "WORD_IMAGE_STORAGE_NOT_READY") {
    return t("scanwordsImageStorageNotReady");
  }

  return t(fallbackKey);
}
