import { z } from "zod";

import { IdentifierSchema, Point2DSchema } from "../primitives";
import { OpeningSchema } from "./opening";
import {
  IdentifierArraySchema,
  OptionalDescriptionSchema,
  OptionalNameSchema,
  PositiveMeasurementSchema
} from "./shared";

export const WallSchema = z
  .strictObject({
    id: IdentifierSchema,
    name: OptionalNameSchema,
    description: OptionalDescriptionSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    height: PositiveMeasurementSchema,
    thickness: PositiveMeasurementSchema,
    roomIds: IdentifierArraySchema,
    openings: z.array(OpeningSchema)
  })
  .refine((wall) => wall.start.x !== wall.end.x || wall.start.z !== wall.end.z, {
    message: "Wall start and end points must not be identical.",
    path: ["end"]
  });

export type Wall = z.infer<typeof WallSchema>;
