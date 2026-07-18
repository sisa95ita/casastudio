import { z } from "zod";

const CoordinateSchema = z.number();

/**
 * Validates a point on the XZ blueprint plane.
 *
 * Physical floor-plan geometry uses X for horizontal position and Z for depth,
 * with elevation represented separately where needed.
 */
export const Point2DSchema = z.object({
  x: CoordinateSchema,
  z: CoordinateSchema
});

/**
 * Validates a point in CasaStudio's right-handed XYZ space.
 *
 * Viewpoints and derived spatial concepts use Y as elevation, matching the
 * repository spatial-coordinate conventions.
 */
export const Point3DSchema = z.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  z: CoordinateSchema
});

/**
 * Point on the local XZ blueprint plane.
 */
export type Point2D = z.infer<typeof Point2DSchema>;

/**
 * Point in the local or derived XYZ spatial frame.
 */
export type Point3D = z.infer<typeof Point3DSchema>;
