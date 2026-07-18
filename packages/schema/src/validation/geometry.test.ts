import { describe, expect, it } from "vitest";

import type { Project } from "../project";
import { validateProjectGeometry } from "./geometry";
import { ValidationErrorCode } from "./validation-error-code";

const createGeometricallyValidProject = (): Project => ({
  id: "geometry-fixture",
  name: "Geometry Fixture",
  schemaVersion: "1.0.0",
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
            wallIds: ["north-wall", "east-wall"]
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

  it("reports duplicate Wall geometry in the same Level without treating reversed Walls as duplicates", () => {
    const project = createGeometricallyValidProject();
    const level = getGroundLevel(project);

    level.walls.push(
      {
        id: "duplicate-north-wall",
        start: { x: 0, z: 0 },
        end: { x: 500, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "reversed-north-wall",
        start: { x: 500, z: 0 },
        end: { x: 0, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["living-room"],
        openings: []
      }
    );

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
