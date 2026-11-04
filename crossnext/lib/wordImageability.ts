/** Missing values in older pending cards must preserve the existing word flag. */
export function pendingImageability(note: string | null | undefined): boolean | undefined {
  try {
    const value: unknown = JSON.parse(note ?? "");
    if (value && typeof value === "object" && "isImageable" in value && typeof value.isImageable === "boolean") {
      return value.isImageable;
    }
  } catch {}
  return undefined;
}
