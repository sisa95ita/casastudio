import { z } from "zod";
import { FurnitureItemSchema } from "../furniture/furniture.js";

import { BuildingTypeSchema } from "../enums/index.js";
import { IdentifierSchema } from "../primitives/index.js";
import { LevelSchema } from "./level.js";
import { RequiredNameSchema } from "./shared.js";

/**
 * Represents the physical property modeled by a CasaStudio Project.
 *
 * The Building owns the Level hierarchy and remains the central source for
 * physical data consumed by geometry and rendering layers. Furniture is stored
 * once in a Building-wide ordered collection; each item references its sole Room owner.
 */
export const BuildingSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  type: BuildingTypeSchema,
  levels: z.array(LevelSchema),
  furniture: z.array(FurnitureItemSchema)
});

/**
 * Physical property aggregate contained by a Project.
 */
export type Building = z.infer<typeof BuildingSchema>;
