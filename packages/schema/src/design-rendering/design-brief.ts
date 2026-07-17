import { z } from "zod";

import { CommonMetadataSchema } from "../primitives";

const NonEmptyStringSchema = z.string().min(1);

export const DesignBriefSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  promptText: NonEmptyStringSchema,
  style: NonEmptyStringSchema.optional(),
  constraints: z.array(NonEmptyStringSchema),
  palette: z.array(NonEmptyStringSchema),
  referenceAssetRefs: z.array(NonEmptyStringSchema),
  notes: NonEmptyStringSchema.optional()
});

export type DesignBrief = z.infer<typeof DesignBriefSchema>;
