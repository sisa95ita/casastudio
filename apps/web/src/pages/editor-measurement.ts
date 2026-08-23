/** Maximum decimal precision used by user-authored architectural measurements. */
export const editorMeasurementDecimalPlaces = 2;

/** Normalizes one finite user-authored measurement to the editor precision. */
export function normalizeEditorMeasurement(value: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** editorMeasurementDecimalPlaces;
  const normalized = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
  return Object.is(normalized, -0) ? 0 : normalized;
}

/** Formats one architectural measurement without insignificant trailing zeroes. */
export function formatEditorMeasurement(value: number): string {
  return String(normalizeEditorMeasurement(value));
}
