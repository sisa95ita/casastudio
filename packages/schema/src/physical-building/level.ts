import { z } from "zod";

import { IdentifierSchema } from "../primitives/index.js";
import { StaircaseSchema } from "../staircase/index.js";
import { RoomSchema } from "./room.js";
import { MeasurementSchema, RequiredNameSchema } from "./shared.js";
import { WallSchema } from "./wall.js";

/**
 * Represents a vertical organizational layer of a Building.
 *
 * A Level owns its Rooms, Walls, and Staircases and provides their local XZ
 * coordinate space and elevation within the Building.
 */
export const LevelSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  elevation: MeasurementSchema,
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  staircases: z.array(StaircaseSchema)
});

/**
 * Building level containing level-scoped physical entities.
 */
export type Level = z.infer<typeof LevelSchema>;
