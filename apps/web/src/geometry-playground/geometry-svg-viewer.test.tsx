import { GeometryEngine, type LevelGeometry } from "@casastudio/geometry";
import { ProjectSchema } from "@casastudio/schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import {
  collectLevelBounds,
  countBoundaryEdgeUses
} from "./geometry-svg-helpers";
import { createRuntimeGeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import {
  defaultGeometryDisplayOptions,
  GeometrySvgViewer
} from "./GeometrySvgViewer";
import {
  createGeometrySelectionState,
  selectPolygon
} from "./geometry-selection-state";
import {
  createFitViewportState,
  createViewportTransform2D,
  defaultViewportState,
  type ViewportState
} from "./viewport-transform-2d";

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

const createViewerProps = (
  level: LevelGeometry,
  selectionState = createGeometrySelectionState(),
  requestedViewport?: ViewportState
) => {
  const bounds = collectLevelBounds(level);
  const viewport =
    requestedViewport ??
    (bounds
      ? createFitViewportState({
          bounds,
          viewportWidth: 800,
          viewportHeight: 520,
          padding: 40
        })
      : defaultViewportState);

  return {
    presentationModel: createRuntimeGeometryPresentationModel2D({
      level,
      transform: createViewportTransform2D(viewport),
      selectionState
    }),
    selectionState,
    viewport
  };
};

afterEach(() => {
  cleanup();
});

describe("GeometrySvgViewer", () => {
  it("renders two polygons from traversal-relative loop order", () => {
    const level = getPlaygroundLevel();
    const bounds = collectLevelBounds(level);
    const firstPolygon = level.polygons[0];

    if (!bounds || !firstPolygon) {
      throw new Error("Expected playground level to contain polygon bounds.");
    }

    const viewerProps = createViewerProps(level);
    const expectedFirstPolygonPoints =
      viewerProps.presentationModel.polygons[0]?.svgPoints;

    const markup = renderToStaticMarkup(
      <GeometrySvgViewer
        {...viewerProps}
        options={defaultGeometryDisplayOptions}
      />
    );

    expect(markup.match(/data-testid="geometry-polygon"/g)).toHaveLength(2);
    expect(markup).toContain(`points="${expectedFirstPolygonPoints}"`);
  });

  it("renders each unique physical boundary edge once and marks the shared edge", () => {
    const level = getPlaygroundLevel();
    const useCounts = countBoundaryEdgeUses(level);

    const markup = renderToStaticMarkup(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
      />
    );

    expect(level.boundaryEdges).toHaveLength(7);
    expect(
      [...useCounts.values()].filter((useCount) => useCount === 2)
    ).toHaveLength(1);
    expect(markup.match(/data-testid="boundary-edge"/g)).toHaveLength(7);
    expect(markup.match(/data-shared="true"/g)).toHaveLength(1);
  });

  it("uses layer options to hide and show diagnostic vertices and bounds", () => {
    const level = getPlaygroundLevel();

    const visibleMarkup = renderToStaticMarkup(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={{ ...defaultGeometryDisplayOptions, bounds: true }}
      />
    );
    const hiddenMarkup = renderToStaticMarkup(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={{
          ...defaultGeometryDisplayOptions,
          vertices: false,
          bounds: false
        }}
      />
    );

    expect(visibleMarkup.match(/data-testid="geometry-vertex"/g)).toHaveLength(
      6
    );
    expect(visibleMarkup.match(/data-testid="polygon-bounds"/g)).toHaveLength(
      2
    );
    expect(hiddenMarkup).not.toContain('data-testid="geometry-vertex"');
    expect(hiddenMarkup).not.toContain('data-testid="polygon-bounds"');
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
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
      />
    );

    expect(markup).toContain("No runtime geometry to display for this level.");
  });

  it("selects polygons, boundary edges, and vertices from SVG clicks", () => {
    const level = getPlaygroundLevel();
    const handleSelectionStateChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );

    const polygon = screen.getAllByTestId("geometry-polygon")[0];
    const edgeHitTarget = container.querySelector(".geometry-edge-hit-target");
    const vertex = screen.getAllByTestId("geometry-vertex")[0];

    if (!polygon || !edgeHitTarget || !vertex) {
      throw new Error("Expected interactive geometry elements.");
    }

    fireEvent.click(polygon);
    fireEvent.click(edgeHitTarget);
    fireEvent.click(vertex);

    expect(handleSelectionStateChange).toHaveBeenNthCalledWith(1, {
      selected: [
        {
          kind: "POLYGON",
          geometryId: level.polygons[0]?.id
        }
      ],
      hovered: undefined
    });
    expect(handleSelectionStateChange).toHaveBeenNthCalledWith(2, {
      selected: [
        {
          kind: "BOUNDARY_EDGE",
          geometryId: level.boundaryEdges[0]?.id
        }
      ],
      hovered: undefined
    });
    expect(handleSelectionStateChange).toHaveBeenNthCalledWith(3, {
      selected: [
        {
          kind: "VERTEX",
          geometryId: level.vertices[0]?.id
        }
      ],
      hovered: undefined
    });
  });

  it("emits hover state separately from the selected set", () => {
    const level = getPlaygroundLevel();
    const selectedPolygon = level.polygons[0];
    const hoveredVertex = level.vertices[0];
    const handleSelectionStateChange = vi.fn();

    if (!selectedPolygon || !hoveredVertex) {
      throw new Error("Expected interactive geometry elements.");
    }

    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(
          level,
          createGeometrySelectionState([selectPolygon(selectedPolygon.id)])
        )}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );

    const vertex = container.querySelector('[data-testid="geometry-vertex"]');

    if (!vertex) {
      throw new Error("Expected a vertex hit target.");
    }

    fireEvent.mouseEnter(vertex);

    expect(handleSelectionStateChange).toHaveBeenCalledWith({
      selected: [selectPolygon(selectedPolygon.id)],
      hovered: {
        kind: "VERTEX",
        geometryId: hoveredVertex.id
      }
    });
  });

  it("supports shift-click additive selection and toggling", () => {
    const level = getPlaygroundLevel();
    const selectedPolygon = level.polygons[0];
    const handleAdditiveSelection = vi.fn();
    const handleToggleSelection = vi.fn();

    if (!selectedPolygon) {
      throw new Error("Expected a polygon.");
    }

    const initialSelectionState = createGeometrySelectionState([
      selectPolygon(selectedPolygon.id)
    ]);

    const { container, unmount } = render(
      <GeometrySvgViewer
        {...createViewerProps(level, initialSelectionState)}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleAdditiveSelection}
      />
    );

    const edgeHitTarget = container.querySelector(".geometry-edge-hit-target");

    if (!edgeHitTarget) {
      throw new Error("Expected a boundary edge hit target.");
    }

    fireEvent.click(edgeHitTarget, { shiftKey: true });

    expect(handleAdditiveSelection).toHaveBeenCalledWith({
      selected: [
        selectPolygon(selectedPolygon.id),
        {
          kind: "BOUNDARY_EDGE",
          geometryId: level.boundaryEdges[0]?.id
        }
      ],
      hovered: undefined
    });

    unmount();

    const toggleRender = render(
      <GeometrySvgViewer
        {...createViewerProps(level, initialSelectionState)}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleToggleSelection}
      />
    );

    const polygon = toggleRender.container.querySelector(
      '[data-testid="geometry-polygon"]'
    );

    if (!polygon) {
      throw new Error("Expected a polygon hit target.");
    }

    fireEvent.click(polygon, { shiftKey: true });

    expect(handleToggleSelection).toHaveBeenCalledWith({
      selected: [],
      hovered: undefined
    });
  });

  it("deselects an already-selected entity on a plain click", () => {
    const level = getPlaygroundLevel();
    const selectedPolygon = level.polygons[0];
    const handleSelectionStateChange = vi.fn();

    if (!selectedPolygon) {
      throw new Error("Expected a polygon.");
    }

    render(
      <GeometrySvgViewer
        {...createViewerProps(
          level,
          createGeometrySelectionState([selectPolygon(selectedPolygon.id)])
        )}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );

    fireEvent.click(screen.getAllByTestId("geometry-polygon")[0]!);

    expect(handleSelectionStateChange).toHaveBeenCalledWith({
      selected: [],
      hovered: undefined
    });
  });

  it("emits zoom viewport updates from wheel input", () => {
    const level = getPlaygroundLevel();
    const viewport = { zoom: 1, offsetX: 0, offsetY: 0 };
    const handleViewportChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level, createGeometrySelectionState(), viewport)}
        options={defaultGeometryDisplayOptions}
        onViewportChange={handleViewportChange}
      />
    );
    const svg = container.querySelector("svg");

    if (!svg) {
      throw new Error("Expected an SVG viewport.");
    }

    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 520,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => undefined
    });

    fireEvent.wheel(svg, { clientX: 400, clientY: 260, deltaY: -120 });

    expect(handleViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: expect.any(Number),
        offsetX: expect.any(Number),
        offsetY: expect.any(Number)
      })
    );
    expect(handleViewportChange.mock.calls[0]?.[0].zoom).toBeGreaterThan(
      viewport.zoom
    );
  });

  it("emits pan viewport updates from background dragging", () => {
    const level = getPlaygroundLevel();
    const viewport = { zoom: 1, offsetX: 0, offsetY: 0 };
    const handleViewportChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level, createGeometrySelectionState(), viewport)}
        options={defaultGeometryDisplayOptions}
        onViewportChange={handleViewportChange}
      />
    );
    const svg = container.querySelector("svg");
    const background = container.querySelector(".geometry-pan-background");

    if (!svg || !background) {
      throw new Error("Expected an SVG viewport and pan background.");
    }

    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 520,
      height: 520,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => undefined
    });
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(background, {
      clientX: 40,
      clientY: 60,
      pointerId: 1
    });
    fireEvent.pointerMove(svg, { clientX: 70, clientY: 80, pointerId: 1 });

    expect(handleViewportChange).toHaveBeenCalledWith({
      zoom: 1,
      offsetX: 30,
      offsetY: 20
    });
  });
});
