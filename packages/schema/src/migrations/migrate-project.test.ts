import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MigrationErrorCode } from "./migration-error";
import { migrateProject } from "./migrate-project";

const legacyProjectUrl = new URL("../../examples/project-v1-legacy-wallIds.json", import.meta.url);
const canonicalProjectUrl = new URL("../../examples/project.json", import.meta.url);

const loadJson = (url: URL): Record<string, unknown> => JSON.parse(readFileSync(url, "utf8"));

describe("migrateProject", () => {
  it("returns an expected failure for a missing schema version", () => {
    expect(migrateProject({ id: "missing-version" })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.MISSING_SCHEMA_VERSION }]
    });
  });

  it("returns an expected failure for a non-string schema version", () => {
    expect(migrateProject({ schemaVersion: 2 })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.INVALID_SCHEMA_VERSION }]
    });
  });

  it("returns an expected failure for unsupported schema versions", () => {
    expect(migrateProject({ schemaVersion: "2.0.1" })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.UNSUPPORTED_PROJECT_SCHEMA_VERSION }]
    });
  });

  it("accepts valid canonical v2 input", () => {
    const input = loadJson(canonicalProjectUrl);
    const result = migrateProject(input);

    expect(result).toMatchObject({
      ok: true,
      sourceVersion: "2.0.0",
      targetVersion: "2.0.0"
    });
  });

  it("returns canonical validation errors for invalid canonical v2 input", () => {
    const input = loadJson(canonicalProjectUrl);

    input.name = "";

    const result = migrateProject(input);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(MigrationErrorCode.CANONICAL_VALIDATION_FAILED);
      expect(result.errors[0]?.sourceVersion).toBe("2.0.0");
    }
  });

  it("migrates valid v1 input", () => {
    const result = migrateProject(loadJson(legacyProjectUrl));

    expect(result).toMatchObject({
      ok: true,
      sourceVersion: "1.0.0",
      targetVersion: "2.0.0"
    });

    if (result.ok) {
      expect(result.project.schemaVersion).toBe("2.0.0");
    }
  });

  it("does not throw for expected migration failures", () => {
    const input = loadJson(legacyProjectUrl);
    const building = input.building as { levels: { rooms: Record<string, unknown>[] }[] };
    const room = building.levels[0]?.rooms[0];

    if (!room) {
      throw new Error("Legacy fixture is missing its first room.");
    }

    room.wallIds = ["missing-wall"];

    expect(() => migrateProject(input)).not.toThrow();

    const result = migrateProject(input);

    expect(result.ok).toBe(false);
  });
});
