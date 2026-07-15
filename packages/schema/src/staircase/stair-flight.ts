import { z } from "zod";

import { CommonMetadataSchema, Point2DSchema, PositiveIntegerSchema, PositiveNumberSchema } from "../primitives";

const PositiveMeasurementSchema = PositiveNumberSchema;
const ElevationSchema = z.number();

export const StairFlightSchema = z
  .strictObject({
    ...CommonMetadataSchema.shape,
    start: Point2DSchema,
    end: Point2DSchema,
    width: PositiveMeasurementSchema,
    stepCount: PositiveIntegerSchema,
    startElevation: ElevationSchema,
    endElevation: ElevationSchema
  })
  .refine((flight) => flight.start.x !== flight.end.x || flight.start.z !== flight.end.z, {
    message: "Stair flight start and end points must not be identical.",
    path: ["end"]
  })
  .refine((flight) => flight.endElevation > flight.startElevation, {
    message: "Stair flight end elevation must be greater than start elevation.",
    path: ["endElevation"]
  });

export type StairFlight = z.infer<typeof StairFlightSchema>;
