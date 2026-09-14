import { describe, expect, it } from "vitest";
import type { FurnitureItem, Project } from "@casastudio/schema";

import { resolveFurniturePrecisionTranslation } from "./project-precision-assistance";
import {
  convexPolygonsOverlap,
  createFurnitureFootprint2D,
  createWallFootprints2D
} from "../../geometry-2d/presentation/plan-footprints-2d";

const boundary = (size = 1000) => [
  { kind: "FREE" as const, start: { x: 0, z: 0 }, end: { x: size, z: 0 } },
  {
    kind: "FREE" as const,
    start: { x: size, z: 0 },
    end: { x: size, z: size }
  },
  {
    kind: "FREE" as const,
    start: { x: size, z: size },
    end: { x: 0, z: size }
  },
  { kind: "FREE" as const, start: { x: 0, z: size }, end: { x: 0, z: 0 } }
];

const item = (
  id: string,
  roomId: string,
  x: number,
  z: number
): FurnitureItem => ({
  id,
  roomId,
  definitionId: "generic-chair",
  position: { x, z },
  rotation: 0,
  width: 40,
  depth: 40,
  height: 80
});

function fixture(): Project {
  return {
    id: "precision",
    name: "Precision",
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
        item("moving", "lower", 200, 34),
        item("same-floor", "lower", 400, 200),
        item("upper", "upper-room", 204, 200)
      ],
      levels: [
        {
          id: "ground",
          name: "Ground",
          elevation: 0,
          walls: [
            {
              id: "wall",
              start: { x: 0, z: 0 },
              end: { x: 1000, z: 0 },
              height: 280,
              thickness: 20,
              roomIds: [],
              openings: []
            }
          ],
          rooms: [
            { id: "lower", name: "Lower", type: "OTHER", boundary: boundary() },
            {
              id: "upper-room",
              name: "Upper",
              type: "OTHER",
              elevation: 200,
              boundary: boundary()
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
  };
}

describe("Furniture precision assistance", () => {
  it("snaps an actual footprint edge to the physical Wall face", () => {
    const project = fixture();
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [project.building.furniture[0]!],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });

    expect(result.active[0]?.relation).toBe("wall-face");
    expect(result.delta).toEqual({ x: 0, z: -4 });
    expect(project.building.furniture[0]?.position).toEqual({ x: 200, z: 34 });
  });

  it("snaps an oriented footprint to an angled physical Wall face", () => {
    const project = fixture();
    const wall = project.building.levels[0]!.walls[0]!;
    wall.start = { x: 100, z: 100 };
    wall.end = { x: 900, z: 900 };
    const normal = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
    const moving = project.building.furniture[0]!;
    moving.rotation = -45;
    moving.position = {
      x: 500 + normal.x * 34,
      z: 500 + normal.z * 34
    };
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [moving],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(result.active[0]?.relation).toBe("wall-face");
    expect(Math.hypot(result.delta.x, result.delta.z)).toBeCloseTo(4);
    const snapped = {
      ...moving,
      position: {
        x: moving.position.x + result.delta.x,
        z: moving.position.z + result.delta.z
      }
    };
    expect(
      createWallFootprints2D(project.building.levels[0]!).some((footprint) =>
        convexPolygonsOverlap(createFurnitureFootprint2D(snapped), footprint)
      )
    ).toBe(false);
  });

  it("does not produce ordinary object alignment across floor elevations", () => {
    const project = fixture();
    project.building.levels[0]!.walls = [];
    project.building.furniture = [
      item("moving", "lower", 204, 200),
      item("upper", "upper-room", 200, 200)
    ];
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [project.building.furniture[0]!],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(result.active).toEqual([]);
    expect(result.guides).toEqual([]);
  });

  it("generates vertical edge and center guides from same-plane Furniture extents", () => {
    const project = fixture();
    project.building.levels[0]!.walls = [];
    const moving = project.building.furniture[0]!;
    const target = project.building.furniture[1]!;
    moving.position = { x: 396, z: 100 };
    target.position = { x: 400, z: 300 };
    target.width = 80;

    const centered = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [moving],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(centered.active[0]?.relation).toBe("object-center");
    expect(centered.delta.x).toBe(4);
    expect(centered.guides).toHaveLength(1);
    expect(centered.guides[0]?.start.x).toBe(centered.guides[0]?.end.x);

    target.width = 40;
    const edgeAligned = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [moving],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(edgeAligned.active[0]?.relation).toBe("object-edge");
    expect(edgeAligned.delta.x).toBe(4);
    expect(edgeAligned.guides[0]?.start.x).toBe(edgeAligned.guides[0]?.end.x);
  });

  it("generates a horizontal center guide for same-plane Furniture", () => {
    const project = fixture();
    project.building.levels[0]!.walls = [];
    const moving = project.building.furniture[0]!;
    const target = project.building.furniture[1]!;
    moving.position = { x: 100, z: 196 };
    target.position = { x: 400, z: 200 };
    target.depth = 80;
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [moving],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(result.active[0]?.relation).toBe("object-center");
    expect(result.delta.z).toBe(4);
    expect(result.guides[0]?.start.z).toBe(result.guides[0]?.end.z);
  });

  it("discards an invalid object snap instead of showing an uncommittable guide", () => {
    const project = fixture();
    project.building.levels[0]!.walls = [];
    const moving = project.building.furniture[0]!;
    const target = project.building.furniture[1]!;
    moving.position = { x: 396, z: 100 };
    target.position = { x: 400, z: 300 };
    target.width = 80;
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [moving],
      rawDelta: { x: 0, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 },
      isValid: (delta) => delta.x !== 4
    });
    expect(result.delta).toEqual({ x: 0, z: 0 });
    expect(result.active).toEqual([]);
    expect(result.guides).toEqual([]);
  });

  it("snaps a Furniture multi-selection with one rigid aggregate delta", () => {
    const project = fixture();
    project.building.levels[0]!.walls = [];
    const first = project.building.furniture[0]!;
    const second = project.building.furniture[1]!;
    first.position = { x: 100, z: 300 };
    second.position = { x: 200, z: 300 };
    project.building.furniture[2] = item("target", "lower", 252, 500);
    const beforeOffset = second.position.x - first.position.x;
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [first, second],
      rawDelta: { x: 3, z: 0 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: false, spacing: 100 }
    });
    expect(result.active[0]?.relation).toBe("object-edge");
    expect(result.delta.x).toBe(12);
    expect(
      second.position.x + result.delta.x - (first.position.x + result.delta.x)
    ).toBe(beforeOffset);
  });

  it("bypasses smart and grid snapping without changing the raw delta", () => {
    const project = fixture();
    const result = resolveFurniturePrecisionTranslation({
      project,
      levelId: "ground",
      moving: [project.building.furniture[0]!],
      rawDelta: { x: 3, z: 4 },
      pixelsPerWorldUnit: 1,
      grid: { enabled: true, spacing: 100 },
      bypass: true
    });
    expect(result).toMatchObject({ delta: { x: 3, z: 4 }, active: [] });
  });
});
