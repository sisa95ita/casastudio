import { describe, expect, it } from "vitest";

import { createInitialProject } from "../project/index.js";
import { ValidationErrorCode } from "../validation/index.js";
import { createLevel, updateLevelProperties } from "./level-editing.js";

const project = createInitialProject({
  projectId: "level-editing-project",
  buildingId: "level-editing-building",
  levelId: "ground-floor",
  name: "Level Editing Project",
  createdAt: "2026-08-27T08:00:00.000Z"
});

describe("Level editing", () => {
  it("appends a caller-identified empty Level without mutating the source", () => {
    const result = createLevel(project, {
      id: "first-floor",
      name: "First Floor",
      elevation: 300
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(project.building.levels).toHaveLength(1);
    expect(result.project.building.levels).toEqual([
      project.building.levels[0],
      {
        id: "first-floor",
        name: "First Floor",
        elevation: 300,
        rooms: [],
        walls: [],
        staircases: []
      }
    ]);
  });

  it("rejects duplicate Level IDs atomically", () => {
    const result = createLevel(project, {
      id: "ground-floor",
      name: "Duplicate",
      elevation: 300
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.DUPLICATE_IDENTIFIER }]
    });
    expect(project.building.levels).toHaveLength(1);
  });

  it("updates only Level metadata and preserves owned geometry", () => {
    const result = updateLevelProperties(project, {
      levelId: "ground-floor",
      name: "Main Floor",
      elevation: 15
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]).toEqual({
      ...project.building.levels[0],
      name: "Main Floor",
      elevation: 15
    });
    expect(project.building.levels[0]?.name).toBe("Ground Floor");
  });

  it("rejects invalid metadata and missing Levels", () => {
    expect(updateLevelProperties(project, {
      levelId: "ground-floor",
      name: ""
    })).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED }]
    });
    expect(updateLevelProperties(project, {
      levelId: "missing-level",
      elevation: 300
    })).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.LEVEL_NOT_FOUND }]
    });
  });
});
