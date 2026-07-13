import { z } from "zod";

import { IdentifierSchema } from "./identifier";

export const CommonMetadataSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional()
});

export type CommonMetadata = z.infer<typeof CommonMetadataSchema>;
