import { z } from "zod";

import { IdentifierSchema } from "../primitives/index.js";
import {
  IdentifierArraySchema,
  MeasurementSchema,
  OptionalDescriptionSchema,
  OptionalNameSchema,
  PositiveMeasurementSchema
} from "./shared.js";

/** Minimum clear distance required between Opening spans and Wall endpoints. */
export const openingEndpointClearance = 0;

/** Minimum clear distance required between adjacent Opening spans; touching is valid. */
export const openingAdjacentClearance = 0;

const OpeningBaseSchema = z.strictObject({
  id: IdentifierSchema,
  name: OptionalNameSchema,
  description: OptionalDescriptionSchema,
  offsetFromStart: MeasurementSchema,
  width: PositiveMeasurementSchema,
  height: PositiveMeasurementSchema,
  elevation: MeasurementSchema.nonnegative()
});

/** Door hinge endpoint relative to the owning Wall's canonical direction. */
export const DoorHingeSideSchema = z.enum(["START", "END"]);

/** Side of the owning Wall on which a Door leaf swings when opening. */
export const DoorSwingSideSchema = z.enum(["LEFT", "RIGHT"]);

/**
 * Represents a passage Opening in a Wall.
 *
 * Door connectivity is functional navigation metadata; the Wall remains the
 * physical owner of the Opening.
 */
export const DoorSchema = OpeningBaseSchema.extend({
  type: z.literal("DOOR"),
  hingeSide: DoorHingeSideSchema.optional(),
  swingSide: DoorSwingSideSchema.optional(),
  connectedRoomIds: IdentifierArraySchema.optional()
});

/**
 * Represents a window Opening in a Wall.
 *
 * Windows are associated with Rooms only through the Wall they belong to.
 */
export const WindowSchema = OpeningBaseSchema.extend({
  type: z.literal("WINDOW")
});

/**
 * Represents an unadorned passage through a Wall.
 *
 * Wall Openings use the shared physical-fit contract without Door navigation
 * metadata or Window glazing semantics.
 */
export const WallOpeningSchema = OpeningBaseSchema.extend({
  type: z.literal("OPENING")
});

/**
 * Discriminated schema for architectural openings owned by Walls.
 */
export const OpeningSchema = z.discriminatedUnion("type", [
  DoorSchema,
  WindowSchema,
  WallOpeningSchema
]);

/**
 * Door opening with optional connected-room references.
 */
export type Door = z.infer<typeof DoorSchema>;

/** Stable Door hinge semantics relative to canonical Wall start and end. */
export type DoorHingeSide = z.infer<typeof DoorHingeSideSchema>;

/** Stable Door swing semantics relative to the canonical Wall's left/right normal. */
export type DoorSwingSide = z.infer<typeof DoorSwingSideSchema>;

/**
 * Window opening owned by a Wall.
 */
export type Window = z.infer<typeof WindowSchema>;

/** Unadorned passage Opening owned by a Wall. */
export type WallOpening = z.infer<typeof WallOpeningSchema>;

/**
 * Architectural opening owned by a Wall.
 */
export type Opening = z.infer<typeof OpeningSchema>;

/** Canonical horizontal interval occupied by an Opening along its Wall. */
export type OpeningInterval = {
  readonly start: number;
  readonly end: number;
};

/** Derives the authoritative Wall-local interval for an Opening. */
export const getOpeningInterval = (
  opening: Pick<Opening, "offsetFromStart" | "width">
): OpeningInterval => ({
  start: opening.offsetFromStart,
  end: opening.offsetFromStart + opening.width
});
