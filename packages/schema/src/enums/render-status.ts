import { z } from "zod";

/**
 * Stable workflow states shared by render requests and render results.
 */
export const RenderStatusValues = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

/**
 * Validates the lifecycle status of AI-assisted design rendering artifacts.
 */
export const RenderStatusSchema = z.enum(RenderStatusValues);

/**
 * Lifecycle state for a RenderRequest or RenderResult.
 */
export type RenderStatus = z.infer<typeof RenderStatusSchema>;
