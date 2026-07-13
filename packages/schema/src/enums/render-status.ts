import { z } from "zod";

export const RenderStatusValues = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

export const RenderStatusSchema = z.enum(RenderStatusValues);

export type RenderStatus = z.infer<typeof RenderStatusSchema>;
