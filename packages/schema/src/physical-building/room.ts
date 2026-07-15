import { z } from "zod";

import { RoomTypeSchema } from "../enums";
import { IdentifierSchema } from "../primitives";
import {
  IdentifierArraySchema,
  MeasurementSchema,
  OptionalDescriptionSchema,
  RequiredNameSchema
} from "./shared";

export const RoomSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  type: RoomTypeSchema,
  description: OptionalDescriptionSchema,
  elevation: MeasurementSchema.optional(),
  wallIds: IdentifierArraySchema
});

export type Room = z.infer<typeof RoomSchema>;
