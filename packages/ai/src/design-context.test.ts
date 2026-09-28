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
  it("derives only target Room semantic context and leaves Project untouched", () => {
    const project = createProject();
    const before = structuredClone(project);
    const context = deriveDesignContext(project, target);

    expect(context.room).toMatchObject({
      id: "living",
      floorElevation: 0,
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
