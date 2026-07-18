import { z } from "zod";

import { CommonMetadataSchema } from "../primitives";

const NonEmptyStringSchema = z.string().min(1);

/**
 * Represents provider-independent design intent for an exploration.
 *
 * A DesignBrief captures the user's prompt, constraints, palette, and references
 * without embedding provider-specific payloads or SDK concepts.
 */
export const DesignBriefSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  promptText: NonEmptyStringSchema,
  style: NonEmptyStringSchema.optional(),
  constraints: z.array(NonEmptyStringSchema),
  palette: z.array(NonEmptyStringSchema),
  referenceAssetRefs: z.array(NonEmptyStringSchema),
  notes: NonEmptyStringSchema.optional()
});

/**
 * Structured design intent used as input to RenderRequests.
 */
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
