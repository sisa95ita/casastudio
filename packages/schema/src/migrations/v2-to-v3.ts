import { ProjectSchema } from "../project/index.js";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "../project/schema-version.js";
import { MigrationErrorCode, type ProjectMigrationError } from "./migration-error.js";
import type { ProjectMigrationResult } from "./migrate-project.js";

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

/**
 * Migrates a wall-boundary-only Project into the generalized Room-boundary schema.
 *
 * Existing ordered Wall references already form the Wall-backed variant of the
 * generalized boundary, so migration changes only `schemaVersion`. The source
 * object is cloned and never mutated.
 */
export function migrateV2ToV3(input: unknown): ProjectMigrationResult {
  if (!isRecord(input) || input.schemaVersion !== "2.0.0") {
    return {
      ok: false,
      errors: [{
        code: MigrationErrorCode.INVALID_LEGACY_SHAPE,
        message: "Project input is not a schemaVersion 2.0.0 object.",
        sourceVersion: "2.0.0"
      }]
    };
  }

  const candidate = structuredClone(input);
  candidate.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue): ProjectMigrationError => ({
        code: MigrationErrorCode.CANONICAL_VALIDATION_FAILED,
        message: issue.message,
        path: issue.path.length > 0 ? issue.path.join(".") : undefined,
        sourceVersion: "2.0.0"
      }))
    };
  }

  return {
    ok: true,
    project: parsed.data,
    sourceVersion: "2.0.0",
    targetVersion: CURRENT_PROJECT_SCHEMA_VERSION
  };
}
