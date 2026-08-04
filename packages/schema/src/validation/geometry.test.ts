import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { validateProjectGeometry } from "./geometry.js";
import { ValidationErrorCode } from "./validation-error-code.js";

const createGeometricallyValidProject = (): Project => ({
  id: "geometry-fixture",
  name: "Geometry Fixture",
  schemaVersion: "2.0.0",
  revision: 1,
  createdAt: "2026-07-18T10:00:00+02:00",
  updatedAt: "2026-07-18T10:00:00+02:00",
  units: {
    length: "cm",
    angle: "deg"
  },
  building: {
    id: "main-building",
    name: "Main Building",
    type: "HOUSE",
    levels: [
      {
        id: "ground-level",
        name: "Ground Level",
        elevation: 0,
        rooms: [
          {
            id: "living-room",
            name: "Living Room",
            type: "LIVING_ROOM",
            boundary: []
          }
        ],
        walls: [
          {
            id: "north-wall",
            start: { x: 0, z: 0 },
            end: { x: 500, z: 0 },
            height: 280,
            thickness: 20,
            roomIds: ["living-room"],
            openings: [
              {
                id: "front-door",
                type: "DOOR",
                offsetFromStart: 100,
                width: 90,
                height: 210,
                elevation: 0,
                connectedRoomIds: ["living-room"]
              }
            ]
          },
          {
            id: "east-wall",
            start: { x: 500, z: 0 },
            end: { x: 500, z: 350 },
            height: 280,
            thickness: 20,
            roomIds: ["living-room"],
            openings: []
          }
        ],
        staircases: [
          {
            id: "main-stair",
            fromLevelId: "ground-level",
            toLevelId: "upper-level",
            fromRoomId: "living-room",
            width: 90,
            flights: [
              {
                id: "main-flight",
                start: { x: 420, z: 50 },
                end: { x: 420, z: 260 },
                width: 90,
                stepCount: 12,
                startElevation: 0,
                endElevation: 280
              }
            ],
            landings: [
              {
                id: "upper-landing",
                position: { x: 380, z: 250 },
                width: 100,
                depth: 120,
                elevation: 280
              }
            ]
          }
        ]
      },
      {
        id: "upper-level",
        name: "Upper Level",
        elevation: 280,
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
});

const getGroundLevel = (project: Project) => {
  const level = project.building.levels.at(0);

  if (!level) {
    throw new Error("Test fixture is missing the ground level.");
  }

  return level;
};

const setRoomBoundaryWalls = (
  project: Project,
  walls: Project["building"]["levels"][number]["walls"],
  boundary: Project["building"]["levels"][number]["rooms"][number]["boundary"]
) => {
  const level = getGroundLevel(project);
  const room = level.rooms[0];

  if (!room) {
    throw new Error("Test fixture is missing a room.");
  }

  level.walls = walls;
  room.boundary = boundary;

  return { level, room };
};

const rectangleWalls: Project["building"]["levels"][number]["walls"] = [
  {
    id: "north-wall",
    start: { x: 0, z: 0 },
    end: { x: 500, z: 0 },
    height: 280,
    thickness: 20,
    roomIds: ["living-room"],
    openings: []
  },
  {
    id: "east-wall",
    start: { x: 500, z: 0 },
    end: { x: 500, z: 350 },
    height: 280,
    thickness: 20,
    roomIds: ["living-room"],
    openings: []
  },
  {
    id: "south-wall",
    start: { x: 500, z: 350 },
    end: { x: 0, z: 350 },
    height: 280,
    thickness: 20,
    roomIds: ["living-room"],
    openings: []
  },
  {
    id: "west-wall",
    start: { x: 0, z: 350 },
    end: { x: 0, z: 0 },
    height: 280,
    thickness: 20,
    roomIds: ["living-room"],
    openings: []
  }
];

const ccwRectangleBoundary: Project["building"]["levels"][number]["rooms"][number]["boundary"] = [
  { wallId: "north-wall", direction: "FORWARD" },
  { wallId: "east-wall", direction: "FORWARD" },
  { wallId: "south-wall", direction: "FORWARD" },
  { wallId: "west-wall", direction: "FORWARD" }
];

describe("validateProjectGeometry", () => {
  it("returns valid true for a geometrically valid Project", () => {
    const result = validateProjectGeometry(createGeometricallyValidProject());

    expect(result).toEqual({
      valid: true,
      errors: []
    });
  });

  it("reports zero-length Walls", () => {
    const project = createGeometricallyValidProject();
    const wall = getGroundLevel(project).walls[0];

    if (!wall) {
      throw new Error("Test fixture is missing a wall.");
    }

    wall.end = { ...wall.start };

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.WALL_ZERO_LENGTH,
        path: "building.levels[0].walls[0].end"
      }
    ]);
  });

  it("reports Openings before the Wall start and beyond the Wall end", () => {
    const project = createGeometricallyValidProject();
    const walls = getGroundLevel(project).walls;
    const firstOpening = walls[0]?.openings[0];

    if (!firstOpening || !walls[1]) {
      throw new Error("Test fixture is missing openings or walls.");
    }

    firstOpening.offsetFromStart = -1;
    walls[1].openings.push({
      id: "oversized-window",
      type: "WINDOW",
      offsetFromStart: 300,
      width: 60,
      height: 120,
      elevation: 90
    });

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.OPENING_OUTSIDE_WALL,
        path: "building.levels[0].walls[0].openings[0]"
      },
      {
        code: ValidationErrorCode.OPENING_OUTSIDE_WALL,
        path: "building.levels[0].walls[1].openings[0]"
      }
    ]);
  });

  it("skips Opening fit checks when the Wall length is invalid", () => {
    const project = createGeometricallyValidProject();
    const wall = getGroundLevel(project).walls[0];
    const opening = wall?.openings[0];

    if (!wall || !opening) {
      throw new Error("Test fixture is missing a wall or opening.");
    }

    wall.end = { ...wall.start };
    opening.offsetFromStart = -1;

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe(ValidationErrorCode.WALL_ZERO_LENGTH);
  });

  it("reports zero-length StairFlights", () => {
    const project = createGeometricallyValidProject();
    const flight = getGroundLevel(project).staircases[0]?.flights[0];

    if (!flight) {
      throw new Error("Test fixture is missing a stair flight.");
    }

    flight.end = { ...flight.start };

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.STAIR_FLIGHT_ZERO_LENGTH,
        path: "building.levels[0].staircases[0].flights[0].end"
      }
    ]);
  });

  it("reports non-positive StairLanding dimensions", () => {
    const project = createGeometricallyValidProject();
    const landing = getGroundLevel(project).staircases[0]?.landings[0];

    if (!landing) {
      throw new Error("Test fixture is missing a stair landing.");
    }

    landing.width = 0;
    landing.depth = -1;

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_WIDTH,
        path: "building.levels[0].staircases[0].landings[0].width"
      },
      {
        code: ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_DEPTH,
        path: "building.levels[0].staircases[0].landings[0].depth"
      }
    ]);
  });

  it("reports StairFlights that do not ascend", () => {
    const project = createGeometricallyValidProject();
    const flight = getGroundLevel(project).staircases[0]?.flights[0];

    if (!flight) {
      throw new Error("Test fixture is missing a stair flight.");
    }

    flight.endElevation = flight.startElevation;

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.STAIR_FLIGHT_NOT_ASCENDING,
        path: "building.levels[0].staircases[0].flights[0].endElevation"
      }
    ]);
  });

  it("reports same-direction duplicate Wall geometry in the same Level", () => {
    const project = createGeometricallyValidProject();
    const level = getGroundLevel(project);

    level.walls.push({
      id: "duplicate-north-wall",
      start: { x: 0, z: 0 },
      end: { x: 500, z: 0 },
      height: 280,
      thickness: 20,
      roomIds: ["living-room"],
      openings: []
    });

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.DUPLICATE_WALL_GEOMETRY,
        path: "building.levels[0].walls[2]"
      }
    ]);
  });

  it("reports reversed duplicate Wall geometry in the same Level", () => {
    const project = createGeometricallyValidProject();
    const level = getGroundLevel(project);

    level.walls.push({
      id: "reversed-north-wall",
      start: { x: 500, z: 0 },
      end: { x: 0, z: 0 },
      height: 280,
      thickness: 20,
      roomIds: ["living-room"],
      openings: []
    });

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.DUPLICATE_WALL_GEOMETRY,
        path: "building.levels[0].walls[2]"
      }
    ]);
  });

  it("accepts valid counter-clockwise Room boundaries", () => {
    const project = createGeometricallyValidProject();

    setRoomBoundaryWalls(project, structuredClone(rectangleWalls), structuredClone(ccwRectangleBoundary));

    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
  });

  it("skips Room polygon validation for draft boundaries", () => {
    const project = createGeometricallyValidProject();

    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
  });

  it("reports Room boundaries with invalid persisted wall order", () => {
    const project = createGeometricallyValidProject();

    setRoomBoundaryWalls(project, structuredClone(rectangleWalls), [
      { wallId: "north-wall", direction: "FORWARD" },
      { wallId: "south-wall", direction: "FORWARD" },
      { wallId: "east-wall", direction: "FORWARD" },
      { wallId: "west-wall", direction: "FORWARD" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.INVALID_ROOM_BOUNDARY_ORDER,
        path: "building.levels[0].rooms[0].boundary[1]"
      }
    ]);
  });

  it("reports enum-valid Room boundary directions that break continuity", () => {
    const project = createGeometricallyValidProject();

    setRoomBoundaryWalls(project, structuredClone(rectangleWalls), [
      { wallId: "north-wall", direction: "FORWARD" },
      { wallId: "east-wall", direction: "REVERSE" },
      { wallId: "south-wall", direction: "FORWARD" },
      { wallId: "west-wall", direction: "FORWARD" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.INVALID_ROOM_BOUNDARY_DIRECTION,
        path: "building.levels[0].rooms[0].boundary[1]"
      }
    ]);
  });

  it("reports internally continuous Room boundaries that do not close", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      ...structuredClone(rectangleWalls.slice(0, 3)),
      {
        id: "west-wall",
        start: { x: 0, z: 350 },
        end: { x: 0, z: 40 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      }
    ];

    setRoomBoundaryWalls(project, walls, structuredClone(ccwRectangleBoundary));

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.OPEN_ROOM_BOUNDARY,
        path: "building.levels[0].rooms[0].boundary"
      }
    ]);
  });

  it("skips Room geometry cascades when a boundary wall is missing", () => {
    const project = createGeometricallyValidProject();

    setRoomBoundaryWalls(project, structuredClone(rectangleWalls), [
      { wallId: "missing-wall", direction: "FORWARD" },
      { wallId: "east-wall", direction: "FORWARD" },
      { wallId: "south-wall", direction: "FORWARD" },
      { wallId: "west-wall", direction: "FORWARD" }
    ]);

    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
  });

  it("reports clockwise Room boundaries", () => {
    const project = createGeometricallyValidProject();

    setRoomBoundaryWalls(project, structuredClone(rectangleWalls), [
      { wallId: "west-wall", direction: "REVERSE" },
      { wallId: "south-wall", direction: "REVERSE" },
      { wallId: "east-wall", direction: "REVERSE" },
      { wallId: "north-wall", direction: "REVERSE" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.CLOCKWISE_OUTER_ROOM_BOUNDARY,
        path: "building.levels[0].rooms[0].boundary"
      }
    ]);
  });

  it("reports zero-area Room boundaries", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      {
        id: "wall-a",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "wall-b",
        start: { x: 100, z: 0 },
        end: { x: 200, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "wall-c",
        start: { x: 200, z: 0 },
        end: { x: 0, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      }
    ];

    setRoomBoundaryWalls(project, walls, [
      { wallId: "wall-a", direction: "FORWARD" },
      { wallId: "wall-b", direction: "FORWARD" },
      { wallId: "wall-c", direction: "FORWARD" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.DEGENERATE_ROOM_BOUNDARY,
        path: "building.levels[0].rooms[0].boundary"
      }
    ]);
  });

  it("reports self-intersecting Room boundaries", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      {
        id: "wall-a",
        start: { x: 0, z: 0 },
        end: { x: 500, z: 350 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "wall-b",
        start: { x: 500, z: 350 },
        end: { x: 0, z: 350 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "wall-c",
        start: { x: 0, z: 350 },
        end: { x: 500, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "wall-d",
        start: { x: 500, z: 0 },
        end: { x: 0, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      }
    ];

    setRoomBoundaryWalls(project, walls, [
      { wallId: "wall-a", direction: "FORWARD" },
      { wallId: "wall-b", direction: "FORWARD" },
      { wallId: "wall-c", direction: "FORWARD" },
      { wallId: "wall-d", direction: "FORWARD" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.SELF_INTERSECTING_ROOM_BOUNDARY,
        path: "building.levels[0].rooms[0].boundary[2]"
      }
    ]);
  });

  it("allows valid concave simple Room boundaries", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      { id: "wall-a", start: { x: 0, z: 0 }, end: { x: 500, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-b", start: { x: 500, z: 0 }, end: { x: 500, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-c", start: { x: 500, z: 300 }, end: { x: 300, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-d", start: { x: 300, z: 300 }, end: { x: 300, z: 150 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-e", start: { x: 300, z: 150 }, end: { x: 0, z: 150 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-f", start: { x: 0, z: 150 }, end: { x: 0, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] }
    ];

    setRoomBoundaryWalls(project, walls, [
      { wallId: "wall-a", direction: "FORWARD" },
      { wallId: "wall-b", direction: "FORWARD" },
      { wallId: "wall-c", direction: "FORWARD" },
      { wallId: "wall-d", direction: "FORWARD" },
      { wallId: "wall-e", direction: "FORWARD" },
      { wallId: "wall-f", direction: "FORWARD" }
    ]);

    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
  });

  it("reports partially overlapping Room boundary segments", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      { id: "wall-a", start: { x: 0, z: 0 }, end: { x: 500, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-b", start: { x: 500, z: 0 }, end: { x: 250, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-c", start: { x: 250, z: 0 }, end: { x: 250, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-d", start: { x: 250, z: 300 }, end: { x: 0, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-e", start: { x: 0, z: 300 }, end: { x: 0, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] }
    ];

    setRoomBoundaryWalls(project, walls, [
      { wallId: "wall-a", direction: "FORWARD" },
      { wallId: "wall-b", direction: "FORWARD" },
      { wallId: "wall-c", direction: "FORWARD" },
      { wallId: "wall-d", direction: "FORWARD" },
      { wallId: "wall-e", direction: "FORWARD" }
    ]);

    const result = validateProjectGeometry(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.PARTIAL_BOUNDARY_OVERLAP,
        path: "building.levels[0].rooms[0].boundary[1]"
      }
    ]);
  });

  it("allows consecutive collinear Room boundary segments that meet at one endpoint", () => {
    const project = createGeometricallyValidProject();
    const walls = [
      { id: "wall-a", start: { x: 0, z: 0 }, end: { x: 250, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-b", start: { x: 250, z: 0 }, end: { x: 500, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-c", start: { x: 500, z: 0 }, end: { x: 500, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-d", start: { x: 500, z: 300 }, end: { x: 0, z: 300 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] },
      { id: "wall-e", start: { x: 0, z: 300 }, end: { x: 0, z: 0 }, height: 280, thickness: 20, roomIds: ["living-room"], openings: [] }
    ];

    setRoomBoundaryWalls(project, walls, [
      { wallId: "wall-a", direction: "FORWARD" },
      { wallId: "wall-b", direction: "FORWARD" },
      { wallId: "wall-c", direction: "FORWARD" },
      { wallId: "wall-d", direction: "FORWARD" },
      { wallId: "wall-e", direction: "FORWARD" }
    ]);

    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
  });

  it("collects multiple geometry errors deterministically", () => {
    const project = createGeometricallyValidProject();
    const level = getGroundLevel(project);
    const wall = level.walls[0];
    const flight = level.staircases[0]?.flights[0];
    const landing = level.staircases[0]?.landings[0];

    if (!wall || !flight || !landing) {
      throw new Error("Test fixture is missing geometry entities.");
    }

    wall.openings[0]!.offsetFromStart = 480;
    level.walls.push({
      id: "duplicate-north-wall",
      start: { x: 0, z: 0 },
      end: { x: 500, z: 0 },
      height: 280,
      thickness: 20,
      roomIds: ["living-room"],
      openings: []
    });
    flight.end = { ...flight.start };
    flight.endElevation = 0;
    landing.width = 0;

    const result = validateProjectGeometry(project);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.OPENING_OUTSIDE_WALL,
      ValidationErrorCode.DUPLICATE_WALL_GEOMETRY,
      ValidationErrorCode.STAIR_FLIGHT_ZERO_LENGTH,
      ValidationErrorCode.STAIR_FLIGHT_NOT_ASCENDING,
      ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_WIDTH
    ]);
  });
});
