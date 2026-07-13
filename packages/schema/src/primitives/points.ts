import { z } from "zod";

const CoordinateSchema = z.number();

export const Point2DSchema = z.object({
  x: CoordinateSchema,
  z: CoordinateSchema
});

export const Point3DSchema = z.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
  z: CoordinateSchema
});

export type Point2D = z.infer<typeof Point2DSchema>;
export type Point3D = z.infer<typeof Point3DSchema>;
