import {
  IdentifierSchema,
  ValidationErrorCode,
  createWall
} from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../test/demo-project-fixture";
import {
  createDraftWall,
  createWallIdentifier,
  getWallEditingErrorKey,
  newWallDefaults
} from "./project-wall-editing";

describe("Project Wall editing helpers", () => {
  it("creates deterministic-seam identifiers accepted by the schema", () => {
    const id = createWallIdentifier(
      () => "123e4567-e89b-12d3-a456-426614174000"
    );

    expect(id).toBe("wall-123e4567-e89b-12d3-a456-426614174000");
    expect(IdentifierSchema.safeParse(id).success).toBe(true);
  });

  it("creates a minimal standalone Wall accepted by createWall", () => {
    const levelId = demoProjectFixture.building.levels[0]!.id;
    const wall = createDraftWall(
      { x: 20, z: 30 },
      { x: 120, z: 80 },
      "wall-new-draft"
    );
    const result = createWall(demoProjectFixture, { levelId, wall });

    expect(result.ok).toBe(true);
    expect(wall).toEqual({
      id: "wall-new-draft",
      start: { x: 20, z: 30 },
      end: { x: 120, z: 80 },
      height: newWallDefaults.height,
      thickness: newWallDefaults.thickness,
      roomIds: [],
      openings: []
    });
  });

  it("maps typed expected failures without exposing raw domain messages", () => {
    expect(
      getWallEditingErrorKey({
        ok: false,
        errors: [
          {
            code: ValidationErrorCode.WALL_IS_REFERENCED,
            path: "building.levels[0].walls[0]",
            message: "internal detail"
          }
        ]
      })
    ).toBe("errors.wall.referenced");
  });
});
