import { describe, expect, it } from "vitest";
import type { Level, Project } from "@casastudio/schema";

import {
  deleteProjectSelection,
  getProjectSelectionCapabilities,
  resolveProjectSelectionRoots,
  translateProjectSelection,
  type ProjectSelectionRoot
} from "./project-selection-transforms";

const roomBoundary = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
) => [
  {
    kind: "FREE" as const,
    start: { x: minX, z: minZ },
    end: { x: maxX, z: minZ }
  },
  {
    kind: "FREE" as const,
    start: { x: maxX, z: minZ },
    end: { x: maxX, z: maxZ }
  },
  {
    kind: "FREE" as const,
    start: { x: maxX, z: maxZ },
    end: { x: minX, z: maxZ }
  },
  {
    kind: "FREE" as const,
    start: { x: minX, z: maxZ },
    end: { x: minX, z: minZ }
  }
];

function fixture(): Project {
  return {
    id: "selection-transform-project",
    name: "Selection transforms",
    schemaVersion: "4.0.0",
    revision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "building",
      name: "Building",
      type: "HOUSE",
      furniture: [
        {
          id: "chair-a",
          roomId: "lower",
          definitionId: "generic-chair",
          position: { x: 100, z: 100 },
          rotation: 0,
          width: 40,
          depth: 40,
          height: 80
        },
        {
          id: "chair-b",
          roomId: "lower",
          definitionId: "generic-chair",
          position: { x: 200, z: 100 },
          rotation: 0,
          width: 40,
          depth: 40,
          height: 80
        },
        {
          id: "upper-chair",
          roomId: "upper-room",
          definitionId: "generic-chair",
          position: { x: 100, z: 100 },
          rotation: 0,
          width: 40,
          depth: 40,
          height: 80
        }
      ],
      levels: [
        {
          id: "ground",
          name: "Ground",
          elevation: 0,
          walls: [
            {
              id: "wall",
              start: { x: 1100, z: 0 },
              end: { x: 1300, z: 0 },
              height: 280,
              thickness: 20,
              roomIds: [],
              openings: [
                {
                  id: "door",
                  type: "DOOR",
                  offsetFromStart: 50,
                  width: 80,
                  height: 210,
                  elevation: 0,
                  hingeSide: "START",
                  swingSide: "LEFT"
                }
              ]
            }
          ],
          rooms: [
            {
              id: "lower",
              name: "Lower",
              type: "OTHER",
              boundary: roomBoundary(0, 0, 1000, 1000)
            },
            {
              id: "upper-room",
              name: "Upper platform",
              type: "OTHER",
              elevation: 200,
              boundary: roomBoundary(0, 0, 1000, 1000)
            }
          ],
          staircases: [
            {
              id: "stair",
              fromLevelId: "ground",
              toLevelId: "upper",
              width: 90,
              flights: [
                {
                  id: "flight",
                  start: { x: 500, z: 500 },
                  end: { x: 800, z: 500 },
                  width: 90,
                  stepCount: 15,
                  startElevation: 0,
                  endElevation: 300
                }
              ],
              landings: []
            }
          ]
        },
        {
          id: "upper",
          name: "Upper",
          elevation: 300,
          walls: [],
          rooms: [],
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

const level = (project: Project): Level => project.building.levels[0]!;

describe("Project selection transforms", () => {
  it("moves Furniture groups rigidly without colliding with their old footprints", () => {
    const project = fixture();
    const roots: ProjectSelectionRoot[] = [
      { kind: "FURNITURE", id: "chair-a", roomId: "lower" },
      { kind: "FURNITURE", id: "chair-b", roomId: "lower" }
    ];
    const result = translateProjectSelection(project, level(project), roots, {
      x: 10,
      z: 5
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.building.furniture.slice(0, 2).map((item) => item.position)
    ).toEqual([
      { x: 110, z: 105 },
      { x: 210, z: 105 }
    ]);
  });

  it("uses floor-aware Furniture validation and moves Staircase aggregates in mixed groups", () => {
    const project = fixture();
    const roots: ProjectSelectionRoot[] = [
      { kind: "FURNITURE", id: "chair-a", roomId: "lower" },
      { kind: "FURNITURE", id: "upper-chair", roomId: "upper-room" },
      { kind: "STAIRCASE", id: "stair" }
    ];
    const result = translateProjectSelection(project, level(project), roots, {
      x: 10,
      z: 0
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.building.levels[0]?.staircases[0]?.flights[0]?.start
    ).toEqual({ x: 510, z: 500 });
    expect(
      result.project.building.furniture.find(
        (item) => item.id === "upper-chair"
      )?.position
    ).toEqual({ x: 110, z: 100 });
  });

  it("rejects Wall-bounded Room translation and group rotation deterministically", () => {
    const project = fixture();
    const currentLevel = level(project);
    currentLevel.rooms.push({
      id: "wall-room",
      name: "Wall room",
      type: "OTHER",
      boundary: [
        { wallId: "a", direction: "FORWARD" },
        { wallId: "b", direction: "FORWARD" },
        { wallId: "c", direction: "FORWARD" }
      ]
    });
    const capabilities = getProjectSelectionCapabilities(currentLevel, [
      { kind: "ROOM", id: "wall-room" },
      { kind: "FURNITURE", id: "chair-a", roomId: "lower" }
    ]);
    expect(capabilities.translate.supported).toBe(false);
    expect(capabilities.rotate.supported).toBe(false);
  });

  it("normalizes owned Openings and Stair children before one atomic delete", () => {
    const project = fixture();
    const currentLevel = level(project);
    const roots = resolveProjectSelectionRoots(
      project,
      currentLevel,
      {} as never,
      [
        { kind: "WALL", geometryId: "wall" },
        { kind: "DOOR", geometryId: "door" },
        { kind: "STAIRCASE", geometryId: "stair" },
        { kind: "STAIR_FLIGHT", geometryId: "flight" }
      ]
    );
    expect(roots).toEqual([
      { kind: "WALL", id: "wall" },
      { kind: "STAIRCASE", id: "stair" }
    ]);
    const result = deleteProjectSelection(project, currentLevel, roots);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.walls).toHaveLength(0);
    expect(result.project.building.levels[0]?.staircases).toHaveLength(0);
    expect(project.building.levels[0]?.walls).toHaveLength(1);
    expect(project.building.levels[0]?.staircases).toHaveLength(1);
  });

  it("returns a failed multi-delete without mutating the original Project", () => {
    const project = fixture();
    const before = structuredClone(project);
    const result = deleteProjectSelection(project, level(project), [
      { kind: "WALL", id: "wall" },
      { kind: "FURNITURE", id: "missing", roomId: "lower" }
    ]);
    expect(result.ok).toBe(false);
    expect(project).toEqual(before);
  });
});
