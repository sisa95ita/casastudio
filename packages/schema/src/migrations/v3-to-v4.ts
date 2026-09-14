import { ProjectSchema } from "../project/index.js";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "../project/schema-version.js";
import {
  MigrationErrorCode,
  type ProjectMigrationError
} from "./migration-error.js";
import type { ProjectMigrationResult } from "./migrate-project.js";

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

/** Migrates a Furniture-free Project by adding an empty Building collection, preserving all existing data. */
export function migrateV3ToV4(input: unknown): ProjectMigrationResult {
  if (!isRecord(input) || input.schemaVersion !== "3.0.0") {
    return {
      ok: false,
      errors: [
        {
          code: MigrationErrorCode.INVALID_LEGACY_SHAPE,
          message: "Project input is not a schemaVersion 3.0.0 object.",
          sourceVersion: "3.0.0"
        }
      ]
    };
  }

  const candidate = structuredClone(input);
  if (isRecord(candidate.building)) {
    if (
      "furniture" in candidate.building &&
      (!Array.isArray(candidate.building.furniture) ||
        candidate.building.furniture.length > 0)
    ) {
      return {
        ok: false,
        errors: [
          {
            code: MigrationErrorCode.INVALID_LEGACY_SHAPE,
            message: "Legacy Project cannot contain Furniture.",
            path: "building.furniture",
            sourceVersion: "3.0.0"
          }
        ]
      };
    }
    candidate.building.furniture = [];
  }
  candidate.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue): ProjectMigrationError => ({
        code: MigrationErrorCode.CANONICAL_VALIDATION_FAILED,
        message: issue.message,
        path: issue.path.length > 0 ? issue.path.join(".") : undefined,
        sourceVersion: "3.0.0"
      }))
    };
  }

  return {
    ok: true,
    project: parsed.data,
    sourceVersion: "3.0.0",
    targetVersion: CURRENT_PROJECT_SCHEMA_VERSION
  };
}
