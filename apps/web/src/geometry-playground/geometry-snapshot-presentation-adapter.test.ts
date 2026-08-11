import { describe, expect, it } from "vitest";

import { createGeometrySnapshotFixture } from "../test/geometry-snapshot-fixture";
import {
  collectGeometrySnapshotLevelBounds,
  createGeometrySnapshotPresentationModel2D
} from "./geometry-snapshot-presentation-adapter";
import { createGeometrySelectionState, selectPolygon, selectVertex } from "./geometry-selection-state";
import { createFitToViewTransform } from "./viewport-transform-2d";

const createModel = () => {
  const level = createGeometrySnapshotFixture("project-one", 4).geometry.levels[0];

  if (!level) {
    throw new Error("Expected a geometry fixture level.");
  }

  const bounds = collectGeometrySnapshotLevelBounds(level);

  if (!bounds) {
    throw new Error("Expected snapshot bounds.");
  }

  return {
    level,
    model: createGeometrySnapshotPresentationModel2D({
      level,
      transform: createFitToViewTransform({
        bounds,
        viewportWidth: 800,
        viewportHeight: 520,
        padding: 40
      }),
      selectionState: createGeometrySelectionState(
        [selectPolygon("polygon:room-one")],
        selectVertex("vertex:0:0")
      )
    })
  };
};

describe("createGeometrySnapshotPresentationModel2D", () => {
  it("adapts explicit snapshot traversal and metrics into viewer presentation data", () => {
    const { level, model } = createModel();
    const polygon = model.polygons[0];

    expect(model.levelId).toBe(level.id);
    expect(model.bounds).toEqual({ minX: 0, minZ: 0, maxX: 100, maxZ: 100 });
    expect(polygon?.points.map((point) => point.world)).toEqual([
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
      { x: 0, z: 100 }
    ]);
    expect(polygon).toMatchObject({
      geometryId: "polygon:room-one",
      sourceRoomId: "room-one",
      area: 10000,
      winding: "COUNTER_CLOCKWISE",
      selected: true
    });
    expect(model.vertices.find((vertex) => vertex.geometryId === "vertex:0:0")?.hovered).toBe(true);
    expect(model.boundaryEdges).toHaveLength(4);
  });

  it("rejects broken explicit topology references instead of inferring replacements", () => {
    const response = createGeometrySnapshotFixture("project-one", 4);
    const level = response.geometry.levels[0];

    if (!level) {
      throw new Error("Expected a geometry fixture level.");
    }

    const invalidLevel = {
      ...level,
      polygons: [{ ...level.polygons[0]!, outerLoopId: "missing-loop" }]
    };

    expect(() =>
      createGeometrySnapshotPresentationModel2D({
        level: invalidLevel,
        transform: createFitToViewTransform({
          bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
          viewportWidth: 800,
          viewportHeight: 520,
          padding: 40
        })
      })
    ).toThrow("invalid outer-loop reference");
  });
});
