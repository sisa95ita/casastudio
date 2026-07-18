import { z } from "zod";

/**
 * Stable vocabulary for camera projection modes used by saved Viewpoints.
 */
export const ProjectionTypeValues = ["PERSPECTIVE", "ORTHOGRAPHIC"] as const;

/**
 * Validates how a Viewpoint projects the building into a reproducible view.
 */
export const ProjectionTypeSchema = z.enum(ProjectionTypeValues);

/**
 * Projection mode for a saved Viewpoint.
 */
export type ProjectionType = z.infer<typeof ProjectionTypeSchema>;
