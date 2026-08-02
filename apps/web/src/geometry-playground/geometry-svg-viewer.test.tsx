import { GeometryEngine } from "@casastudio/geometry";
import { ProjectSchema } from "@casastudio/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import {
  collectLevelBounds,
  countBoundaryEdgeUses,
  getPolygonPointString
} from "./geometry-svg-helpers";
import {
  defaultGeometryDisplayOptions,
  GeometrySvgViewer
} from "./GeometrySvgViewer";
import { createFitToViewTransform } from "./viewport-transform-2d";

const getPlaygroundLevel = () => {
  const project = ProjectSchema.parse(geometryPlaygroundProject);
  const result = GeometryEngine.build(project);

  if (!result.ok) {
    throw new Error("Expected playground fixture to build successfully.");
  }

  const level = result.model.levels[0];

  if (!level) {
    throw new Error("Expected playground fixture to produce one level.");
  }

  return level;
};

describe("GeometrySvgViewer", () => {
  it("renders two polygons from traversal-relative loop order", () => {
    const level = getPlaygroundLevel();
    const bounds = collectLevelBounds(level);
    const firstPolygon = level.polygons[0];

    if (!bounds || !firstPolygon) {
      throw new Error("Expected playground level to contain polygon bounds.");
    }

    const transform = createFitToViewTransform({
      bounds,
      viewportWidth: 800,
      viewportHeight: 520,
      padding: 40
    });
    const expectedFirstPolygonPoints = getPolygonPointString(firstPolygon, transform);

    const markup = renderToStaticMarkup(
      <GeometrySvgViewer level={level} options={defaultGeometryDisplayOptions} />
    );

    expect(markup.match(/data-testid="geometry-polygon"/g)).toHaveLength(2);
    expect(markup).toContain(`points="${expectedFirstPolygonPoints}"`);
  });

  it("renders each unique physical boundary edge once and marks the shared edge", () => {
    const level = getPlaygroundLevel();
    const useCounts = countBoundaryEdgeUses(level);

    const markup = renderToStaticMarkup(
      <GeometrySvgViewer level={level} options={defaultGeometryDisplayOptions} />
    );

    expect(level.boundaryEdges).toHaveLength(7);
    expect([...useCounts.values()].filter((useCount) => useCount === 2)).toHaveLength(1);
    expect(markup.match(/data-testid="boundary-edge"/g)).toHaveLength(7);
    expect(markup.match(/data-shared="true"/g)).toHaveLength(1);
  });

  it("uses layer options to hide and show diagnostic vertices and bounds", () => {
    const level = getPlaygroundLevel();

    const visibleMarkup = renderToStaticMarkup(
      <GeometrySvgViewer
        level={level}
        options={{ ...defaultGeometryDisplayOptions, bounds: true }}
      />
    );
    const hiddenMarkup = renderToStaticMarkup(
      <GeometrySvgViewer
        level={level}
        options={{ ...defaultGeometryDisplayOptions, vertices: false, bounds: false }}
      />
    );

    expect(visibleMarkup.match(/data-testid="geometry-vertex"/g)).toHaveLength(6);
    expect(visibleMarkup.match(/data-testid="polygon-bounds"/g)).toHaveLength(2);
    expect(hiddenMarkup).not.toContain("data-testid=\"geometry-vertex\"");
    expect(hiddenMarkup).not.toContain("data-testid=\"polygon-bounds\"");
  });

  it("renders a stable empty state for levels with no runtime geometry", () => {
    const project = ProjectSchema.parse({
      ...geometryPlaygroundProject,
      id: "empty-playground-project",
      building: {
        ...geometryPlaygroundProject.building,
        levels: [
          {
            id: "empty-level",
            name: "Empty Level",
            elevation: 0,
            rooms: [],
            walls: [],
            staircases: []
          }
        ]
      }
    });
    const result = GeometryEngine.build(project);

    if (!result.ok) {
      throw new Error("Expected empty draft level to build successfully.");
    }

    const level = result.model.levels[0];

    if (!level) {
      throw new Error("Expected empty draft project to produce one level.");
    }

    const markup = renderToStaticMarkup(
      <GeometrySvgViewer level={level} options={defaultGeometryDisplayOptions} />
    );

    expect(markup).toContain("No runtime geometry to display for this level.");
  });
});
