import { z } from "zod";

export const BuildingTypeValues = ["HOUSE", "APARTMENT", "VILLA", "OFFICE", "OTHER"] as const;

export const BuildingTypeSchema = z.enum(BuildingTypeValues);

export type BuildingType = z.infer<typeof BuildingTypeSchema>;
