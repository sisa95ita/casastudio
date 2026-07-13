import { z } from "zod";

export const IdentifierSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type Identifier = z.infer<typeof IdentifierSchema>;
