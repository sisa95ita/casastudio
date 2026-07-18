import { z } from "zod";

import { CommonMetadataSchema, Point2DSchema, PositiveNumberSchema } from "../primitives";

const PositiveMeasurementSchema = PositiveNumberSchema;
const ElevationSchema = z.number();

/**
 * Represents an architectural landing within a Staircase layout.
 *
 * The landing is persisted as domain input; any renderable surface generated
 * from it belongs to the Geometry Engine.
 */
export const StairLandingSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  position: Point2DSchema,
  width: PositiveMeasurementSchema,
  depth: PositiveMeasurementSchema,
  elevation: ElevationSchema
});

/**
 * Persisted staircase landing with position, dimensions, and elevation.
 */
export type StairLanding = z.infer<typeof StairLandingSchema>;
