import { z } from "zod";

import { RoomTypeSchema } from "../enums";
import { IdentifierSchema } from "../primitives";
import {
  IdentifierArraySchema,
  MeasurementSchema,
  OptionalDescriptionSchema,
  RequiredNameSchema
} from "./shared";

/**
 * Represents a functional architectural space within a Level.
 *
 * Room boundaries are referenced through level-scoped Walls; geometric
 * renderability and boundary correctness are validated outside this schema.
 */
export const RoomSchema = z.strictObject({
  id: IdentifierSchema,
  name: RequiredNameSchema,
  type: RoomTypeSchema,
  description: OptionalDescriptionSchema,
  elevation: MeasurementSchema.optional(),
  wallIds: IdentifierArraySchema
});

/**
 * Functional space owned by a Level.
 */
export type Room = z.infer<typeof RoomSchema>;
