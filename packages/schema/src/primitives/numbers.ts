import { z } from "zod";

/**
 * Validates positive numeric values used for measurements and bounded domain values.
 */
export const PositiveNumberSchema = z.number().positive();

/**
 * Validates positive whole-number values such as revisions, counts, and image dimensions.
 */
export const PositiveIntegerSchema = z.number().int().positive();

/**
 * Positive numeric value used where CasaStudio allows decimal precision.
 */
export type PositiveNumber = z.infer<typeof PositiveNumberSchema>;

/**
 * Positive integer value used for count-like and version-like project data.
 */
export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;
