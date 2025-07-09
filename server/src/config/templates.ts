export interface GridSize { rows: number; cols: number }

/**
 * Карта: ASCII‑код из заголовка файла → размеры сетки.
 * Добавляйте сюда новые шаблоны по мере появления.
 */
export const TEMPLATE_MAP: Record<string, GridSize> = {
  /** "2GO" (0x32 0x47 0x4F) → 23 × 31 */
  "2GO": { rows: 23, cols: 31 },
};

export function getGridSize(templateId: string): GridSize {
  const size = TEMPLATE_MAP[templateId];
  if (!size) {
    throw new Error(`Неизвестный шаблон: ${templateId}`);
  }
  return size;
}
