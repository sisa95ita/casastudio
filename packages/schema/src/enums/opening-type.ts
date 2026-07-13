import { z } from "zod";

export const OpeningTypeValues = ["DOOR", "WINDOW"] as const;

export const OpeningTypeSchema = z.enum(OpeningTypeValues);

export type OpeningType = z.infer<typeof OpeningTypeSchema>;
