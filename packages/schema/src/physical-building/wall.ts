import { z } from "zod";

import { IdentifierSchema, Point2DSchema } from "../primitives/index.js";
import { OpeningSchema } from "./opening.js";
import {
  IdentifierArraySchema,
  OptionalDescriptionSchema,
  OptionalNameSchema,
  PositiveMeasurementSchema
} from "./shared.js";

const WallRoomIdsSchema = IdentifierArraySchema.refine(
  (roomIds) => new Set(roomIds).size === roomIds.length,
  {
    message: "A wall must not reference the same room more than once."
  }
);

/**
 * Represents a physical wall segment in Level coordinate space.
 *
 * Walls may back Room boundaries at more than one floor elevation. `roomIds`
 * therefore preserves every unique reference, while semantic validation limits
 * adjacency to at most two Rooms within each global floor-elevation stratum.
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
