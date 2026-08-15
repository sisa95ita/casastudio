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
  doesWallCloseCycle,
  getWallEndpointEditingAvailability,
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

  it("makes only a standalone endpoint draggable at a shared junction", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    level.rooms = [];
    level.walls = [
      createDraftWall({ x: 0, z: 0 }, { x: 100, z: 0 }, "selected"),
      createDraftWall({ x: 100, z: 0 }, { x: 100, z: 100 }, "connected")
    ];

    expect(
      getWallEndpointEditingAvailability(project, level.id, "selected")
    ).toEqual({
      roomReferenced: false,
      start: { topology: "standalone", draggable: true },
      end: { topology: "shared-junction", draggable: false }
    });
  });

  it("preserves the Room-wide endpoint restriction", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    const wall = level.walls[0]!;
    const availability = getWallEndpointEditingAvailability(
      project,
      level.id,
      wall.id
    );

    expect(availability?.roomReferenced).toBe(true);
    expect(availability?.start.draggable).toBe(false);
    expect(availability?.end.draggable).toBe(false);
  });

  it("detects a canonical cycle only when the committed Wall has an existing alternate path", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    level.rooms = [];
    level.walls = [
      createDraftWall({ x: 0, z: 0 }, { x: 100, z: 0 }, "wall-a"),
      createDraftWall({ x: 100, z: 0 }, { x: 100, z: 100 }, "wall-b"),
      createDraftWall({ x: 100, z: 100 }, { x: 0, z: 0 }, "wall-closing")
    ];

    expect(doesWallCloseCycle(project, level.id, "wall-closing")).toBe(true);
    expect(level.rooms).toEqual([]);

    level.walls = level.walls.slice(0, 2);
    expect(doesWallCloseCycle(project, level.id, "wall-b")).toBe(false);
  });

  it("does not call a connection to unrelated topology a cycle", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    level.rooms = [];
    level.walls = [
      createDraftWall({ x: 0, z: 0 }, { x: 100, z: 0 }, "chain"),
      createDraftWall({ x: 300, z: 0 }, { x: 400, z: 0 }, "unrelated"),
      createDraftWall({ x: 100, z: 0 }, { x: 300, z: 0 }, "connection")
    ];

    expect(doesWallCloseCycle(project, level.id, "connection")).toBe(false);
  });
});
