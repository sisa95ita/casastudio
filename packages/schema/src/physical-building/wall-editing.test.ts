import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { ValidationErrorCode } from "../validation/index.js";
import type { Window } from "./opening.js";
import {
  createWall,
  deleteWall,
  moveWallEndpoint,
  updateWallProperties
} from "./wall-editing.js";
import type { Wall } from "./wall.js";

const editableWall: Wall = {
  id: "draft-wall",
  name: "Draft wall",
  start: { x: 0, z: 0 },
  end: { x: 100, z: 0 },
  height: 280,
  thickness: 20,
  roomIds: [],
  openings: []
};

describe("createWall", () => {
  it("appends a caller-identified Wall immutably and preserves unaffected state", () => {
    const project = createProject();
    const before = clone(project);
    const result = createWall(project, {
      levelId: "ground-floor",
      wall: editableWall
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(project).toEqual(before);
    expect(result.project).not.toBe(project);
    expect(result.project.building.levels[0]?.walls.at(-1)).toEqual(
      editableWall
    );
    expect(result.project.building.levels[0]?.walls.at(-1)?.id).toBe(
      "draft-wall"
    );
    expect(result.project.building.levels[1]).toBe(project.building.levels[1]);
    expect(result.project.viewpoints).toBe(project.viewpoints);
  });

  it("returns a typed failure for a missing Level", () => {
    const result = createWall(createProject(), {
      levelId: "missing-level",
      wall: editableWall
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.LEVEL_NOT_FOUND }]
    });
  });

  it("rejects duplicate and malformed stable identifiers", () => {
    const duplicate = createWall(createProject(), {
      levelId: "ground-floor",
      wall: { ...editableWall, id: "existing-wall" }
    });
    const malformed = createWall(createProject(), {
      levelId: "ground-floor",
      wall: { ...editableWall, id: "Not Valid" }
    });

    expect(duplicate).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.DUPLICATE_IDENTIFIER }]
    });
    expect(malformed).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.INVALID_IDENTIFIER }]
    });
  });

  it("rejects a zero-length Wall without mutating the Project", () => {
    const project = createProject();
    const before = clone(project);
    const result = createWall(project, {
      levelId: "ground-floor",
      wall: { ...editableWall, end: editableWall.start }
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_ZERO_LENGTH }]
    });
    expect(project).toEqual(before);
  });

  it("rejects an Opening ID already used by an Opening on the same Level", () => {
    const project = createProject();
    project.building.levels[0]?.walls[0]?.openings.push(
      createOpening("existing-opening")
    );

    const result = createWall(project, {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [createOpening("existing-opening")])
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
          path: "building.levels[0].walls[0].openings[0].id"
        }
      ]
    });
  });

  it("rejects an Opening ID already used by an Opening on another Level", () => {
    const project = createProject();
    project.building.levels[1]?.walls.push(
      wallWithOpenings("upper-wall", [createOpening("upper-opening")])
    );

    const result = createWall(project, {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [createOpening("upper-opening")])
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
          path: "building.levels[1].walls[0].openings[0].id"
        }
      ]
    });
  });

  it("rejects duplicate Opening IDs within the Wall being created", () => {
    const result = createWall(createProject(), {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [
        createOpening("draft-opening"),
        createOpening("draft-opening")
      ])
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
          path: "wall.openings[1].id"
        }
      ]
    });
  });

  it("allows cross-kind identifier reuse for new Opening IDs", () => {
    const result = createWall(createProject(), {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [createOpening("existing-wall")])
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.project.building.levels[0]?.walls.at(-1)?.openings[0]?.id
    ).toBe("existing-wall");
  });

  it("appends a valid Wall with unique Openings", () => {
    const result = createWall(createProject(), {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [
        createOpening("front-door"),
        createOpening("front-window")
      ])
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.project.building.levels[0]?.walls
        .at(-1)
        ?.openings.map((opening) => opening.id)
    ).toEqual(["front-door", "front-window"]);
  });

  it("does not mutate the input Project when rejecting duplicate Opening IDs", () => {
    const project = createProject();
    project.building.levels[0]?.walls[0]?.openings.push(
      createOpening("existing-opening")
    );
    const before = clone(project);

    const result = createWall(project, {
      levelId: "ground-floor",
      wall: wallWithOpenings("draft-wall", [createOpening("existing-opening")])
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.DUPLICATE_IDENTIFIER }]
    });
    expect(project).toEqual(before);
  });
});

describe("moveWallEndpoint", () => {
  it.each([
    ["start", { x: -50, z: 25 }],
    ["end", { x: 150, z: 25 }]
  ] as const)(
    "moves the %s endpoint while preserving identity and unrelated geometry",
    (endpoint, position) => {
      const project = createProject();
      const before = clone(project);
      const result = moveWallEndpoint(project, {
        levelId: "ground-floor",
        wallId: "existing-wall",
        endpoint,
        position
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(project).toEqual(before);
      expect(result.project.building.levels[0]?.walls[0]).toMatchObject({
        id: "existing-wall",
        [endpoint]: position
      });
      expect(result.project.building.levels[0]?.walls[1]).toBe(
        project.building.levels[0]?.walls[1]
      );
      expect(result.project.building.levels[1]).toBe(
        project.building.levels[1]
      );
    }
  );

  it("returns a typed failure for an unknown Wall", () => {
    expect(
      moveWallEndpoint(createProject(), {
        levelId: "ground-floor",
        wallId: "missing-wall",
        endpoint: "end",
        position: { x: 2, z: 3 }
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_NOT_FOUND }]
    });
  });

  it("rejects invalid and zero-length resulting endpoints", () => {
    const invalid = moveWallEndpoint(createProject(), {
      levelId: "ground-floor",
      wallId: "existing-wall",
      endpoint: "end",
      position: { x: Number.NaN, z: 0 }
    });
    const zeroLength = moveWallEndpoint(createProject(), {
      levelId: "ground-floor",
      wallId: "existing-wall",
      endpoint: "end",
      position: { x: 0, z: 0 }
    });

    expect(invalid).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.INVALID_WALL_ENDPOINT }]
    });
    expect(zeroLength).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_ZERO_LENGTH }]
    });
  });
});

describe("deleteWall", () => {
  it("removes an unreferenced Wall immutably and preserves unrelated state", () => {
    const project = createProject();
    const before = clone(project);
    const result = deleteWall(project, {
      levelId: "ground-floor",
      wallId: "unreferenced-wall"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(project).toEqual(before);
    expect(
      result.project.building.levels[0]?.walls.map((wall) => wall.id)
    ).toEqual(["existing-wall"]);
    expect(result.project.building.levels[0]?.rooms).toBe(
      project.building.levels[0]?.rooms
    );
    expect(result.project.building.levels[1]).toBe(project.building.levels[1]);
  });

  it("returns a typed failure for an unknown Wall", () => {
    expect(
      deleteWall(createProject(), {
        levelId: "ground-floor",
        wallId: "missing-wall"
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_NOT_FOUND }]
    });
  });

  it("rejects deletion when a Room boundary references the Wall", () => {
    const project = createProject();
    project.building.levels[0]?.rooms.push({
      id: "draft-room",
      name: "Draft Room",
      type: "OTHER",
      boundary: [
        { wallId: "existing-wall", direction: "FORWARD" },
        { wallId: "other-wall", direction: "FORWARD" },
        { wallId: "third-wall", direction: "FORWARD" }
      ]
    });

    expect(
      deleteWall(project, { levelId: "ground-floor", wallId: "existing-wall" })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_IS_REFERENCED }]
    });
  });
});

describe("updateWallProperties", () => {
  it.each([
    [{ height: 310 }, { height: 310, thickness: 20 }],
    [{ thickness: 24 }, { height: 280, thickness: 24 }],
    [
      { height: 315, thickness: 26 },
      { height: 315, thickness: 26 }
    ]
  ] as const)(
    "updates supported properties immutably",
    (properties, expected) => {
      const project = createProject();
      const before = clone(project);
      const result = updateWallProperties(project, {
        levelId: "ground-floor",
        wallId: "existing-wall",
        ...properties
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(project).toEqual(before);
      expect(result.project.building.levels[0]?.walls[0]).toMatchObject({
        id: "existing-wall",
        start: editableWall.start,
        end: editableWall.end,
        roomIds: editableWall.roomIds,
        openings: editableWall.openings,
        ...expected
      });
      expect(result.project.building.levels[0]?.walls[1]).toBe(
        project.building.levels[0]?.walls[1]
      );
      expect(result.project.building.levels[1]).toBe(
        project.building.levels[1]
      );
      expect(result.project.viewpoints).toBe(project.viewpoints);
      expect(result.project).toMatchObject({
        id: project.id,
        revision: project.revision,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      });
    }
  );

  it("returns typed failures for missing Levels and Walls", () => {
    expect(
      updateWallProperties(createProject(), {
        levelId: "missing-level",
        wallId: "existing-wall",
        height: 300
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.LEVEL_NOT_FOUND }]
    });
    expect(
      updateWallProperties(createProject(), {
        levelId: "ground-floor",
        wallId: "missing-wall",
        height: 300
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_NOT_FOUND }]
    });
  });

  it.each([
    ["height", 0, ValidationErrorCode.INVALID_WALL_HEIGHT],
    ["height", Number.NaN, ValidationErrorCode.INVALID_WALL_HEIGHT],
    ["thickness", -1, ValidationErrorCode.INVALID_WALL_THICKNESS],
    [
      "thickness",
      Number.POSITIVE_INFINITY,
      ValidationErrorCode.INVALID_WALL_THICKNESS
    ]
  ] as const)(
    "rejects invalid %s values without mutating the Project",
    (property, value, code) => {
      const project = createProject();
      const before = clone(project);
      const result = updateWallProperties(project, {
        levelId: "ground-floor",
        wallId: "existing-wall",
        [property]: value
      });

      expect(result).toMatchObject({ ok: false, errors: [{ code }] });
      expect(project).toEqual(before);
    }
  );
});

function createProject(): Project {
  return {
    id: "editing-fixture",
    name: "Editing Fixture",
    schemaVersion: "2.0.0",
    revision: 4,
    createdAt: "2026-08-13T08:00:00.000Z",
    updatedAt: "2026-08-13T08:30:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-floor",
          name: "Ground Floor",
          elevation: 0,
          rooms: [],
          walls: [
            { ...editableWall, id: "existing-wall" },
            {
              ...editableWall,
              id: "unreferenced-wall",
              start: { x: 0, z: 100 },
              end: { x: 100, z: 100 }
            }
          ],
          staircases: []
        },
        {
          id: "upper-floor",
          name: "Upper Floor",
          elevation: 300,
          rooms: [],
          walls: [],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  };
}

function wallWithOpenings(id: string, openings: readonly Window[]): Wall {
  return {
    ...editableWall,
    id,
    openings: [...openings]
  };
}

function createOpening(id: string): Window {
  return {
    id,
    type: "WINDOW",
    offsetFromStart: 10,
    width: 20,
    height: 120,
    elevation: 90
  };
}

function clone(project: Project): Project {
  return structuredClone(project);
}
