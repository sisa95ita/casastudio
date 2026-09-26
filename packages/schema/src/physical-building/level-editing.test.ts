import { describe, expect, it } from "vitest";

import { createInitialProject } from "../project/index.js";
import { ValidationErrorCode } from "../validation/index.js";
import type { Project } from "../project/index.js";
import {
  deleteLevel,
  findHighestLevel,
  createLevel,
  updateLevelProperties
} from "./level-editing.js";

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
    expect(
      updateLevelProperties(project, {
        levelId: "ground-floor",
        name: ""
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED }]
    });
    expect(
      updateLevelProperties(project, {
        levelId: "missing-level",
        elevation: 300
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.LEVEL_NOT_FOUND }]
    });
  });

  it("identifies equal-elevation highest Levels by durable order", () => {
    const tied: Project = structuredClone(project);
    tied.building.levels.push(
      {
        id: "upper-a",
        name: "Upper A",
        elevation: 300,
        rooms: [],
        walls: [],
        staircases: []
      },
      {
        id: "upper-b",
        name: "Upper B",
        elevation: 300,
        rooms: [],
        walls: [],
        staircases: []
      }
    );

    expect(findHighestLevel(tied)?.id).toBe("upper-b");
    expect(deleteLevel(tied, { levelId: "upper-a" }).ok).toBe(false);
  });

  it("never deletes the final Level or a non-highest Level", () => {
    expect(deleteLevel(project, { levelId: "ground-floor" }).ok).toBe(false);
    const twoLevels: Project = structuredClone(project);
    twoLevels.building.levels.push({
      id: "first-floor",
      name: "First Floor",
      elevation: 300,
      rooms: [],
      walls: [],
      staircases: []
    });
    expect(deleteLevel(twoLevels, { levelId: "ground-floor" }).ok).toBe(false);
    expect(twoLevels.building.levels).toHaveLength(2);
  });

  it("atomically cascades the highest Level dependency graph", () => {
    const candidate: Project = structuredClone(project);
    candidate.building.levels[0]!.rooms = [
      {
        id: "ground-room",
        name: "Ground Room",
        type: "OTHER",
        boundary: []
      }
    ];
    candidate.building.levels[0]!.staircases = [
      {
        id: "connected-stair",
        fromLevelId: "ground-floor",
        toLevelId: "first-floor",
        fromRoomId: "ground-room",
        toRoomId: "upper-room",
        width: 90,
        flights: [
          {
            id: "connected-flight",
            start: { x: 0, z: 0 },
            end: { x: 480, z: 0 },
            width: 90,
            stepCount: 16,
            startElevation: 0,
            endElevation: 300
          }
        ],
        landings: []
      }
    ];
    candidate.building.levels.push({
      id: "first-floor",
      name: "First Floor",
      elevation: 300,
      rooms: [
        { id: "upper-room", name: "Upper Room", type: "OTHER", boundary: [] }
      ],
      walls: [
        {
          id: "upper-wall",
          start: { x: 0, z: 0 },
          end: { x: 500, z: 0 },
          height: 270,
          thickness: 20,
          roomIds: [],
          openings: [
            {
              id: "upper-window",
              type: "WINDOW",
              offsetFromStart: 100,
              width: 100,
              height: 120,
              elevation: 80
            }
          ]
        }
      ],
      staircases: []
    });
    candidate.building.furniture = [
      {
        id: "upper-chair",
        roomId: "upper-room",
        definitionId: "generic-chair",
        position: { x: 50, z: 50 },
        rotation: 0,
        width: 50,
        depth: 50,
        height: 90
      }
    ];
    candidate.viewpoints = [
      {
        id: "upper-view",
        levelId: "first-floor",
        roomId: "upper-room",
        cameraPosition: { x: 0, y: 150, z: 0 },
        cameraTarget: { x: 100, y: 100, z: 100 },
        fieldOfView: 60,
        projection: "PERSPECTIVE"
      }
    ];

    const result = deleteLevel(candidate, { levelId: "first-floor" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels.map((level) => level.id)).toEqual([
      "ground-floor"
    ]);
    expect(result.project.building.levels[0]?.staircases).toEqual([]);
    expect(result.project.building.furniture).toEqual([]);
    expect(result.project.viewpoints).toEqual([]);
    expect(candidate.building.levels).toHaveLength(2);
    expect(candidate.building.levels[1]?.walls[0]?.openings).toHaveLength(1);
  });
});
