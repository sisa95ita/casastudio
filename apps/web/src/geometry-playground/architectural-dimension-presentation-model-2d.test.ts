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
