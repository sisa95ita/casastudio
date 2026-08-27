import { z } from "zod";

/**
 * Stable vocabulary for concrete architectural openings.
 */
export const OpeningTypeValues = ["DOOR", "WINDOW", "OPENING"] as const;

/**
 * Validates the discriminant used to distinguish architectural Opening kinds.
 */
export const OpeningTypeSchema = z.enum(OpeningTypeValues);

/**
 * Concrete type of an Opening owned by a Wall.
 */
export type OpeningType = z.infer<typeof OpeningTypeSchema>;
