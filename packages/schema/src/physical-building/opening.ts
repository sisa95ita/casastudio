import { z } from "zod";

import { IdentifierSchema } from "../primitives";
import {
  IdentifierArraySchema,
  MeasurementSchema,
  OptionalDescriptionSchema,
  OptionalNameSchema
} from "./shared";

const OpeningBaseSchema = z.strictObject({
  id: IdentifierSchema,
  name: OptionalNameSchema,
  description: OptionalDescriptionSchema,
  offsetFromStart: MeasurementSchema,
  width: MeasurementSchema,
  height: MeasurementSchema,
  elevation: MeasurementSchema
});

export const DoorSchema = OpeningBaseSchema.extend({
  type: z.literal("DOOR"),
  connectedRoomIds: IdentifierArraySchema.optional()
});

export const WindowSchema = OpeningBaseSchema.extend({
  type: z.literal("WINDOW")
});

export const OpeningSchema = z.discriminatedUnion("type", [DoorSchema, WindowSchema]);

export type Door = z.infer<typeof DoorSchema>;
export type Window = z.infer<typeof WindowSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
