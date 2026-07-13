import { z } from "zod";

export const ProjectionTypeValues = ["PERSPECTIVE", "ORTHOGRAPHIC"] as const;

export const ProjectionTypeSchema = z.enum(ProjectionTypeValues);

export type ProjectionType = z.infer<typeof ProjectionTypeSchema>;
