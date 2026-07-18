import { z } from "zod";

import { ProjectionTypeSchema } from "../enums";
import { CommonMetadataSchema, IdentifierSchema, Point3DSchema, PositiveNumberSchema } from "../primitives";

const FieldOfViewSchema = PositiveNumberSchema.lt(180);

/**
 * Represents a saved, reproducible observation of the Building.
 *
 * A Viewpoint belongs to a Level and may optionally identify a Room, while
 * preserving enough camera data to recreate the same visual perspective.
 */
export const ViewpointSchema = z
  .strictObject({
    ...CommonMetadataSchema.shape,
    levelId: IdentifierSchema,
    roomId: IdentifierSchema.optional(),
    cameraPosition: Point3DSchema,
    cameraTarget: Point3DSchema,
    fieldOfView: FieldOfViewSchema,
    projection: ProjectionTypeSchema
  })
  .refine(
    (viewpoint) =>
      viewpoint.cameraPosition.x !== viewpoint.cameraTarget.x ||
      viewpoint.cameraPosition.y !== viewpoint.cameraTarget.y ||
      viewpoint.cameraPosition.z !== viewpoint.cameraTarget.z,
    {
      message: "Viewpoint camera position and target must not be identical.",
      path: ["cameraTarget"]
    }
  );

/**
 * Saved camera perspective used to derive BaseImages and design-rendering inputs.
 */
export type Viewpoint = z.infer<typeof ViewpointSchema>;
