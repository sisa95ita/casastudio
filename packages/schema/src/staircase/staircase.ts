import { z } from "zod";

import { CommonMetadataSchema, IdentifierSchema } from "../primitives";
import { StairFlightSchema } from "./stair-flight";
import { StairLandingSchema } from "./stair-landing";

const PositiveMeasurementSchema = z.number().finite().positive();

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

export type Staircase = z.infer<typeof StaircaseSchema>;
