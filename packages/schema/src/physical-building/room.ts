import { z } from "zod";

import { RoomTypeSchema } from "../enums/index.js";
import { IdentifierSchema } from "../primitives/index.js";
import {
  MeasurementSchema,
  OptionalDescriptionSchema,
  RequiredNameSchema
} from "./shared.js";

/**
 * Validates how a Room boundary traverses a referenced Wall.
 *
 * Direction is interpreted relative to the referenced Wall's persisted `start`
 * and `end` endpoints.
 */
export const RoomBoundaryDirectionSchema = z.enum(["FORWARD", "REVERSE"]);

/**
 * Validates one ordered and oriented wall reference in a persisted room boundary.
 */
export const RoomBoundaryEdgeSchema = z.strictObject({
  wallId: IdentifierSchema,
  direction: RoomBoundaryDirectionSchema
});

/**
 * Represents a functional architectural space within a Level.
 *
 * The canonical persisted boundary is ordered and oriented. Empty boundaries
 * are allowed for draft rooms; geometry-buildable rooms must provide at least
 * three boundary edges. Cross-reference, reference-consistency, and persisted
 * geometry validation are handled outside this structural schema.
 */
export const RoomSchema = z
  .strictObject({
    id: IdentifierSchema,
    name: RequiredNameSchema,
    type: RoomTypeSchema,
    description: OptionalDescriptionSchema,
    elevation: MeasurementSchema.optional(),
    boundary: z.array(RoomBoundaryEdgeSchema)
  })
  .refine((room) => room.boundary.length === 0 || room.boundary.length >= 3, {
    message: "Room boundary must be empty for drafts or contain at least three edges.",
    path: ["boundary"]
  })
  .refine((room) => new Set(room.boundary.map((edge) => edge.wallId)).size === room.boundary.length, {
    message: "Room boundary must not reference the same wall more than once.",
    path: ["boundary"]
  });

/**
 * Direction used by a Room while traversing a referenced Wall.
 */
export type RoomBoundaryDirection = z.infer<typeof RoomBoundaryDirectionSchema>;

/**
 * Ordered and oriented Wall reference inside a Room boundary.
 */
export type RoomBoundaryEdge = z.infer<typeof RoomBoundaryEdgeSchema>;

/**
 * Functional space owned by a Level.
 */
export type Room = z.infer<typeof RoomSchema>;
