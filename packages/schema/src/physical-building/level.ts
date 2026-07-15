import { z } from "zod";

import { IdentifierSchema } from "../primitives";
import { StaircaseSchema } from "../staircase";
import { RoomSchema } from "./room";
import { MeasurementSchema, RequiredNameSchema } from "./shared";
import { WallSchema } from "./wall";

export const LevelSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  elevation: MeasurementSchema,
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  staircases: z.array(StaircaseSchema)
});

export type Level = z.infer<typeof LevelSchema>;
