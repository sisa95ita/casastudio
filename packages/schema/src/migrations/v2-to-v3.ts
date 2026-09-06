import { migrateV3ToV4 } from "./v3-to-v4.js";
import { MigrationErrorCode } from "./migration-error.js";
import type { ProjectMigrationResult } from "./migrate-project.js";

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

/**
 * Migrates a wall-boundary-only Project into the generalized Room-boundary schema.
 *
 * Existing ordered Wall references already form the Wall-backed variant of the
 * generalized boundary. The canonical migration chain preserves this content
 * and initializes the Furniture collection. The source object is never mutated.
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

  const result = migrateV3ToV4({ ...structuredClone(input), schemaVersion: "3.0.0" });
  return result.ok ? { ...result, sourceVersion: "2.0.0" }
    : { ok: false, errors: result.errors.map((error) => ({ ...error, sourceVersion: "2.0.0" })) };
}
