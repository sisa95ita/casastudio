import { z } from "zod";

/**
 * Validates the canonical project measurement units for the MVP schema.
 *
 * Persisted geometry is expressed in centimeters and persisted angles in degrees;
 * renderers or geometry adapters may convert units internally.
 */
export const UnitsSchema = z.object({
  length: z.literal("cm"),
  angle: z.literal("deg")
});

/**
 * Explicit measurement units declared by a Project.
 */
export type Units = z.infer<typeof UnitsSchema>;
