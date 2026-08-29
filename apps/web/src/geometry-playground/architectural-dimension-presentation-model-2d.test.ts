import { describe, expect, it } from "vitest";
import type { Level } from "@casastudio/schema";

import { createArchitecturalDimensionPresentationModel2D } from "./architectural-dimension-presentation-model-2d";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import { ViewportTransform2D } from "./viewport-transform-2d";

describe("architectural dimension presentation", () => {
  it("keeps measured values stable while viewport zoom changes screen geometry", () => {
    const at100 = createModel(1, 50);
    const at200 = createModel(2, 50);
    expect(at100.selected[0]?.physicalValue).toBe(500);
    expect(at200.selected[0]?.physicalValue).toBe(500);
    expect(at100.selected[0]?.formattedValue).toBe("5.00 m");
    expect(at200.selected[0]?.dimensionLine.end.x).not.toBe(at100.selected[0]?.dimensionLine.end.x);
  });

  it("keeps values stable while document scale changes presentation spacing", () => {
    const at50 = createModel(1, 50);
    const at100 = createModel(1, 100);
    expect(at100.selected[0]?.physicalValue).toBe(at50.selected[0]?.physicalValue);
    expect(at100.selected[0]?.formattedValue).toBe(at50.selected[0]?.formattedValue);
    expect(at100.selected[0]?.dimensionLine.start.y).not.toBe(at50.selected[0]?.dimensionLine.start.y);
  });

  it("derives architectural Room labels and an interior anchor from a concave polygon", () => {
    const points = [
      { x: 0, z: 0 }, { x: 120, z: 0 }, { x: 120, z: 30 },
      { x: 30, z: 30 }, { x: 30, z: 120 }, { x: 0, z: 120 }
    ];
    const walls = points.map((start, index) => ({
      id: `wall-${index}`,
      start,
      end: points[(index + 1) % points.length]!,
      height: 280,
      thickness: 20,
      roomIds: ["room"],
      openings: []
    }));
    const level: Level = {
      id: "level",
      name: "Level",
      elevation: 0,
      staircases: [],
      walls,
      rooms: [{
        id: "room",
        name: "Kitchen",
        type: "KITCHEN",
        boundary: walls.map((wall) => ({ wallId: wall.id, direction: "FORWARD" }))
      }]
    };
    const transform = new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 150 });
    const model = createArchitecturalDimensionPresentationModel2D({
      level,
      units: { length: "cm" },
      transform,
      geometryModel: {
        levelId: "level",
        sourceLevelId: "level",
        bounds: { minX: 0, minZ: 0, maxX: 120, maxZ: 120 },
        polygons: [{
          kind: "POLYGON",
          geometryId: "polygon",
          sourceRoomId: "room",
          points: points.map((world) => ({ world, screen: transform.worldToScreen(world) })),
          svgPoints: "",
          area: 6_300,
          winding: "COUNTER_CLOCKWISE",
          centroid: { world: { x: 39.29, z: 39.29 }, screen: transform.worldToScreen({ x: 39.29, z: 39.29 }) },
          bounds: { minX: 0, minZ: 0, maxX: 120, maxZ: 120 },
          screenBounds: { x: 0, y: 30, width: 120, height: 120 },
          selected: false,
          hovered: false
        }],
        boundaryEdges: [],
        vertices: []
      },
      scaleDenominator: 50,
      display: { overallDimensions: false, selectedDimensions: false, roomMetrics: true }
    });

    expect(model.roomMetrics[0]).toMatchObject({
      roomName: "Kitchen",
      roomType: "KITCHEN",
      formattedArea: "0.63 m²"
    });
    const anchor = transform.screenToWorld(model.roomMetrics[0]!.anchor);
    expect(anchor.x < 30 || anchor.z < 30).toBe(true);
  });
});

function createModel(zoom: number, scaleDenominator: 50 | 100) {
  const level: Level = {
    id: "level",
    name: "Level",
    elevation: 0,
    rooms: [],
    staircases: [],
    walls: [{
      id: "wall",
      start: { x: 0, z: 0 },
      end: { x: 500, z: 0 },
      height: 280,
      thickness: 20,
      roomIds: [],
      openings: []
    }]
  };
  return createArchitecturalDimensionPresentationModel2D({
    level,
    units: { length: "cm" },
    transform: new ViewportTransform2D({ scale: zoom, offsetX: 10, offsetY: 500 }),
    geometryModel: {
      levelId: "level",
      sourceLevelId: "level",
      bounds: { minX: 0, minZ: 0, maxX: 500, maxZ: 0 },
      polygons: [],
      boundaryEdges: [],
      vertices: []
    } satisfies GeometryPresentationModel2D,
    scaleDenominator,
    display: { overallDimensions: true, selectedDimensions: true, roomMetrics: true },
    selectedWall: level.walls[0]
  });
}
