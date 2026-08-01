import { z } from "zod";

import { IdentifierSchema, Point2DSchema } from "../primitives";
import { OpeningSchema } from "./opening";
import {
  IdentifierArraySchema,
  OptionalDescriptionSchema,
  OptionalNameSchema,
  PositiveMeasurementSchema
} from "./shared";

const WallRoomIdsSchema = IdentifierArraySchema.max(2, "A wall may reference at most two rooms.").refine(
  (roomIds) => new Set(roomIds).size === roomIds.length,
  {
    message: "A wall must not reference the same room more than once."
  }
);

/**
 * Represents a physical wall segment in Level coordinate space.
 *
 * Walls are the authoritative boundary elements for Rooms. `roomIds` is locally
 * constrained to at most two unique adjacent Rooms, while cross-reference and
 * bidirectional Room boundary consistency are handled by validation layers.
 */
export const WallSchema = z
  .strictObject({
    id: IdentifierSchema,
    name: OptionalNameSchema,
    description: OptionalDescriptionSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    height: PositiveMeasurementSchema,
    thickness: PositiveMeasurementSchema,
    roomIds: WallRoomIdsSchema,
    openings: z.array(OpeningSchema)
  })
  .refine((wall) => wall.start.x !== wall.end.x || wall.start.z !== wall.end.z, {
    message: "Wall start and end points must not be identical.",
    path: ["end"]
  });

/**
 * Level-scoped wall segment with associated Rooms and owned Openings.
 */
export type Wall = z.infer<typeof WallSchema>;
