import { z } from "zod";

import { DesignBriefSchema, RenderRequestSchema, RenderResultSchema } from "../design-rendering";
import { BaseImageSchema, ViewpointSchema } from "../observation";
import { BuildingSchema } from "../physical-building";
import { IdentifierSchema, IsoDateTimeSchema, PositiveIntegerSchema, UnitsSchema } from "../primitives";

export const ProjectSchema = z.strictObject({
  id: IdentifierSchema,
  name: z.string().min(1),
  schemaVersion: z.string().min(1),
  revision: PositiveIntegerSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  units: UnitsSchema,
  building: BuildingSchema,
  viewpoints: z.array(ViewpointSchema),
  baseImages: z.array(BaseImageSchema),
  designBriefs: z.array(DesignBriefSchema),
  renderRequests: z.array(RenderRequestSchema),
  renderResults: z.array(RenderResultSchema)
});

export type Project = z.infer<typeof ProjectSchema>;
