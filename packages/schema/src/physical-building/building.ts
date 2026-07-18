import { z } from "zod";

import { BuildingTypeSchema } from "../enums";
import { IdentifierSchema } from "../primitives";
import { LevelSchema } from "./level";
import { RequiredNameSchema } from "./shared";

/**
 * Represents the physical property modeled by a CasaStudio Project.
 *
 * The Building owns the Level hierarchy and remains the central source for
 * physical data consumed by future geometry and rendering layers.
 */
export const BuildingSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  type: BuildingTypeSchema,
  levels: z.array(LevelSchema)
});

/**
 * Physical property aggregate contained by a Project.
 */
export type Building = z.infer<typeof BuildingSchema>;
