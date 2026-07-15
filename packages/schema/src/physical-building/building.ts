import { z } from "zod";

import { BuildingTypeSchema } from "../enums";
import { IdentifierSchema } from "../primitives";
import { LevelSchema } from "./level";
import { RequiredNameSchema } from "./shared";

export const BuildingSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  type: BuildingTypeSchema,
  levels: z.array(LevelSchema)
});

export type Building = z.infer<typeof BuildingSchema>;
