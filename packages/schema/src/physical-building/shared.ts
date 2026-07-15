import { z } from "zod";

import { IdentifierSchema, PositiveNumberSchema } from "../primitives";

export const RequiredNameSchema = z.string().min(1);
export const OptionalNameSchema = z.string().min(1).optional();
export const OptionalDescriptionSchema = z.string().min(1).optional();
export const IdentifierArraySchema = z.array(IdentifierSchema);
export const MeasurementSchema = z.number();
export const PositiveMeasurementSchema = PositiveNumberSchema;
