import type { DesignTarget } from "@casastudio/ai";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../../../test/demo-project-fixture";
import type {
  ArchitecturalScene3DModel,
  Floor3D,
  LevelReference3D,
  ScenePlanVector3D,
  Wall3D
} from "../model/architectural-scene-3d-model";
import {
  createArchitecturalScene3DModel,
  createWall3D,
  triangulateFloorContour3D
} from "../model/architectural-scene-3d-model";
import { createRoomReferencePlans3D } from "./room-reference-camera-3d";

const target = Object.freeze({
  kind: "room" as const,
  projectId: "project",
  levelId: "upper",
  roomId: "concave"
});

describe("Room-aware reference cameras", () => {
  it("derives three deterministic provider-neutral views without a user camera", () => {
    const model = createSyntheticModel();
    const before = structuredClone(model);

    const first = createRoomReferencePlans3D(model, target);
    const second = createRoomReferencePlans3D(model, target);

    expect(first.map((view) => view.kind)).toEqual([
      "room-axonometric",
      "room-interior-a",
      "room-interior-b"
    ]);
    expect(first).toEqual(second);
    expect(first.every((view) => view.target === target)).toBe(true);
    expect(first[1]!.pose.position).not.toEqual(first[2]!.pose.position);
    expect(model).toEqual(before);
  });

  it("handles rotated concave geometry and respects Room floor elevation", () => {
    const views = createRoomReferencePlans3D(createSyntheticModel(), target);

    expect(views).toHaveLength(3);
    expect(views[1]!.pose.position.y).toBeCloseTo(4.65);
    expect(views[2]!.pose.position.y).toBeCloseTo(4.65);
    expect(views[0]!.bounds.min.y).toBeCloseTo(2.82);
    expect(views[0]!.bounds.max.y).toBe(6);
  });

  it("isolates the target Level and retains boundary openings, connected stairs, and Room furniture", () => {
    const views = createRoomReferencePlans3D(createSyntheticModel(), target);

    expect(views[0]).toMatchObject({
      wallIds: ["wall-a", "wall-b", "wall-c", "wall-d", "wall-e", "wall-f"],
      staircaseIds: ["target-stair"],
      furnitureIds: ["target-chair"]
    });
    expect(views[0]!.wallIds).not.toContain("unrelated-wall");
    expect(views[0]!.staircaseIds).not.toContain("unrelated-stair");
    expect(views[0]!.furnitureIds).not.toContain("other-chair");
  });

  it("changes camera target when a different Room is selected", () => {
    const model = createSyntheticModel();
    const other: DesignTarget = {
      ...target,
      roomId: "other"
    };

    const selected = createRoomReferencePlans3D(model, target);
    const changed = createRoomReferencePlans3D(model, other);

    expect(changed).toHaveLength(3);
    expect(changed[0]!.target.roomId).toBe("other");
    expect(changed[0]!.pose.target).not.toEqual(selected[0]!.pose.target);
  });

  it("derives non-boundary relevance without mutating canonical Project ownership or Openings", () => {
    const project = structuredClone(demoProjectFixture);
    project.building.levels[0]!.walls.push({
      id: "independent-interior-wall",
      start: { x: 100, z: 100 },
      end: { x: 300, z: 100 },
      height: 300,
      thickness: 20,
      roomIds: [],
      openings: [{
        id: "independent-window",
        type: "WINDOW",
        offsetFromStart: 50,
        width: 100,
        elevation: 100,
        height: 100
      }]
    });
    const before = structuredClone(project);
    const model = createArchitecturalScene3DModel(project);

    const plans = createRoomReferencePlans3D(model, {
      kind: "room",
      projectId: project.id,
      levelId: "ground-floor",
      roomId: "left-room"
    });

    expect(plans).toHaveLength(3);
    expect(plans.every((plan) => plan.wallIds.includes("independent-interior-wall")))
      .toBe(true);
    expect(project).toEqual(before);
  });
});

function createSyntheticModel(): ArchitecturalScene3DModel {
  const concave = createFloor(
    "concave",
    [
      { x: 2, z: -1 },
      { x: 6, z: -3 },
      { x: 5, z: -5 },
      { x: 3.5, z: -4.25 },
      { x: 2.5, z: -6 },
      { x: 0, z: -4 }
    ],
    3,
    ["wall-a", "wall-b", "wall-c", "wall-d", "wall-e", "wall-f"]
  );
  const other = createFloor(
    "other",
    [
      { x: 12, z: -2 },
      { x: 15, z: -2 },
      { x: 15, z: -5 },
      { x: 12, z: -5 }
    ],
    3,
    ["other-a", "other-b", "other-c", "other-d"]
  );
  const upper = {
    id: "upper",
    name: "Upper",
    elevation: 300,
    y: 3,
    segments: [],
    floors: [concave, other],
    walls: [
      ...createFloorWalls(concave),
      ...createFloorWalls(other),
      createTestWall("unrelated-wall", { x: 20, z: -2 }, { x: 22, z: -2 }, 3)
    ],
    staircases: [
      { id: "target-stair", fromRoomId: "concave", toRoomId: "down" },
      { id: "unrelated-stair", fromRoomId: "other", toRoomId: "down" }
    ],
    furniture: [
      furniture("target-chair", "concave", 2.5, -3.5, 3),
      furniture("other-chair", "other", 13, -3, 3)
    ]
  } as unknown as LevelReference3D;
  const lower = {
    ...upper,
    id: "lower",
    name: "Lower",
    y: 0,
    floors: [],
    walls: [],
    staircases: [],
    furniture: []
  } as unknown as LevelReference3D;
  return Object.freeze({
    sourceProjectId: "project",
    worldLengthUnit: "m",
    levels: Object.freeze([lower, upper]),
    hasArchitecturalGeometry: true
  });
}

function createFloorWalls(floor: Floor3D): Wall3D[] {
  return floor.boundaryWallIds.flatMap((id, index) => {
    if (!id) return [];
    return [createTestWall(
      id,
      floor.contour[index]!,
      floor.contour[(index + 1) % floor.contour.length]!,
      floor.y
    )];
  });
}

function createTestWall(
  id: string,
  start: ScenePlanVector3D,
  end: ScenePlanVector3D,
  y: number
): Wall3D {
  return createWall3D({
    id,
    start: { x: start.x, z: -start.z },
    end: { x: end.x, z: -end.z },
    height: 3,
    thickness: 0.2,
    roomIds: [],
    openings: []
  }, y, "m");
}

function createFloor(
  roomId: string,
  contour: readonly ScenePlanVector3D[],
  y: number,
  wallIds: readonly string[]
): Floor3D {
  return Object.freeze({
    id: `floor:${roomId}`,
    roomId,
    area: 1,
    y,
    bottomY: y - 0.18,
    thickness: 0.18,
    contour: Object.freeze(contour),
    boundaryKinds: Object.freeze(contour.map(() => "WALL" as const)),
    boundaryWallIds: Object.freeze([...wallIds]),
    triangles: triangulateFloorContour3D(contour)
  });
}

function furniture(
  id: string,
  roomId: string,
  x: number,
  z: number,
  y: number
) {
  return {
    id,
    roomId,
    bounds: {
      min: { x: x - 0.3, y, z: z - 0.3 },
      max: { x: x + 0.3, y: y + 0.8, z: z + 0.3 }
    }
  };
}
