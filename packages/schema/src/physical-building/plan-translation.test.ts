import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { translatePlanEntities } from "./plan-translation.js";

function fixture(): Project {
  return {
    id: "translation-project",
    name: "Translation",
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
          id: "chair",
          roomId: "platform",
          definitionId: "generic-chair",
          position: { x: 50, z: 50 },
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
              id: "wall-a",
              start: { x: 200, z: 0 },
              end: { x: 400, z: 0 },
              height: 280,
              thickness: 20,
              roomIds: [],
              openings: [
                {
                  id: "window-a",
                  type: "WINDOW",
                  offsetFromStart: 50,
                  width: 80,
                  height: 120,
                  elevation: 90
                }
              ]
            }
          ],
          rooms: [
            {
              id: "platform",
              name: "Platform",
              type: "OTHER",
              elevation: 100,
              boundary: [
                { kind: "FREE", start: { x: 0, z: 0 }, end: { x: 100, z: 0 } },
                {
                  kind: "FREE",
                  start: { x: 100, z: 0 },
                  end: { x: 100, z: 100 }
                },
                {
                  kind: "FREE",
                  start: { x: 100, z: 100 },
                  end: { x: 0, z: 100 }
                },
                { kind: "FREE", start: { x: 0, z: 100 }, end: { x: 0, z: 0 } }
              ]
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
                  start: { x: 500, z: 0 },
                  end: { x: 800, z: 0 },
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

describe("canonical plan translation", () => {
  it("moves compatible mixed roots rigidly and carries Wall-owned Openings", () => {
    const result = translatePlanEntities(fixture(), {
      levelId: "ground",
      delta: { x: 10, z: 20 },
      wallIds: ["wall-a"],
      furnitureIds: ["chair"],
      staircaseIds: ["stair"]
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls[0]).toMatchObject({
      start: { x: 210, z: 20 },
      end: { x: 410, z: 20 },
      openings: [
        expect.objectContaining({ id: "window-a", offsetFromStart: 50 })
      ]
    });
    expect(level.staircases[0]?.flights[0]).toMatchObject({
      start: { x: 510, z: 20 },
      end: { x: 810, z: 20 }
    });
    expect(result.project.building.furniture[0]?.position).toEqual({
      x: 60,
      z: 70
    });
  });

  it("moves a free Room and its Furniture dependency", () => {
    const result = translatePlanEntities(fixture(), {
      levelId: "ground",
      delta: { x: 25, z: -10 },
      roomIds: ["platform"]
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.building.levels[0]?.rooms[0]?.boundary[0]
    ).toMatchObject({
      start: { x: 25, z: -10 },
      end: { x: 125, z: -10 }
    });
    expect(result.project.building.furniture[0]?.position).toEqual({
      x: 75,
      z: 40
    });
  });

  it("constrains directly selected Openings to their owning Wall", () => {
    const moved = translatePlanEntities(fixture(), {
      levelId: "ground",
      delta: { x: 10, z: 0 },
      openingIds: ["window-a"]
    });
    expect(moved.ok).toBe(true);
    if (moved.ok)
      expect(
        moved.project.building.levels[0]?.walls[0]?.openings[0]?.offsetFromStart
      ).toBe(60);
    expect(
      translatePlanEntities(fixture(), {
        levelId: "ground",
        delta: { x: 0, z: 1 },
        openingIds: ["window-a"]
      }).ok
    ).toBe(false);
  });

  it("rejects a Wall set sharing a junction with an unselected Wall", () => {
    const project = fixture();
    project.building.levels[0]!.walls.push({
      id: "wall-b",
      start: { x: 400, z: 0 },
      end: { x: 400, z: 200 },
      height: 280,
      thickness: 20,
      roomIds: [],
      openings: []
    });
    expect(
      translatePlanEntities(project, {
        levelId: "ground",
        delta: { x: 10, z: 0 },
        wallIds: ["wall-a"]
      }).ok
    ).toBe(false);
  });

  it("preserves Room identity and boundary references when a closed Wall loop moves", () => {
    const project = fixture();
    const currentLevel = project.building.levels[0]!;
    currentLevel.walls[0]!.roomIds = ["wall-room"];
    currentLevel.walls.push(
      {
        id: "wall-b",
        start: { x: 400, z: 0 },
        end: { x: 400, z: 200 },
        height: 280,
        thickness: 20,
        roomIds: ["wall-room"],
        openings: []
      },
      {
        id: "wall-c",
        start: { x: 400, z: 200 },
        end: { x: 200, z: 200 },
        height: 280,
        thickness: 20,
        roomIds: ["wall-room"],
        openings: []
      },
      {
        id: "wall-d",
        start: { x: 200, z: 200 },
        end: { x: 200, z: 0 },
        height: 280,
        thickness: 20,
        roomIds: ["wall-room"],
        openings: []
      }
    );
    currentLevel.rooms.push({
      id: "wall-room",
      name: "Wall room",
      type: "OTHER",
      boundary: ["wall-a", "wall-b", "wall-c", "wall-d"].map((wallId) => ({
        wallId,
        direction: "FORWARD" as const
      }))
    });

    const result = translatePlanEntities(project, {
      levelId: "ground",
      delta: { x: 10, z: 20 },
      wallIds: ["wall-a", "wall-b", "wall-c", "wall-d"]
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const movedLevel = result.project.building.levels[0]!;
    expect(
      movedLevel.rooms.find((room) => room.id === "wall-room")?.boundary
    ).toEqual(currentLevel.rooms.at(-1)?.boundary);
    expect(movedLevel.walls.map((wall) => wall.start)).toEqual([
      { x: 210, z: 20 },
      { x: 410, z: 20 },
      { x: 410, z: 220 },
      { x: 210, z: 220 }
    ]);
  });
});
