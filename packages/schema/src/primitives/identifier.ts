import { z } from "zod";

/**
 * Validates CasaStudio's persisted identifier format.
 *
 * Identifiers are human-readable references used throughout a Project and are
 * intended to remain stable across edits.
 */
export const IdentifierSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Human-readable Project identifier used by schemas and cross-reference validation.
 */
export type Identifier = z.infer<typeof IdentifierSchema>;
