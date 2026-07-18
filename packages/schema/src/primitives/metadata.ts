import { z } from "zod";

import { IdentifierSchema } from "./identifier";

/**
 * Shared identity and descriptive metadata used by named domain entities.
 *
 * This keeps optional naming conventions consistent for objects such as
 * staircases, viewpoints, base images, design briefs, and render artifacts.
 */
export const CommonMetadataSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional()
});

/**
 * Common identity metadata shared by multiple CasaStudio domain entities.
 */
export type CommonMetadata = z.infer<typeof CommonMetadataSchema>;
