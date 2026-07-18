import { z } from "zod";

import { CommonMetadataSchema, IdentifierSchema, IsoDateTimeSchema, PositiveIntegerSchema } from "../primitives";

const AssetRefSchema = z.string().min(1);

/**
 * Represents an exported visual reference generated from a Viewpoint.
 *
 * BaseImages are derived artifacts stored at Project scope; they support
 * render requests but never become physical Building data.
 */
export const BaseImageSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  viewpointId: IdentifierSchema,
  assetRef: AssetRefSchema,
  projectRevision: PositiveIntegerSchema,
  createdAt: IsoDateTimeSchema,
  width: PositiveIntegerSchema.optional(),
  height: PositiveIntegerSchema.optional()
});

/**
 * Visual reference artifact derived from a saved Viewpoint.
 */
export type BaseImage = z.infer<typeof BaseImageSchema>;
