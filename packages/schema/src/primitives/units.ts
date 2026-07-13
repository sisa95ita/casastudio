import { z } from "zod";

export const UnitsSchema = z.object({
  length: z.literal("cm"),
  angle: z.literal("deg")
});

export type Units = z.infer<typeof UnitsSchema>;
