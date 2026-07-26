import type { Project } from "../project";
import { ProjectSchema } from "../project";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "../project/schema-version";
import { MigrationErrorCode, type ProjectMigrationError } from "./migration-error";
import { migrateV1ToV2 } from "./v1-to-v2";

export type ProjectMigrationResult =
  | {
      ok: true;
      project: Project;
      sourceVersion: string;
      targetVersion: typeof CURRENT_PROJECT_SCHEMA_VERSION;
    }
  | {
      ok: false;
      errors: readonly ProjectMigrationError[];
    };

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const canonicalValidationErrors = (input: unknown, sourceVersion: string): ProjectMigrationResult => {
  const parsed = ProjectSchema.safeParse(input);

  if (parsed.success) {
    return {
      ok: true,
      project: parsed.data,
      sourceVersion,
      targetVersion: CURRENT_PROJECT_SCHEMA_VERSION
    };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map((issue): ProjectMigrationError => {
      const path = issue.path.join(".");

      return {
        code: MigrationErrorCode.CANONICAL_VALIDATION_FAILED,
        message: issue.message,
        path: path.length > 0 ? path : undefined,
        sourceVersion
      };
    })
  };
};

export function migrateProject(input: unknown): ProjectMigrationResult {
  if (!isRecord(input) || !("schemaVersion" in input)) {
    return {
      ok: false,
      errors: [
        {
          code: MigrationErrorCode.MISSING_SCHEMA_VERSION,
          message: "Project input is missing schemaVersion."
        }
      ]
    };
  }

  const { schemaVersion } = input;

  if (typeof schemaVersion !== "string") {
    return {
      ok: false,
      errors: [
        {
          code: MigrationErrorCode.INVALID_SCHEMA_VERSION,
          message: "Project schemaVersion must be a string."
        }
      ]
    };
  }

  if (schemaVersion === CURRENT_PROJECT_SCHEMA_VERSION) {
    return canonicalValidationErrors(input, schemaVersion);
  }

  if (schemaVersion === "1.0.0") {
    return migrateV1ToV2(input);
  }

  return {
    ok: false,
    errors: [
      {
        code: MigrationErrorCode.UNSUPPORTED_PROJECT_SCHEMA_VERSION,
        message: `Project schemaVersion "${schemaVersion}" is not supported for migration.`,
        sourceVersion: schemaVersion
      }
    ]
  };
}
