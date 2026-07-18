import { z } from "zod";

import { IdentifierSchema } from "../primitives";
import {
  IdentifierArraySchema,
  MeasurementSchema,
  OptionalDescriptionSchema,
  OptionalNameSchema
} from "./shared";

const OpeningBaseSchema = z.strictObject({
  id: IdentifierSchema,
  name: OptionalNameSchema,
  description: OptionalDescriptionSchema,
  offsetFromStart: MeasurementSchema,
  width: MeasurementSchema,
  height: MeasurementSchema,
  elevation: MeasurementSchema
});

/**
 * Represents a passage Opening in a Wall.
 *
 * Door connectivity is functional navigation metadata; the Wall remains the
 * physical owner of the Opening.
 */
export const DoorSchema = OpeningBaseSchema.extend({
  type: z.literal("DOOR"),
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
 * Discriminated schema for architectural openings owned by Walls.
 */
export const OpeningSchema = z.discriminatedUnion("type", [DoorSchema, WindowSchema]);

/**
 * Door opening with optional connected-room references.
 */
export type Door = z.infer<typeof DoorSchema>;

/**
 * Window opening owned by a Wall.
 */
export type Window = z.infer<typeof WindowSchema>;

/**
 * Architectural opening represented as either a Door or a Window.
 */
export type Opening = z.infer<typeof OpeningSchema>;
