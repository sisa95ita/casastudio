import { z } from "zod";

/**
 * Stable vocabulary for the real property type represented by a Building.
 */
export const BuildingTypeValues = ["HOUSE", "APARTMENT", "VILLA", "OFFICE", "OTHER"] as const;

/**
 * Validates the supported Building type vocabulary for the MVP domain model.
 */
export const BuildingTypeSchema = z.enum(BuildingTypeValues);

/**
 * CasaStudio Building classification.
 */
export type BuildingType = z.infer<typeof BuildingTypeSchema>;
