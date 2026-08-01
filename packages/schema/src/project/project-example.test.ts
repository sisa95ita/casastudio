import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { migrateProject } from "../migrations";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  validateProjectRenderability
} from "../validation";
import { ProjectSchema } from "./project";

const canonicalProjectUrl = new URL("../../examples/project.json", import.meta.url);
const legacyProjectUrl = new URL("../../examples/project-v1-legacy-wallIds.json", import.meta.url);

const loadCanonicalProject = (): unknown => JSON.parse(readFileSync(canonicalProjectUrl, "utf8"));
const loadLegacyProject = (): unknown => JSON.parse(readFileSync(legacyProjectUrl, "utf8"));

const hasOwnPropertyDeep = (value: unknown, propertyName: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasOwnPropertyDeep(item, propertyName));
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    Object.hasOwn(value, propertyName) ||
    Object.values(value).some((child) => hasOwnPropertyDeep(child, propertyName))
  );
};

describe("canonical project example", () => {
  it("is canonical v2, contains boundary, and contains no legacy wallIds", () => {
    const input = loadCanonicalProject();
    const project = ProjectSchema.parse(input);

    expect(project.schemaVersion).toBe("2.0.0");
    expect(hasOwnPropertyDeep(input, "wallIds")).toBe(false);
    expect(project.building.levels.flatMap((level) => level.rooms).every((room) => Array.isArray(room.boundary))).toBe(
      true
    );
  });

  it("satisfies ProjectSchema and semantic Project validation layers", () => {
    const project = ProjectSchema.parse(loadCanonicalProject());

    expect(validateProjectCrossReferences(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectReferenceConsistency(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectRenderability(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectGeometry(project)).toEqual({
      valid: true,
      errors: []
    });
  });
});

describe("legacy wallIds project example", () => {
  it("is migration-only legacy input", () => {
    const input = loadLegacyProject() as { schemaVersion?: unknown };

    expect(input.schemaVersion).toBe("1.0.0");
    expect(hasOwnPropertyDeep(input, "wallIds")).toBe(true);
    expect(hasOwnPropertyDeep(input, "boundary")).toBe(false);
    expect(ProjectSchema.safeParse(input).success).toBe(false);
  });

  it("migrates to canonical v2 while preserving metadata and removing wallIds", () => {
    const input = loadLegacyProject() as {
      revision?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    const result = migrateProject(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.project.schemaVersion).toBe("2.0.0");
    expect(result.project.revision).toBe(input.revision);
    expect(result.project.createdAt).toBe(input.createdAt);
    expect(result.project.updatedAt).toBe(input.updatedAt);
    expect(hasOwnPropertyDeep(result.project, "wallIds")).toBe(false);
    expect(ProjectSchema.parse(result.project)).toEqual(result.project);
    expect(validateProjectCrossReferences(result.project)).toEqual({ valid: true, errors: [] });
    expect(validateProjectReferenceConsistency(result.project)).toEqual({ valid: true, errors: [] });
    expect(validateProjectGeometry(result.project)).toEqual({ valid: true, errors: [] });
  });
});
