import type { Units } from "./units.js";

/** Metric length units available at the display and conversion boundary. */
export type MetricLengthUnit = Units["length"] | "m";

/** Stable precision used by architectural length and area labels. */
export const architecturalMeasurementPrecision = Object.freeze({
  lengthDecimalPlaces: 2,
  areaDecimalPlaces: 2
});

/** Converts a physical length without changing its canonical source value. */
export function convertPhysicalLength(
  value: number,
  sourceUnit: MetricLengthUnit,
  targetUnit: MetricLengthUnit
): number {
  if (sourceUnit === targetUnit) return value;
  return sourceUnit === "cm" ? value / 100 : value * 100;
}

/** Converts a physical area between squared metric length units. */
export function convertPhysicalArea(
  value: number,
  sourceUnit: MetricLengthUnit,
  targetUnit: MetricLengthUnit
): number {
  const linearFactor = convertPhysicalLength(1, sourceUnit, targetUnit);
  return value * linearFactor * linearFactor;
}

/** Rounds a finite display value and removes negative zero and binary noise. */
export function normalizeDisplayValue(value: number, decimalPlaces: number): number {
  if (!Number.isFinite(value)) return value;
  const safePlaces = Math.max(0, Math.trunc(decimalPlaces));
  const factor = 10 ** safePlaces;
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Formats a display value with controlled precision and optional trailing zeroes. */
export function formatDisplayValue(
  value: number,
  decimalPlaces: number,
  preserveTrailingZeroes = false
): string {
  const normalized = normalizeDisplayValue(value, decimalPlaces);
  if (!Number.isFinite(normalized)) return String(normalized);
  return preserveTrailingZeroes
    ? normalized.toFixed(Math.max(0, Math.trunc(decimalPlaces)))
    : String(normalized);
}

/** Formats a canonical Project length as an architectural metric label. */
export function formatArchitecturalLength(
  value: number,
  projectLengthUnit: Units["length"]
): string {
  const meters = convertPhysicalLength(value, projectLengthUnit, "m");
  return `${formatDisplayValue(
    meters,
    architecturalMeasurementPrecision.lengthDecimalPlaces,
    true
  )} m`;
}

/** Formats a canonical Project area as an architectural square-metre label. */
export function formatArchitecturalArea(
  value: number,
  projectLengthUnit: Units["length"]
): string {
  const squareMeters = convertPhysicalArea(value, projectLengthUnit, "m");
  return `${formatDisplayValue(
    squareMeters,
    architecturalMeasurementPrecision.areaDecimalPlaces,
    true
  )} m²`;
}
