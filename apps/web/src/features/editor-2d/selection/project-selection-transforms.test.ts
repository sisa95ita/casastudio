import { describe, expect, it } from "vitest";
import type { Level, Project } from "@casastudio/schema";
import { createFurnitureFootprint2D } from "../../geometry-2d/presentation/plan-footprints-2d";

import {
  alignFurnitureSelection,
  deleteProjectSelection,
  distributeFurnitureSelection,
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
  it.each([
    ["left", "minX"],
    ["center-x", "centerX"],
    ["right", "maxX"],
    ["top", "minZ"],
    ["center-z", "centerZ"],
    ["bottom", "maxZ"]
  ] as const)(
    "aligns oriented footprint extents for %s to the last-selected stationary anchor",
    (alignment, extent) => {
      const project = fixture();
      project.building.furniture[0]!.position = { x: 100, z: 100 };
      project.building.furniture[0]!.rotation = 45;
      project.building.furniture[0]!.width = 60;
      project.building.furniture[0]!.depth = 30;
      project.building.furniture[1]!.position = { x: 400, z: 400 };
      const roots: ProjectSelectionRoot[] = [
        { kind: "FURNITURE", id: "chair-a", roomId: "lower" },
        { kind: "FURNITURE", id: "chair-b", roomId: "lower" }
      ];
      const movingBefore = structuredClone(project.building.furniture[0]!);
      const anchor = structuredClone(project.building.furniture[1]!);
      const result = alignFurnitureSelection(
        project,
        level(project),
        roots,
        alignment
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const moved = result.project.building.furniture[0]!;
      expect(result.project.building.furniture[1]).toEqual(anchor);
      expect(bounds(moved)[extent]).toBeCloseTo(bounds(anchor)[extent]);
      expect(moved.position).not.toEqual(movingBefore.position);
      expect(moved.rotation).toBe(movingBefore.rotation);
      expect(moved.width).toBe(movingBefore.width);
      expect(moved.depth).toBe(movingBefore.depth);
      expect(moved.height).toBe(movingBefore.height);
      expect(moved.roomId).toBe(movingBefore.roomId);
    }
  );

  it("rejects an entire alignment that would collide with unselected Furniture", () => {
    const project = fixture();
    project.building.furniture[0]!.position = { x: 100, z: 100 };
    project.building.furniture[1]!.position = { x: 300, z: 300 };
    project.building.furniture.push({
      ...project.building.furniture[0]!,
      id: "blocker",
      position: { x: 100, z: 300 }
    });
    const before = structuredClone(project);
    const result = alignFurnitureSelection(
      project,
      level(project),
      [
        { kind: "FURNITURE", id: "chair-a", roomId: "lower" },
        { kind: "FURNITURE", id: "chair-b", roomId: "lower" }
      ],
      "top"
    );
    expect(result.ok).toBe(false);
    expect(project).toEqual(before);
  });

  it("distributes unequal footprint widths with fixed outer items and equal clear gaps", () => {
    const project = fixture();
    project.building.furniture = [
      {
        ...project.building.furniture[0]!,
        position: { x: 100, z: 300 },
        width: 40
      },
      {
        ...project.building.furniture[1]!,
        position: { x: 480, z: 300 },
        width: 80
      },
      {
        ...project.building.furniture[0]!,
        id: "chair-c",
        position: { x: 800, z: 300 },
        width: 120
      }
    ];
    const beforeFirst = structuredClone(project.building.furniture[0]);
    const beforeLast = structuredClone(project.building.furniture[2]);
    const roots: ProjectSelectionRoot[] = [
      { kind: "FURNITURE", id: "chair-c", roomId: "lower" },
      { kind: "FURNITURE", id: "chair-a", roomId: "lower" },
      { kind: "FURNITURE", id: "chair-b", roomId: "lower" }
    ];
    const result = distributeFurnitureSelection(
      project,
      level(project),
      roots,
      "horizontal"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.furniture[0]).toEqual(
      project.building.furniture[0]
    );
    expect(result.project.building.furniture[2]).toEqual(beforeLast);
    const ordered = [...result.project.building.furniture].sort(
      (a, b) => bounds(a).minX - bounds(b).minX
    );
    const firstGap = bounds(ordered[1]!).minX - bounds(ordered[0]!).maxX;
    const secondGap = bounds(ordered[2]!).minX - bounds(ordered[1]!).maxX;
    expect(firstGap).toBeCloseTo(secondGap);
    expect(result.project.building.furniture[0]).toEqual(beforeFirst);
  });

  it("distributes unequal footprint depths vertically with fixed outer items and equal clear gaps", () => {
    const project = fixture();
    project.building.furniture = [
      {
        ...project.building.furniture[0]!,
        position: { x: 300, z: 100 },
        depth: 40
      },
      {
        ...project.building.furniture[1]!,
        position: { x: 300, z: 480 },
        depth: 80
      },
      {
        ...project.building.furniture[0]!,
        id: "chair-c",
        position: { x: 300, z: 800 },
        depth: 120
      }
    ];
    const beforeFirst = structuredClone(project.building.furniture[0]);
    const beforeMiddle = structuredClone(project.building.furniture[1]);
    const beforeLast = structuredClone(project.building.furniture[2]);
    const result = distributeFurnitureSelection(
      project,
      level(project),
      [
        { kind: "FURNITURE", id: "chair-b", roomId: "lower" },
        { kind: "FURNITURE", id: "chair-c", roomId: "lower" },
        { kind: "FURNITURE", id: "chair-a", roomId: "lower" }
      ],
      "vertical"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ordered = [...result.project.building.furniture].sort(
      (a, b) => bounds(a).minZ - bounds(b).minZ
    );
    const firstGap = bounds(ordered[1]!).minZ - bounds(ordered[0]!).maxZ;
    const secondGap = bounds(ordered[2]!).minZ - bounds(ordered[1]!).maxZ;
    expect(firstGap).toBeCloseTo(secondGap);
    expect(result.project.building.furniture[0]).toEqual(beforeFirst);
    expect(result.project.building.furniture[1]).not.toEqual(beforeMiddle);
    expect(result.project.building.furniture[2]).toEqual(beforeLast);
  });

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

const footprint = (item: Project["building"]["furniture"][number]) =>
  createFurnitureFootprint2D(item);

const bounds = (item: Project["building"]["furniture"][number]) => {
  const points = footprint(item);
  const minX = Math.min(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxZ = Math.max(...points.map((point) => point.z));
  return {
    minX,
    minZ,
    maxX,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2
  };
};
