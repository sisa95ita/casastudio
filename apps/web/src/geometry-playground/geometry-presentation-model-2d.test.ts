import { GeometryEngine } from "@casastudio/geometry";
import { ProjectSchema } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { createGeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import {
  createGeometrySelectionState,
  selectBoundaryEdge,
  selectPolygon,
  selectVertex
} from "./geometry-selection-state";
import { collectLevelBounds } from "./geometry-svg-helpers";
import { createFitToViewTransform } from "./viewport-transform-2d";

const getPresentationModel = () => {
  const project = ProjectSchema.parse(geometryPlaygroundProject);
  const result = GeometryEngine.build(project);

  if (!result.ok) {
    throw new Error("Expected playground fixture to build successfully.");
  }

  const level = result.model.levels[0];

  if (!level) {
    throw new Error("Expected playground fixture to produce one level.");
  }

  const bounds = collectLevelBounds(level);

  if (!bounds) {
    throw new Error("Expected playground fixture to produce bounds.");
  }

  return createGeometryPresentationModel2D({
    level,
    transform: createFitToViewTransform({
      bounds,
      viewportWidth: 800,
      viewportHeight: 520,
      padding: 40
    })
  });
};

describe("createGeometryPresentationModel2D", () => {
  it("returns deterministic render-oriented geometry", () => {
    expect(getPresentationModel()).toEqual(getPresentationModel());
  });

  it("carries selection and hover metadata without mutating runtime geometry", () => {
    const baseModel = getPresentationModel();
    const selectedPolygon = baseModel.polygons[0];
    const hoveredVertex = baseModel.vertices[0];

    if (!selectedPolygon || !hoveredVertex) {
      throw new Error("Expected playground presentation entities.");
    }

    const project = ProjectSchema.parse(geometryPlaygroundProject);
    const result = GeometryEngine.build(project);

    if (!result.ok) {
      throw new Error("Expected playground fixture to build successfully.");
    }

    const level = result.model.levels[0];
    const bounds = level ? collectLevelBounds(level) : undefined;

    if (!level || !bounds) {
      throw new Error("Expected playground runtime level and bounds.");
    }

    const model = createGeometryPresentationModel2D({
      level,
      transform: createFitToViewTransform({
        bounds,
        viewportWidth: 800,
        viewportHeight: 520,
        padding: 40
      }),
      selectionState: createGeometrySelectionState(
        [selectPolygon(selectedPolygon.geometryId)],
        selectVertex(hoveredVertex.geometryId)
      )
    });

    expect(
      model.polygons.find((polygon) => polygon.geometryId === selectedPolygon.geometryId)?.selected
    ).toBe(true);
    expect(
      model.vertices.find((vertex) => vertex.geometryId === hoveredVertex.geometryId)?.hovered
    ).toBe(true);
    expect(level.polygons[0]).not.toHaveProperty("selected");
  });

  it("includes shared edge usage counts from runtime edge uses", () => {
    const model = getPresentationModel();
    const sharedEdges = model.boundaryEdges.filter((edge) => edge.sharedUsageCount === 2);
    const exteriorEdges = model.boundaryEdges.filter((edge) => edge.sharedUsageCount === 1);

    expect(sharedEdges).toHaveLength(1);
    expect(sharedEdges[0]?.sourceWallId).toBe("left-room-east-shared-wall");
    expect(exteriorEdges).toHaveLength(6);
  });

  it("marks selected boundary edges by runtime id", () => {
    const baseModel = getPresentationModel();
    const sharedEdge = baseModel.boundaryEdges.find(
      (edge) => edge.sourceWallId === "left-room-east-shared-wall"
    );

    if (!sharedEdge) {
      throw new Error("Expected shared edge.");
    }

    const project = ProjectSchema.parse(geometryPlaygroundProject);
    const result = GeometryEngine.build(project);

    if (!result.ok) {
      throw new Error("Expected playground fixture to build successfully.");
    }

    const level = result.model.levels[0];
    const bounds = level ? collectLevelBounds(level) : undefined;

    if (!level || !bounds) {
      throw new Error("Expected playground runtime level and bounds.");
    }

    const selectedModel = createGeometryPresentationModel2D({
      level,
      transform: createFitToViewTransform({
        bounds,
        viewportWidth: 800,
        viewportHeight: 520,
        padding: 40
      }),
      selectionState: createGeometrySelectionState([selectBoundaryEdge(sharedEdge.geometryId)])
    });

    expect(
      selectedModel.boundaryEdges.find((edge) => edge.geometryId === sharedEdge.geometryId)
        ?.selected
    ).toBe(true);
  });
});
