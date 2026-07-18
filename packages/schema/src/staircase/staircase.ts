import { z } from "zod";

import { CommonMetadataSchema, IdentifierSchema } from "../primitives";
import { StairFlightSchema } from "./stair-flight";
import { StairLandingSchema } from "./stair-landing";

const PositiveMeasurementSchema = z.number().finite().positive();

/**
 * Represents vertical circulation between Levels and optional Rooms.
 *
 * Staircases preserve architectural connection intent while detailed renderable
 * geometry is derived later from flights, landings, and spatial references.
 */
export const StaircaseSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  fromLevelId: IdentifierSchema,
  toLevelId: IdentifierSchema,
  fromRoomId: IdentifierSchema.optional(),
  toRoomId: IdentifierSchema.optional(),
  width: PositiveMeasurementSchema,
  flights: z.array(StairFlightSchema),
  landings: z.array(StairLandingSchema)
});

/**
 * Independent architectural staircase entity owned by a Level.
 */
export type Staircase = z.infer<typeof StaircaseSchema>;
