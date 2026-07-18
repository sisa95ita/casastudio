import { z } from "zod";

/**
 * Stable vocabulary for concrete architectural openings supported by the MVP.
 */
export const OpeningTypeValues = ["DOOR", "WINDOW"] as const;

/**
 * Validates the discriminant used to distinguish Door and Window openings.
 */
export const OpeningTypeSchema = z.enum(OpeningTypeValues);

/**
 * Concrete type of an Opening owned by a Wall.
 */
export type OpeningType = z.infer<typeof OpeningTypeSchema>;
