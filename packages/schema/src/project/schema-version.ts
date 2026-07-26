import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = "2.0.0";

export const SUPPORTED_PROJECT_SCHEMA_VERSIONS = ["2.0.0"] as const;

export type SupportedProjectSchemaVersion = (typeof SUPPORTED_PROJECT_SCHEMA_VERSIONS)[number];

export const ProjectSchemaVersionSchema = z.literal(CURRENT_PROJECT_SCHEMA_VERSION);
