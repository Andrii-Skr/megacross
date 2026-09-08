import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { create, type Font, type FontCollection } from "fontkit";

export type TextWidthMeasure = (text: string, fontSize: number) => number;

export type SvgFontResource = {
  familyName: string;
  fontFaceCss: string;
  fontData: Uint8Array;
  measureTextWidth: TextWidthMeasure;
};

const BUNDLED_ARIMO_PATH = fileURLToPath(
  new URL("../assets/fonts/Arimo-Regular.ttf", import.meta.url)
);
const BUNDLED_ARIMO_FAMILY = "Arimo";
let bundledArimoResource: SvgFontResource | null = null;

function resolveFont(fontOrCollection: Font | FontCollection): Font {
  if ("fonts" in fontOrCollection) {
    const font = fontOrCollection.fonts[0];
    if (!font) throw new Error("Font collection is empty");
    return font;
  }
  return fontOrCollection;
}

export function createFontTextWidthMeasure(fontData: Uint8Array): TextWidthMeasure {
  const font = resolveFont(create(Buffer.from(fontData)));
  const unitsPerEm = Math.max(1, font.unitsPerEm);
  const advanceByText = new Map<string, number>();

  return (text: string, fontSize: number): number => {
    const normalizedText = text.trim();
    if (!normalizedText) return Math.max(1, fontSize * 0.62);
    let advance = advanceByText.get(normalizedText);
    if (advance == null) {
      advance = font.layout(normalizedText).advanceWidth;
      advanceByText.set(normalizedText, advance);
    }
    return Math.max(1, (advance / unitsPerEm) * fontSize);
  };
}

export function createSvgFontResource(
  familyName: string,
  fontData: Uint8Array,
  mimeType = "font/ttf",
  cssFormat = "truetype"
): SvgFontResource {
  const data = new Uint8Array(fontData);
  const escapedFamily = familyName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const encoded = Buffer.from(data).toString("base64");
  return {
    familyName,
    fontData: data,
    fontFaceCss: `@font-face{font-family:'${escapedFamily}';src:url('data:${mimeType};base64,${encoded}') format('${cssFormat}');font-weight:normal;font-style:normal;}`,
    measureTextWidth: createFontTextWidthMeasure(data),
  };
}

export function getBundledArimoFontResource(): SvgFontResource {
  if (!bundledArimoResource) {
    bundledArimoResource = createSvgFontResource(
      BUNDLED_ARIMO_FAMILY,
      readFileSync(BUNDLED_ARIMO_PATH)
    );
  }
  return bundledArimoResource;
}

export function shouldUseBundledArimo(fontFamily: string): boolean {
  const normalized = fontFamily.trim().replace(/["']/g, "").toLowerCase();
  return normalized === "arial" || normalized === "arimo";
}
