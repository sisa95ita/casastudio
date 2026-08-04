import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode
} from "../validation/index.js";
import { reverseWallDirection } from "./reverse-wall-direction.js";

const createProject = (): Project => ({
  id: "reverse-wall-fixture",
  name: "Reverse Wall Fixture",
  schemaVersion: "2.0.0",
  revision: 7,
  createdAt: "2026-07-29T10:00:00+02:00",
  updatedAt: "2026-07-29T10:30:00+02:00",
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
            id: "left-room",
            name: "Left Room",
            type: "LIVING_ROOM",
            boundary: [
              { wallId: "left-bottom-wall", direction: "FORWARD" },
              { wallId: "shared-wall", direction: "FORWARD" },
              { wallId: "left-top-wall", direction: "FORWARD" },
              { wallId: "left-outer-wall", direction: "FORWARD" }
            ]
          },
          {
            id: "right-room",
            name: "Right Room",
            type: "BEDROOM",
            description: "Room on the far side of the shared wall.",
            boundary: [
              { wallId: "right-bottom-wall", direction: "FORWARD" },
              { wallId: "right-outer-wall", direction: "FORWARD" },
              { wallId: "right-top-wall", direction: "FORWARD" },
              { wallId: "shared-wall", direction: "REVERSE" }
            ]
          },
          {
            id: "draft-room",
            name: "Draft Room",
            type: "OTHER",
            boundary: []
          }
        ],
        walls: [
          {
            id: "left-bottom-wall",
            start: { x: 0, z: 0 },
            end: { x: 100, z: 0 },
            height: 280,
            thickness: 20,
            roomIds: ["left-room"],
            openings: [
              {
                id: "unrelated-window",
                type: "WINDOW",
                offsetFromStart: 20,
                width: 30,
                height: 120,
                elevation: 90
              }
            ]
          },
          {
            id: "shared-wall",
            name: "Shared wall",
            description: "Separates the two finished rooms.",
            start: { x: 100, z: 0 },
            end: { x: 100, z: 100 },
            height: 280,
            thickness: 18,
            roomIds: ["left-room", "right-room"],
            openings: [
              {
                id: "shared-door",
                name: "Shared Door",
                description: "Passage between rooms.",
                type: "DOOR",
                offsetFromStart: 10,
                width: 20,
                height: 210,
                elevation: 0,
                connectedRoomIds: ["left-room", "right-room"]
              },
              {
                id: "shared-window",
                type: "WINDOW",
                offsetFromStart: 70,
                width: 30,
                height: 90,
                elevation: 110
              }
            ]
          },
          {
            id: "left-top-wall",
            start: { x: 100, z: 100 },
            end: { x: 0, z: 100 },
            height: 280,
            thickness: 20,
            roomIds: ["left-room"],
            openings: []
          },
          {
            id: "left-outer-wall",
            start: { x: 0, z: 100 },
            end: { x: 0, z: 0 },
            height: 280,
            thickness: 20,
            roomIds: ["left-room"],
            openings: []
          },
          {
            id: "right-bottom-wall",
            start: { x: 100, z: 0 },
            end: { x: 200, z: 0 },
            height: 280,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          },
          {
            id: "right-outer-wall",
            start: { x: 200, z: 0 },
            end: { x: 200, z: 100 },
            height: 280,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          },
          {
            id: "right-top-wall",
            start: { x: 200, z: 100 },
            end: { x: 100, z: 100 },
            height: 280,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          },
          {
            id: "unassigned-wall",
            start: { x: 300, z: 0 },
            end: { x: 400, z: 0 },
            height: 250,
            thickness: 16,
            roomIds: [],
            openings: []
          }
        ],
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

const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project)) as Project;

const getOnlyLevel = (project: Project) => {
  const level = project.building.levels[0];

  if (!level) {
    throw new Error("Fixture is missing its level.");
  }

  return level;
};

const getWall = (project: Project, wallId: string) => {
  const wall = getOnlyLevel(project).walls.find((candidate) => candidate.id === wallId);

  if (!wall) {
    throw new Error(`Fixture is missing wall "${wallId}".`);
  }

  return wall;
};

const getRoom = (project: Project, roomId: string) => {
  const room = getOnlyLevel(project).rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    throw new Error(`Fixture is missing room "${roomId}".`);
  }

  return room;
};

const expectSemanticValidatorsToPass = (project: Project) => {
  expect(validateProjectCrossReferences(project)).toEqual({ valid: true, errors: [] });
  expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
};

describe("reverseWallDirection", () => {
  it("swaps endpoints, preserves unrelated wall fields, and does not mutate the input", () => {
    const project = createProject();
    const originalProject = cloneProject(project);
    const result = reverseWallDirection(project, "shared-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reversedWall = getWall(result.project, "shared-wall");
    const originalWall = getWall(originalProject, "shared-wall");

    expect(result.project).not.toBe(project);
    expect(result.project).not.toEqual(project);
    expect(project).toEqual(originalProject);
    expect(reversedWall.start).toEqual(originalWall.end);
    expect(reversedWall.end).toEqual(originalWall.start);
    expect(reversedWall).toMatchObject({
      id: originalWall.id,
      name: originalWall.name,
      description: originalWall.description,
      height: originalWall.height,
      thickness: originalWall.thickness,
      roomIds: originalWall.roomIds
    });
  });

  it("inverts one referencing room boundary direction without changing order or wall roomIds", () => {
    const project = createProject();
    const leftRoomBoundaryBefore = [...getRoom(project, "left-room").boundary];
    const result = reverseWallDirection(project, "left-bottom-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const leftRoom = getRoom(result.project, "left-room");

    expect(leftRoom.boundary.map((edge) => edge.wallId)).toEqual(
      leftRoomBoundaryBefore.map((edge) => edge.wallId)
    );
    expect(leftRoom.boundary[0]).toEqual({
      wallId: "left-bottom-wall",
      direction: "REVERSE"
    });
    expect(leftRoom.boundary.slice(1)).toEqual(leftRoomBoundaryBefore.slice(1));
    expect(getWall(result.project, "left-bottom-wall").roomIds).toEqual(["left-room"]);
  });

  it("inverts both directions for a shared wall and preserves valid topology", () => {
    const result = reverseWallDirection(createProject(), "shared-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getRoom(result.project, "left-room").boundary[1]).toEqual({
      wallId: "shared-wall",
      direction: "REVERSE"
    });
    expect(getRoom(result.project, "right-room").boundary[3]).toEqual({
      wallId: "shared-wall",
      direction: "FORWARD"
    });
    expectSemanticValidatorsToPass(result.project);
  });

  it("reverses an unassigned wall without changing room boundaries", () => {
    const project = createProject();
    const roomBoundariesBefore = getOnlyLevel(project).rooms.map((room) => room.boundary);
    const result = reverseWallDirection(project, "unassigned-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getWall(result.project, "unassigned-wall")).toMatchObject({
      start: { x: 400, z: 0 },
      end: { x: 300, z: 0 },
      roomIds: []
    });
    expect(getOnlyLevel(result.project).rooms.map((room) => room.boundary)).toEqual(roomBoundariesBefore);
  });

  it("transforms door and window offsets while preserving opening metadata", () => {
    const result = reverseWallDirection(createProject(), "shared-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const openings = getWall(result.project, "shared-wall").openings;

    expect(openings[0]).toEqual({
      id: "shared-door",
      name: "Shared Door",
      description: "Passage between rooms.",
      type: "DOOR",
      offsetFromStart: 70,
      width: 20,
      height: 210,
      elevation: 0,
      connectedRoomIds: ["left-room", "right-room"]
    });
    expect(openings[1]).toEqual({
      id: "shared-window",
      type: "WINDOW",
      offsetFromStart: 0,
      width: 30,
      height: 90,
      elevation: 110
    });
  });

  it("leaves unrelated rooms, walls, openings, and metadata unchanged", () => {
    const project = createProject();
    const originalProject = cloneProject(project);
    const result = reverseWallDirection(project, "shared-wall");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.project).toMatchObject({
      id: originalProject.id,
      name: originalProject.name,
      schemaVersion: originalProject.schemaVersion,
      revision: originalProject.revision,
      createdAt: originalProject.createdAt,
      updatedAt: originalProject.updatedAt,
      units: originalProject.units
    });
    expect(getRoom(result.project, "draft-room")).toEqual(getRoom(originalProject, "draft-room"));
    expect(getWall(result.project, "left-bottom-wall")).toEqual(getWall(originalProject, "left-bottom-wall"));
  });

  it("returns a validation error and no project when the wall is missing", () => {
    expect(() => reverseWallDirection(createProject(), "missing-wall")).not.toThrow();

    const result = reverseWallDirection(createProject(), "missing-wall");

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: ValidationErrorCode.WALL_NOT_FOUND,
          path: "building.levels[].walls[].id",
          message: 'Wall "missing-wall" could not be found.'
        }
      ]
    });
    expect("project" in result).toBe(false);
  });

  it("returns a validation error and does not reverse duplicate wall ids", () => {
    const project = createProject();
    const originalProject = cloneProject(project);
    const duplicateWall = {
      ...getWall(project, "unassigned-wall"),
      id: "shared-wall"
    };

    getOnlyLevel(project).walls.push(duplicateWall);

    const result = reverseWallDirection(project, "shared-wall");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.DUPLICATE_WALL_ID,
        path: "building.levels[].walls[].id"
      }
    ]);
    expect(getWall(project, "shared-wall")).toEqual(getWall(originalProject, "shared-wall"));
    expect("project" in result).toBe(false);
  });

  it("returns post-operation validation errors and no project", () => {
    const project = createProject();
    const opening = getWall(project, "shared-wall").openings[0];

    if (!opening) {
      throw new Error("Fixture is missing its opening.");
    }

    opening.offsetFromStart = -10;

    const result = reverseWallDirection(project, "shared-wall");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.OPENING_OUTSIDE_WALL,
        path: "building.levels[0].walls[1].openings[0]"
      }
    ]);
    expect("project" in result).toBe(false);
  });

  it("restores the original project when applied twice to the same wall", () => {
    const project = createProject();
    const firstResult = reverseWallDirection(project, "shared-wall");

    expect(firstResult.ok).toBe(true);
    if (!firstResult.ok) return;

    const secondResult = reverseWallDirection(firstResult.project, "shared-wall");

    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) return;

    expect(secondResult.project).toEqual(project);
  });
});
