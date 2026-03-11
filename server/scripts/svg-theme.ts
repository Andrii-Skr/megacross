const COREL_A4_WIDTH_UNITS = 2480;
const COREL_A4_WIDTH_MM = 210;
const COREL_A4_HEIGHT_UNITS = 3508;
export const COREL_UNITS_PER_MM = COREL_A4_WIDTH_UNITS / COREL_A4_WIDTH_MM;
export const COREL_MIN_SVG_WIDTH_UNITS = COREL_A4_WIDTH_UNITS;
export const COREL_MIN_SVG_HEIGHT_UNITS = COREL_A4_HEIGHT_UNITS;

export const formatCorelSizeMm = (units: number): string =>
  `${Math.round((units / COREL_UNITS_PER_MM) * 1000) / 1000}mm`;

export const COREL_CELL_SIZE_MM = 11;
export const COREL_STROKE_WIDTH_MM = 0.1;
export const COREL_CELL_SIZE_UNITS =
  Math.round(COREL_CELL_SIZE_MM * COREL_UNITS_PER_MM * 1000) / 1000;
export const COREL_STROKE_WIDTH_UNITS =
  Math.round(COREL_STROKE_WIDTH_MM * COREL_UNITS_PER_MM * 1000) / 1000;

export const BLOCK_CELL_FILL = "#EBECEC";
export const CELL_STROKE_WIDTH = 2;
export const CELL_STROKE_COLOR = "#2B2A29";
export const WORD_TEXT_FILL = "#393185";
export const CLUE_TEXT_FILL = "#2B2A29";
