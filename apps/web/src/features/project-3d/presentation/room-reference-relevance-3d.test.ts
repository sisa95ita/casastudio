import type { DesignTarget } from "@casastudio/ai";
import type { Wall } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { createRoomReferencePlans3D } from "../camera/room-reference-camera-3d";
import {
  createWall3D,
  triangulateFloorContour3D,
  type ArchitecturalScene3DModel,
  type Floor3D,
  type Level3D,
  type ScenePlanVector3D,
  type Wall3D
} from "../model/architectural-scene-3d-model";
import { deriveRoomReferenceWallIds3D } from "./room-reference-relevance-3d";

const target: DesignTarget = Object.freeze({
  kind: "room",
  projectId: "project",
  levelId: "target-level",
  roomId: "room"
});

describe("Room-reference architectural relevance", () => {
  it("includes boundary, interior, crossing, thickness-overlap, and Opening-host Walls", () => {
    const floor = rectangularFloor();
    const walls = [
      wall("boundary", { x: 0, z: 0 }, { x: 4, z: 0 }),
      wall("interior", { x: 1, z: 2 }, { x: 3, z: 2 }),
      wall("crossing", { x: -1, z: 1 }, { x: 5, z: 1 }),
      wall("thickness-overlap", { x: 1, z: -0.05 }, { x: 3, z: -0.05 }, 0.2),
      wall(
        "opening-host",
        { x: 1, z: 3 },
        { x: 3, z: 3 },
        0.2,
        [{
          id: "window",
          type: "WINDOW",
          offsetFromStart: 0.5,
          width: 1,
          elevation: 1,
          height: 1
        }]
      ),
      wall("unrelated", { x: 1, z: -2 }, { x: 3, z: -2 }),
      wall("boundary-contact-only", { x: 1, z: -0.1 }, { x: 3, z: -0.1 }, 0.2)
    ];

    expect(deriveRoomReferenceWallIds3D(floor, walls)).toEqual([
      "boundary",
      "interior",
      "crossing",
      "thickness-overlap",
      "opening-host"
    ]);
    expect(walls.find((candidate) => candidate.id === "opening-host")?.openings)
      .toEqual([expect.objectContaining({ id: "window", kind: "WINDOW" })]);
  });

  it("does not mutate the derived scene model or its canonical-source geometry", () => {
    const floor = rectangularFloor();
    const walls = [
      wall("boundary", { x: 0, z: 0 }, { x: 4, z: 0 }),
      wall("interior", { x: 1, z: 2 }, { x: 3, z: 2 })
    ];
    const beforeFloor = structuredClone(floor);
    const beforeWalls = structuredClone(walls);

    deriveRoomReferenceWallIds3D(floor, walls);

    expect(floor).toEqual(beforeFloor);
    expect(walls).toEqual(beforeWalls);
  });

  it("uses only the selected Level and supplies the same Walls to all reference kinds", () => {
    const floor = rectangularFloor();
    const selectedLevel = level("target-level", floor, [
      wall("boundary", { x: 0, z: 0 }, { x: 4, z: 0 }),
      wall("same-level-interior", { x: 1, z: 2 }, { x: 3, z: 2 })
    ]);
    const otherLevel = level("other-level", undefined, [
      wall("other-level-overlap", { x: 1, z: 2 }, { x: 3, z: 2 })
    ]);
    const model: ArchitecturalScene3DModel = Object.freeze({
      sourceProjectId: "project",
    sourceProjectRevision: 1,
      worldLengthUnit: "m",
      levels: Object.freeze([selectedLevel, otherLevel]),
      hasArchitecturalGeometry: true
    });

    const plans = createRoomReferencePlans3D(model, target);

    expect(plans.map((plan) => plan.kind)).toEqual([
      "room-axonometric",
      "room-interior-a",
      "room-interior-b"
    ]);
    expect(plans.every((plan) =>
      JSON.stringify(plan.wallIds) === JSON.stringify(["boundary", "same-level-interior"])
    )).toBe(true);
    expect(plans.every((plan) => !plan.wallIds.includes("other-level-overlap"))).toBe(true);
  });
});

function rectangularFloor(): Floor3D {
  const contour = Object.freeze([
    { x: 0, z: 0 },
    { x: 0, z: -4 },
    { x: 4, z: -4 },
    { x: 4, z: 0 }
  ] satisfies readonly ScenePlanVector3D[]);
  return Object.freeze({
    id: "floor:room",
    roomId: "room",
    area: 16,
    y: 0,
    bottomY: -0.18,
    thickness: 0.18,
    contour,
    boundaryKinds: Object.freeze(["WALL", "FREE", "FREE", "FREE"] as const),
    boundaryWallIds: Object.freeze(["boundary", undefined, undefined, undefined]),
    triangles: triangulateFloorContour3D(contour)
  });
}

function wall(
  id: string,
  start: ScenePlanVector3D,
  end: ScenePlanVector3D,
  thickness = 0.2,
  openings: Wall["openings"] = []
): Wall3D {
  return createWall3D({
    id,
    start,
    end,
    height: 3,
    thickness,
    roomIds: [],
    openings
  }, 0, "m");
}

function level(
  id: string,
  floor: Floor3D | undefined,
  walls: readonly Wall3D[]
): Level3D {
  return Object.freeze({
    id,
    name: id,
    elevation: 0,
    y: 0,
    segments: Object.freeze([]),
    walls: Object.freeze([...walls]),
    floors: Object.freeze(floor ? [floor] : []),
    staircases: Object.freeze([]),
    furniture: Object.freeze([])
  });
}
