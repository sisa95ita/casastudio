import { z } from "zod";

import { RoomTypeSchema } from "../enums";
import { IdentifierSchema } from "../primitives";
import {
  MeasurementSchema,
  OptionalDescriptionSchema,
  RequiredNameSchema
} from "./shared";

export const RoomBoundaryDirectionSchema = z.enum(["FORWARD", "REVERSE"]);

export const RoomBoundaryEdgeSchema = z.strictObject({
  wallId: IdentifierSchema,
  direction: RoomBoundaryDirectionSchema
});

/**
 * Represents a functional architectural space within a Level.
 *
 * Room boundaries are referenced through level-scoped Walls; geometric
 * renderability and boundary correctness are validated outside this schema.
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

export type RoomBoundaryDirection = z.infer<typeof RoomBoundaryDirectionSchema>;

export type RoomBoundaryEdge = z.infer<typeof RoomBoundaryEdgeSchema>;

/**
 * Functional space owned by a Level.
 */
export type Room = z.infer<typeof RoomSchema>;
