import { createInitialProject, type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { deriveDesignContext, type DesignTarget } from "./index.js";

const target: DesignTarget = {
  kind: "room",
  projectId: "design-project",
  levelId: "ground",
  roomId: "living"
};

function createProject(): Project {
  const initial = createInitialProject({
    projectId: "design-project",
    buildingId: "design-building",
    levelId: "initial-level",
    name: "Design",
    createdAt: "2026-09-28T10:00:00.000Z"
  });
  return {
    ...initial,
    building: {
      ...initial.building,
      furniture: [
        {
          id: "sofa",
          roomId: "living",
          definitionId: "builtin:sofa",
          position: { x: 150, z: 100 },
          rotation: 0,
          width: 180,
          depth: 80,
          height: 90
        },
        {
          id: "upstairs-chair",
          roomId: "bedroom",
          definitionId: "builtin:chair",
          position: { x: 20, z: 20 },
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
          rooms: [
            {
              id: "living",
              name: "Living room",
              type: "LIVING_ROOM",
              boundary: [
                { wallId: "north", direction: "FORWARD" },
                {
                  kind: "FREE",
                  start: { x: 400, z: 0 },
                  end: { x: 400, z: 300 }
                },
                {
                  kind: "FREE",
                  start: { x: 400, z: 300 },
                  end: { x: 0, z: 300 }
                }
              ]
            }
          ],
          walls: [
            {
              id: "north",
              start: { x: 0, z: 0 },
              end: { x: 400, z: 0 },
              height: 270,
              thickness: 20,
              roomIds: ["living"],
              openings: [
                {
                  id: "window",
                  type: "WINDOW",
                  offsetFromStart: 100,
                  width: 120,
                  height: 120,
                  elevation: 90
                }
              ]
            }
          ],
          staircases: [
            {
              id: "living-stair",
              name: "Main stair",
              fromLevelId: "ground",
              toLevelId: "upper",
              fromRoomId: "living",
              toRoomId: "bedroom",
              width: 100,
              flights: [
                {
                  id: "living-flight",
                  start: { x: 300, z: 100 },
                  end: { x: 300, z: 250 },
                  width: 100,
                  stepCount: 12,
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
          rooms: [
            { id: "bedroom", name: "Bedroom", type: "BEDROOM", boundary: [] }
          ],
          walls: [],
          staircases: []
        }
      ]
    }
  };
}

describe("deriveDesignContext", () => {
  function furnitureProject(): Project {
    const project = createProject();
    const points = [
      { x: 700, z: -300 },
      { x: 1100, z: -200 },
      { x: 1050, z: 0 },
      { x: 900, z: -40 },
      { x: 850, z: 180 },
      { x: 650, z: 120 }
    ];
    project.building.levels[0]!.rooms[0]!.boundary = points.map((start, i) => ({
      kind: "FREE",
      start,
      end: points[(i + 1) % points.length]!
    }));
    project.building.furniture = [
      {
        id: "bed",
        roomId: "living",
        definitionId: "generic-double-bed",
        position: { x: 780, z: -150 },
        rotation: 90,
        width: 170,
        depth: 210,
        height: 60
      },
      {
        id: "desk",
        roomId: "living",
        definitionId: "generic-desk",
        position: { x: 900, z: -100 },
        rotation: 0,
        width: 140,
        depth: 65,
        height: 75
      },
      {
        id: "chair",
        roomId: "living",
        definitionId: "generic-chair",
        position: { x: 900, z: -30 },
        rotation: 37,
        width: 45,
        depth: 50,
        height: 85
      },
      {
        id: "external",
        roomId: "living",
        definitionId: "custom:unknown",
        position: { x: 770, z: 60 },
        rotation: -725.5,
        width: 50,
        depth: 50,
        height: 50
      },
      {
        id: "upper",
        roomId: "bedroom",
        definitionId: "generic-chair",
        position: { x: 900, z: -30 },
        rotation: 0,
        width: 45,
        depth: 50,
        height: 85
      },
      {
        id: "unrelated",
        roomId: "other-room",
        definitionId: "generic-chair",
        position: { x: 780, z: -150 },
        rotation: 0,
        width: 45,
        depth: 50,
        height: 85
      }
    ];
    return project;
  }

  it("represents intentional Bed/Desk/Chair layout with canonical dimensions, role, yaw and Room-local centers in a rotated concave Room", () => {
    const project = furnitureProject();
    const before = structuredClone(project);
    const context = deriveDesignContext(project, target);
    expect(context.furniture.map((f) => f.id)).toEqual([
      "bed",
      "chair",
      "desk",
      "external"
    ]);
    expect(context.furniture[0]).toMatchObject({
      definitionId: "generic-double-bed",
      definitionName: "Double bed",
      category: "BED",
      position: { x: 780, z: -150 },
      rotationDegrees: 90,
      width: 170,
      depth: 210,
      height: 60,
      roomLocalPosition: { x: 80, z: 150 }
    });
    expect(context.furnitureLayout).toMatchObject({
      intent: "preserve-by-default",
      origin: { x: 700, z: -300 }
    });
    expect(context.furnitureLayout!.nearbyPairs).toContainEqual(
      expect.objectContaining({
        firstId: "bed",
        secondId: "desk",
        widthAxisRelation: "perpendicular"
      })
    );
    expect(
      context.furniture.find((f) => f.id === "external")
    ).not.toHaveProperty("category");
    expect(
      context.furniture.find((f) => f.id === "external")!.rotationDegrees
    ).toBe(-725.5);
    expect(deriveDesignContext(project, target)).toEqual(context);
    project.building.furniture.reverse();
    expect(deriveDesignContext(project, target)).toEqual(context);
    project.building.furniture.reverse();
    expect(project).toEqual(before);
    expect(Object.isFrozen(context.furniture[0]!.position)).toBe(true);
    expect(Object.isFrozen(context.furnitureLayout!.nearbyPairs)).toBe(true);
  });

  it("re-derives position, nearest finite boundary segment and orientation when canonical Furniture changes", () => {
    const project = furnitureProject();
    const initial = deriveDesignContext(project, target);
    const bed = project.building.furniture[0]!;
    bed.position = { x: 905, z: -39 };
    const moved = deriveDesignContext(project, target);
    expect(moved.furniture[0]!.roomLocalPosition).toEqual({ x: 205, z: 261 });
    expect(moved.furniture[0]!.nearestBoundary!.boundaryIndex).toBe(2);
    expect(moved.furniture[0]!.nearestBoundary).not.toEqual(
      initial.furniture[0]!.nearestBoundary
    );
    bed.rotation = (-Math.atan2(40, 150) * 180) / Math.PI;
    const rotated = deriveDesignContext(project, target);
    expect(rotated.furniture[0]!.nearestBoundary!.widthAxisRelation).toBe(
      "parallel"
    );
    expect(rotated.furnitureLayout!.nearbyPairs).not.toEqual(
      moved.furnitureLayout!.nearbyPairs
    );
  });

  it("avoids invented local/boundary facts without resolved edges and bounds nearby pair prose in a large Room", () => {
    const project = furnitureProject();
    project.building.levels[0]!.rooms[0]!.boundary = [];
    const template = project.building.furniture[0]!;
    project.building.furniture = Array.from({ length: 80 }, (_, i) => ({
      ...template,
      id: `item-${i}`,
      position: { x: i * 10, z: 0 }
    }));
    const context = deriveDesignContext(project, target);
    expect(context.furniture).toHaveLength(80);
    expect(context.furnitureLayout!.nearbyPairs).toHaveLength(24);
    expect(context.furnitureLayout).not.toHaveProperty("origin");
    expect(context.furniture[0]).not.toHaveProperty("nearestBoundary");
    expect(context.furniture[0]).not.toHaveProperty("roomLocalPosition");
  });

  it("derives only target Room semantic context and leaves Project untouched", () => {
    const project = createProject();
    const before = structuredClone(project);
    const context = deriveDesignContext(project, target);

    expect(context.room).toMatchObject({
      id: "living",
      floorElevation: 0,
      area: 120000,
      extents: { width: 400, depth: 300 }
    });
    expect(context.walls).toHaveLength(1);
    expect(context.walls[0]?.openings[0]).toMatchObject({
      id: "window",
      type: "window",
      sillElevation: 90
    });
    expect(context.furniture.map((item) => item.id)).toEqual(["sofa"]);
    expect(context.stairs).toEqual([
      expect.objectContaining({ id: "living-stair", owningLevelId: "ground" })
    ]);
    expect(context).not.toHaveProperty("viewpoints");
    expect(project).toEqual(before);
  });

  it("rejects a Room/Level mismatch instead of searching unrelated Levels", () => {
    expect(() =>
      deriveDesignContext(createProject(), { ...target, levelId: "upper" })
    ).toThrow("could not be found");
  });
});
