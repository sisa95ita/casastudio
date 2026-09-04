import { z } from "zod";

import { RoomTypeSchema } from "../enums/index.js";
import { IdentifierSchema, Point2DSchema } from "../primitives/index.js";
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
export const WallRoomBoundaryEdgeSchema = z.strictObject({
  wallId: IdentifierSchema,
  direction: RoomBoundaryDirectionSchema
});

/**
 * Validates one directed geometric Room boundary segment without a Wall.
 *
 * A free segment closes a walkable floor footprint but carries no Wall,
 * opening, guard, or structural-support meaning.
 */
export const FreeRoomBoundaryEdgeSchema = z
  .strictObject({
    kind: z.literal("FREE"),
    wallId: z.never().optional(),
    direction: z.never().optional(),
    start: Point2DSchema,
    end: Point2DSchema
  })
  .refine(
    (edge) => edge.start.x !== edge.end.x || edge.start.z !== edge.end.z,
    { message: "Free Room boundary start and end points must not be identical.", path: ["end"] }
  );

/** Validates one ordered Room boundary segment. */
export const RoomBoundaryEdgeSchema = z.union([
  WallRoomBoundaryEdgeSchema,
  FreeRoomBoundaryEdgeSchema
]);

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
  .refine((room) => {
    const wallIds = room.boundary.flatMap((edge) => "wallId" in edge ? [edge.wallId] : []);
    return new Set(wallIds).size === wallIds.length;
  }, {
    message: "Room boundary must not reference the same wall more than once.",
    path: ["boundary"]
  })
  .refine((room) => {
    const freeEdgeKeys = room.boundary.flatMap((edge) => {
      if (!("kind" in edge) || edge.kind !== "FREE") return [];
      const start = `${edge.start.x}:${edge.start.z}`;
      const end = `${edge.end.x}:${edge.end.z}`;
      return [start < end ? `${start}|${end}` : `${end}|${start}`];
    });
    return new Set(freeEdgeKeys).size === freeEdgeKeys.length;
  }, {
    message: "Room boundary must not contain duplicate free segments.",
    path: ["boundary"]
  });

/**
 * Direction used by a Room while traversing a referenced Wall.
 */
export type RoomBoundaryDirection = z.infer<typeof RoomBoundaryDirectionSchema>;

/** Ordered and oriented Wall reference inside a Room boundary. */
export type WallRoomBoundaryEdge = z.infer<typeof WallRoomBoundaryEdgeSchema>;

/** Directed geometric Room boundary segment that is not a Wall. */
export type FreeRoomBoundaryEdge = z.infer<typeof FreeRoomBoundaryEdgeSchema>;

/** Ordered directed segment in a Room boundary, backed by a Wall or free geometry. */
export type RoomBoundaryEdge = z.infer<typeof RoomBoundaryEdgeSchema>;

/** Identifies a Wall-backed Room boundary segment. */
export function isWallRoomBoundaryEdge(
  edge: RoomBoundaryEdge
): edge is WallRoomBoundaryEdge {
  return "wallId" in edge;
}

/** Identifies a free geometric Room boundary segment. */
export function isFreeRoomBoundaryEdge(
  edge: RoomBoundaryEdge
): edge is FreeRoomBoundaryEdge {
  return "kind" in edge && edge.kind === "FREE";
}

/**
 * Functional space owned by a Level.
 */
export type Room = z.infer<typeof RoomSchema>;
