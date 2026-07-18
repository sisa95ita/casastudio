import { z } from "zod";

import { IdentifierSchema, PositiveNumberSchema } from "../primitives";

/**
 * Required display name used by primary physical-building entities.
 */
export const RequiredNameSchema = z.string().min(1);

/**
 * Optional display name used when an entity may remain identified by its id alone.
 */
export const OptionalNameSchema = z.string().min(1).optional();

/**
 * Optional human-readable note for physical-building entities.
 */
export const OptionalDescriptionSchema = z.string().min(1).optional();

/**
 * Ordered or unordered collection of references to other CasaStudio identifiers.
 */
export const IdentifierArraySchema = z.array(IdentifierSchema);

/**
 * General measurement value in the Project's declared length unit.
 *
 * Elevations and coordinates may be zero, negative, or positive depending on
 * their local spatial frame.
 */
export const MeasurementSchema = z.number();

/**
 * Positive physical measurement used for dimensions that cannot be zero.
 */
export const PositiveMeasurementSchema = PositiveNumberSchema;
