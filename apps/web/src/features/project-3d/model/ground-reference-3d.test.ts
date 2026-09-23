import { describe, expect, it } from "vitest";

import type { LevelReference3D } from "./architectural-scene-3d-model";
import {
  architecturalGroundContactEpsilon3D,
  createGroundReference3D
} from "./ground-reference-3d";

describe("architectural ground reference", () => {
  it.each([
    ["ordinary Ground Floor", [floorLevel("ground", 0, [0])], 0],
    ["positive Ground Floor", [floorLevel("ground", 1, [1])], 1],
    ["negative lowest Level", [floorLevel("lower", -0.5, [-0.5])], -0.5],
    [
      "elevated Room above ordinary floor",
      [floorLevel("ground", 0, [0, 2.7])],
      0
    ],
    [
      "multiple visible Levels",
      [floorLevel("upper", 3.2, [3.2]), floorLevel("lower", -0.5, [-0.5])],
      -0.5
    ]
  ])("uses the lowest visible walking datum for %s", (_name, levels, expected) => {
    const ground = createGroundReference3D(levels as readonly LevelReference3D[]);
    expect(ground.datumY).toBe(expected);
    expect(ground.y).toBeCloseTo(expected - architecturalGroundContactEpsilon3D);
    expect(ground.gridY).toBeCloseTo(expected + architecturalGroundContactEpsilon3D);
  });

  it("falls back to the lowest Level elevation for a Wall-only scene", () => {
    const ground = createGroundReference3D([
      floorLevel("upper", 3, []),
      floorLevel("lower", -0.5, [])
    ]);
    expect(ground.datumY).toBe(-0.5);
    expect(Number.isFinite(ground.y)).toBe(true);
  });

  it("uses a finite zero datum for an empty visible scene", () => {
    expect(createGroundReference3D([])).toMatchObject({
      datumY: 0,
      y: -architecturalGroundContactEpsilon3D,
      size: 10,
      divisions: 10
    });
  });

  it("does not use the slab underside from scene bounds as its datum", () => {
    const ground = createGroundReference3D(
      [floorLevel("ground", 0, [0])],
      {
        min: { x: -1, y: -0.18, z: -1 },
        max: { x: 1, y: 3, z: 1 },
        center: { x: 0, y: 1.41, z: 0 },
        size: { x: 2, y: 3.18, z: 2 }
      }
    );
    expect(ground.datumY).toBe(0);
    expect(ground.y).toBe(-architecturalGroundContactEpsilon3D);
  });
});

function floorLevel(
  id: string,
  y: number,
  floorElevations: readonly number[]
): LevelReference3D {
  return {
    id,
    name: id,
    elevation: y * 100,
    y,
    segments: [],
    walls: [],
    floors: floorElevations.map((floorY, index) => ({
      id: `floor-${index}`,
      roomId: `room-${index}`,
      area: 1,
      y: floorY,
      bottomY: floorY - 0.18,
      thickness: 0.18,
      contour: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 }
      ],
      triangles: [[0, 1, 2]]
    })),
    staircases: [],
    furniture: []
  };
}
