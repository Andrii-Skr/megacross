const COREL_A4_WIDTH_UNITS = 2480;
const COREL_A4_WIDTH_MM = 210;
const COREL_A4_HEIGHT_UNITS = 3508;
export const COREL_UNITS_PER_MM = COREL_A4_WIDTH_UNITS / COREL_A4_WIDTH_MM;
export const COREL_MIN_SVG_WIDTH_UNITS = COREL_A4_WIDTH_UNITS;
export const COREL_MIN_SVG_HEIGHT_UNITS = COREL_A4_HEIGHT_UNITS;

export const formatCorelSizeMm = (units: number): string =>
  `${Math.round((units / COREL_UNITS_PER_MM) * 1000) / 1000}mm`;

export const DEFAULT_TEMPLATE_CELL_SIZE_MM = 11;
export const DEFAULT_ANSWER_CELL_SIZE_MM = 10;
export const DEFAULT_TYPE0_CELL_SIZE_MM = 8.5;

export type SvgCellSizesMm = {
  templateCellSizeMm: number;
  answerCellSizeMm: number;
  type0CellSizeMm: number;
};

function parseCellSizeMm(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid svgLayout.${fieldName}: expected a positive number`);
  }
  const rounded = Number(value.toFixed(3));
  if (rounded <= 0) {
    throw new Error(`Invalid svgLayout.${fieldName}: expected at least 0.001 mm`);
  }
  return rounded;
}

export function resolveSvgCellSizesMm(value: unknown): SvgCellSizesMm {
  if (value !== undefined && value !== null && typeof value !== "object") {
    throw new Error("Invalid svgLayout: expected an object");
  }
  const raw = (value as Record<string, unknown> | null | undefined) ?? {};
  return {
    templateCellSizeMm: parseCellSizeMm(
      raw.templateCellSizeMm,
      DEFAULT_TEMPLATE_CELL_SIZE_MM,
      "templateCellSizeMm",
    ),
    answerCellSizeMm: parseCellSizeMm(raw.answerCellSizeMm, DEFAULT_ANSWER_CELL_SIZE_MM, "answerCellSizeMm"),
    type0CellSizeMm: parseCellSizeMm(raw.type0CellSizeMm, DEFAULT_TYPE0_CELL_SIZE_MM, "type0CellSizeMm"),
  };
}

export const COREL_STROKE_WIDTH_PT = 0.4;
export const COREL_STROKE_WIDTH_MM = COREL_STROKE_WIDTH_PT * (25.4 / 72);
export const COREL_STROKE_WIDTH_UNITS =
  Math.round(COREL_STROKE_WIDTH_MM * COREL_UNITS_PER_MM * 1000) / 1000;

export const convertMmToCorelUnits = (mm: number): number =>
  Math.round(mm * COREL_UNITS_PER_MM * 1000) / 1000;

export const BLOCK_CELL_FILL = "#EBECEC";
export const CELL_STROKE_WIDTH = 2;
export const CELL_STROKE_COLOR = "#000000";
export const WORD_TEXT_FILL = "#393185";
export const CLUE_TEXT_FILL = "#000000";
