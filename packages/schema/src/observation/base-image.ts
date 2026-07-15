import { z } from "zod";

import { CommonMetadataSchema, IdentifierSchema, IsoDateTimeSchema, PositiveIntegerSchema } from "../primitives";

const AssetRefSchema = z.string().min(1);

export const BaseImageSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  viewpointId: IdentifierSchema,
  assetRef: AssetRefSchema,
  projectRevision: PositiveIntegerSchema,
  createdAt: IsoDateTimeSchema,
  width: PositiveIntegerSchema.optional(),
  height: PositiveIntegerSchema.optional()
});

export type BaseImage = z.infer<typeof BaseImageSchema>;
