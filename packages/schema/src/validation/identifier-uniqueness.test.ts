import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ProjectSchema } from "../project/index.js";
import { validateProjectIdentifierUniqueness } from "./identifier-uniqueness.js";
import { ValidationErrorCode } from "./validation-error-code.js";

const projectUrl = new URL("../../examples/project.json", import.meta.url);

describe("validateProjectIdentifierUniqueness", () => {
  it("accepts the canonical Project fixture", () => {
    const project = ProjectSchema.parse(JSON.parse(readFileSync(projectUrl, "utf8")));

    expect(validateProjectIdentifierUniqueness(project)).toEqual({ valid: true, errors: [] });
  });

  it("reports duplicate Project-scoped Wall identifiers across Levels", () => {
    const project = ProjectSchema.parse(JSON.parse(readFileSync(projectUrl, "utf8")));
    const duplicate = structuredClone(project.building.levels[0]);
    const duplicatedWallId = project.building.levels[0]?.walls[0]?.id;
    if (!duplicate || !duplicatedWallId || !duplicate.walls[0]) {
      throw new Error("Canonical fixture requires a Level and Wall.");
    }
    duplicate.id = "duplicate-level";
    duplicate.name = "Duplicate Level";
    duplicate.elevation = 500;
    duplicate.rooms = [];
    duplicate.staircases = [];
    duplicate.walls = [{ ...duplicate.walls[0], roomIds: [], openings: [] }];
    project.building.levels.push(duplicate);

    expect(validateProjectIdentifierUniqueness(project)).toMatchObject({
      valid: false,
      errors: [
        {
          code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
          path: "building.levels[2].walls[0].id"
        }
      ]
    });
  });
});
