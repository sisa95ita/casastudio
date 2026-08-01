import { z } from "zod";

/**
 * Latest canonical persisted Project schema version accepted by `ProjectSchema`.
 */
export const CURRENT_PROJECT_SCHEMA_VERSION = "2.0.0";

/**
 * Canonical Project schema versions supported without migration.
 *
 * Legacy versions are intentionally handled by explicit schema-owned migration
 * entry points rather than by ordinary canonical parsing.
 */
export const SUPPORTED_PROJECT_SCHEMA_VERSIONS = ["2.0.0"] as const;

/**
 * String literal union for canonical Project schema versions.
 */
export type SupportedProjectSchemaVersion = (typeof SUPPORTED_PROJECT_SCHEMA_VERSIONS)[number];

/**
 * Validates the schema version required by the canonical Project schema.
 */
export const ProjectSchemaVersionSchema = z.literal(CURRENT_PROJECT_SCHEMA_VERSION);
