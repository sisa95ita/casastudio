import { z } from "zod";

import { CommonMetadataSchema, Point2DSchema, PositiveNumberSchema } from "../primitives";

const PositiveMeasurementSchema = PositiveNumberSchema;
const ElevationSchema = z.number();

export const StairLandingSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  position: Point2DSchema,
  width: PositiveMeasurementSchema,
  depth: PositiveMeasurementSchema,
  elevation: ElevationSchema
});

export type StairLanding = z.infer<typeof StairLandingSchema>;
