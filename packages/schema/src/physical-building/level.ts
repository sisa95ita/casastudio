import { z } from "zod";

import { IdentifierSchema } from "../primitives";
import { RoomSchema } from "./room";
import { MeasurementSchema, RequiredNameSchema } from "./shared";
import { WallSchema } from "./wall";

export const LevelSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  elevation: MeasurementSchema,
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  staircases: z.tuple([])
});

export type Level = z.infer<typeof LevelSchema>;
