import { createFurniturePresentation2D } from "../presentation/furniture-presentation-model-2d";
import { getProjectEditorInteraction } from "../../editor-2d/state/project-editor-tools";
import { GeometryEngine, type LevelGeometry } from "@casastudio/geometry";
import { ProjectSchema } from "@casastudio/schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { geometryPlaygroundProject } from "../../geometry-playground/geometry-playground-fixture";
import {
  collectLevelBounds,
  countBoundaryEdgeUses
} from "../viewport/geometry-svg-helpers";
import { createRuntimeGeometryPresentationModel2D } from "../presentation/geometry-presentation-model-2d";
import {
  defaultGeometryDisplayOptions,
  GeometrySvgViewer,
  projectGeometryDisplayOptions
} from "./GeometrySvgViewer";
import {
  createGeometrySelectionState,
  selectDoor,
  selectPolygon,
  selectWindow
} from "../selection/geometry-selection-state";
import type { ArchitecturalPresentationModel2D } from "../presentation/architectural-presentation-model-2d";
import {
  createFitViewportState,
  createViewportTransform2D,
  defaultViewportState,
  type ViewportState
} from "../viewport/viewport-transform-2d";

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

const architecturalPresentationModel: ArchitecturalPresentationModel2D = {
  walls: [
    {
      kind: "WALL",
      geometryId: "wall",
      bodySvgPoints: ["80,90 80,110 300,110 300,90"],
      start: { x: 80, y: 100 },
      end: { x: 300, y: 100 },
      hitWidth: 20,
      selected: false,
      hovered: false
    }
  ],
  doors: [
    {
      kind: "DOOR",
      geometryId: "door",
      wallId: "wall",
      spanStart: { x: 100, y: 100 },
      spanEnd: { x: 190, y: 100 },
      hinge: { x: 100, y: 100 },
      leafEnd: { x: 100, y: 190 },
      arcPath: "M 190,100 A 90 90 0 0 1 100,190",
      jambs: [
        [
          { x: 100, y: 90 },
          { x: 100, y: 110 }
        ],
        [
          { x: 190, y: 90 },
          { x: 190, y: 110 }
        ]
      ],
      selected: false,
      hovered: false
    }
  ],
  windows: [
    {
      kind: "WINDOW",
      geometryId: "window",
      wallId: "wall",
      spanStart: { x: 210, y: 100 },
      spanEnd: { x: 280, y: 100 },
      glazingLines: [
        [
          { x: 210, y: 96 },
          { x: 280, y: 96 }
        ],
        [
          { x: 210, y: 104 },
          { x: 280, y: 104 }
        ]
      ],
      jambs: [
        [
          { x: 210, y: 90 },
          { x: 210, y: 110 }
        ],
        [
          { x: 280, y: 90 },
          { x: 280, y: 110 }
        ]
      ],
      selected: false,
      hovered: false
    }
  ],
  openings: [
    {
      kind: "OPENING",
      geometryId: "passage",
      wallId: "wall",
      spanStart: { x: 300, y: 100 },
      spanEnd: { x: 350, y: 100 },
      jambs: [
        [
          { x: 300, y: 90 },
          { x: 300, y: 110 }
        ],
        [
          { x: 350, y: 90 },
          { x: 350, y: 110 }
        ]
      ],
      selected: false,
      hovered: false
    }
  ],
  staircases: [],
  joins: []
};

const selectedDoorArchitecturalPresentationModel: ArchitecturalPresentationModel2D =
  {
    ...architecturalPresentationModel,
    doors: architecturalPresentationModel.doors.map((door) => ({
      ...door,
      selected: door.geometryId === "door"
    }))
  };

afterEach(() => {
  cleanup();
});

describe("GeometrySvgViewer", () => {
  it("emits passive authoring coordinates only while the pointer is inside canvas bounds", () => {
    const onEditorPointerMove = vi.fn();
    render(
      <GeometrySvgViewer
        {...createViewerProps(getPlaygroundLevel())}
        options={defaultGeometryDisplayOptions}
        onEditorPointerMove={onEditorPointerMove}
      />
    );
    const canvas = screen.getByRole("img", {
      name: /interactive 2d geometry viewer/i
    });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      right: 810,
      bottom: 540,
      width: 800,
      height: 520,
      x: 10,
      y: 20,
      toJSON: () => ({})
    });

    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 260, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 900, clientY: 260, pointerId: 1 });

    expect(onEditorPointerMove).toHaveBeenCalledTimes(1);
  });
  it("keeps Furniture click/drag thresholds and allows the first placement after a rotation gesture", () => {
    const item = createFurniturePresentation2D({
      id: "sofa",
      roomId: "living",
      definitionId: "generic-sofa",
      position: { x: 100, z: 100 },
      rotation: 27.5,
      width: 200,
      depth: 90,
      height: 85
    });
    const props = {
      ...createViewerProps(
        getPlaygroundLevel(),
        createGeometrySelectionState([
          { kind: "FURNITURE", geometryId: "sofa" }
        ])
      ),
      options: defaultGeometryDisplayOptions,
      furnitureModel: { items: [item], previewValid: true, editing: true },
      onFurniturePointerDown: vi.fn(),
      onFurniturePointerUp: vi.fn(),
      onFurniturePointerCancel: vi.fn(),
      onEditorPointerMove: vi.fn(),
      onEditorCanvasClick: vi.fn()
    };
    const { container, rerender } = render(
      <GeometrySvgViewer
        {...props}
        interaction={getProjectEditorInteraction("select")}
      />
    );
    const svg = container.querySelector("svg")!;
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
    svg.hasPointerCapture = vi.fn(() => true);
    const hit = screen.getByTestId("furniture-hit-target");
    fireEvent.pointerDown(hit, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      button: 0
    });
    fireEvent.pointerMove(svg, { clientX: 103, clientY: 100, pointerId: 1 });
    expect(props.onEditorPointerMove).not.toHaveBeenCalled();
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(props.onFurniturePointerUp).toHaveBeenLastCalledWith(false);
    fireEvent.click(svg);
    const handle = screen.getByTestId("furniture-rotation-handle");
    fireEvent.pointerDown(handle, {
      clientX: 100,
      clientY: 100,
      pointerId: 2,
      button: 0
    });
    fireEvent.pointerMove(svg, { clientX: 110, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(svg, { pointerId: 2 });
    fireEvent.click(handle);
    expect(props.onFurniturePointerUp).toHaveBeenLastCalledWith(true);
    expect(props.onFurniturePointerDown.mock.calls.at(-1)?.slice(0, 2)).toEqual(
      ["sofa", "rotate"]
    );
    rerender(
      <GeometrySvgViewer
        {...props}
        interaction={getProjectEditorInteraction("furniture")}
      />
    );
    fireEvent.pointerDown(svg, {
      clientX: 200,
      clientY: 200,
      pointerId: 3,
      button: 0
    });
    fireEvent.pointerUp(svg, { pointerId: 3 });
    fireEvent.click(svg, { clientX: 200, clientY: 200 });
    expect(props.onEditorCanvasClick).toHaveBeenCalledTimes(1);
  });

  it("keeps Furniture hover independent of geometry and gives Space-pan priority over Furniture hits", () => {
    const item = createFurniturePresentation2D({
      id: "chair",
      roomId: "living",
      definitionId: "generic-chair",
      position: { x: 50, z: 50 },
      rotation: 37,
      width: 45,
      depth: 50,
      height: 85
    });
    const onSelectionStateChange = vi.fn(),
      onFurniturePointerDown = vi.fn(),
      onViewportChange = vi.fn();
    const props = {
      ...createViewerProps(getPlaygroundLevel()),
      options: defaultGeometryDisplayOptions,
      furnitureModel: { items: [item], previewValid: true, editing: true },
      onSelectionStateChange,
      onFurniturePointerDown,
      onViewportChange
    };
    const { container, rerender } = render(
      <GeometrySvgViewer
        {...props}
        interaction={getProjectEditorInteraction("select")}
      />
    );
    fireEvent.mouseEnter(screen.getByTestId("furniture-hit-target"));
    expect(onSelectionStateChange).toHaveBeenCalledWith({
      selected: [],
      hovered: { kind: "FURNITURE", geometryId: "chair" }
    });
    rerender(
      <GeometrySvgViewer
        {...props}
        interaction={getProjectEditorInteraction("select", true)}
      />
    );
    const svg = container.querySelector("svg")!;
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();
    svg.hasPointerCapture = vi.fn(() => true);
    fireEvent.pointerDown(screen.getByTestId("furniture-hit-target"), {
      clientX: 100,
      clientY: 100,
      pointerId: 5,
      button: 0
    });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 120, pointerId: 5 });
    fireEvent.pointerUp(svg, { pointerId: 5 });
    expect(onFurniturePointerDown).not.toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalled();
    expect(item.rotation).toBe(37);
  });

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
    expect(markup.match(/data-testid="room-contour"/g)).toHaveLength(2);
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

  it("renders lightweight transient proposals and suppresses only the active drag source", () => {
    const level = getPlaygroundLevel();
    const edge = level.boundaryEdges[0]!;
    const viewerProps = createViewerProps(level);
    const { rerender } = render(
      <GeometrySvgViewer
        {...viewerProps}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: true,
          panEnabled: true,
          drawWallEnabled: false,
          wallEndpointEditingEnabled: true
        }}
        editorOverlay={{
          drawWall: {
            start: { x: 0, z: 0 },
            end: { x: 25, z: 25 },
            lengthLabel: "0.35 m"
          },
          selectedWall: {
            wallId: edge.sourceWallId!,
            start: edge.startVertex,
            end: { x: edge.endVertex.x + 10, z: edge.endVertex.z + 10 },
            endpointEditingAvailable: { start: true, end: true },
            draggingEndpoint: "end"
          }
        }}
      />
    );

    expect(
      screen
        .getByTestId("draw-wall-preview")
        .querySelector("line")
        ?.getAttribute("class")
    ).toBe("geometry-wall-preview");
    expect(
      screen.getByTestId("draw-wall-preview-length").textContent
    ).toContain("0.35 m");
    expect(
      screen
        .getByTestId("selected-wall-overlay")
        .querySelector("line")
        ?.getAttribute("class")
    ).toContain("geometry-selected-wall--dragging");
    const stableEdges = screen.getAllByTestId("boundary-edge");
    expect(
      stableEdges.filter((stableEdge) =>
        stableEdge.getAttribute("class")?.includes("geometry-edge--drag-source")
      )
    ).toHaveLength(1);

    rerender(
      <GeometrySvgViewer
        {...viewerProps}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: true,
          panEnabled: true,
          drawWallEnabled: false,
          wallEndpointEditingEnabled: true
        }}
        editorOverlay={{
          selectedWall: {
            wallId: edge.sourceWallId!,
            start: edge.startVertex,
            end: edge.endVertex,
            endpointEditingAvailable: { start: true, end: true }
          }
        }}
      />
    );
    expect(
      screen
        .getAllByTestId("boundary-edge")
        .some((stableEdge) =>
          stableEdge
            .getAttribute("class")
            ?.includes("geometry-edge--drag-source")
        )
    ).toBe(false);
    expect(screen.queryByTestId("draw-wall-preview-length")).toBeNull();
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

  it("renders one exact irregular Room contour independently of rectangular bounds", () => {
    const level = getPlaygroundLevel();
    const viewerProps = createViewerProps(level);
    const polygon = viewerProps.presentationModel.polygons[0]!;
    const screenPoints = [
      { x: 120, y: 80 },
      { x: 360, y: 80 },
      { x: 330, y: 140 },
      { x: 240, y: 165 },
      { x: 180, y: 220 },
      { x: 120, y: 260 }
    ];
    const presentationPoints = screenPoints.map((screen) => ({
      world: { x: screen.x, z: screen.y },
      screen
    }));
    const irregularPoints = screenPoints
      .map((point) => `${point.x},${point.y}`)
      .join(" ");
    const presentationModel = {
      ...viewerProps.presentationModel,
      polygons: [
        {
          ...polygon,
          points: presentationPoints,
          svgPoints: irregularPoints,
          centroid: {
            world: { x: 213.25, z: 139.75 },
            screen: { x: 213.25, y: 139.75 }
          },
          screenBounds: { x: 120, y: 80, width: 240, height: 180 }
        }
      ],
      boundaryEdges: screenPoints.map((start, index) => {
        const edge = viewerProps.presentationModel.boundaryEdges[index]!;
        const end = screenPoints[(index + 1) % screenPoints.length]!;
        return {
          ...edge,
          start: presentationPoints[index]!,
          end: presentationPoints[(index + 1) % presentationPoints.length]!,
          midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
        };
      })
    };
    const { container } = render(
      <GeometrySvgViewer
        {...viewerProps}
        presentationModel={presentationModel}
        options={{ ...defaultGeometryDisplayOptions, bounds: true }}
      />
    );

    const roomPolygon = screen.getByTestId("geometry-polygon");
    const roomContour = screen.getByTestId("room-contour");
    const bounds = screen.getByTestId("polygon-bounds");
    const centroid = screen.getByTestId("polygon-centroid");
    const layers = [...container.querySelectorAll("g[data-layer]")];
    const boundsLayer = container.querySelector(
      '[data-layer="polygon-bounds"]'
    );

    expect(roomPolygon.getAttribute("points")).toBe(irregularPoints);
    expect(roomContour.getAttribute("points")).toBe(irregularPoints);
    expect(roomContour.getAttribute("points")).toBe(
      roomPolygon.getAttribute("points")
    );
    expect(roomContour.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(roomContour.getAttribute("points")).toContain(
      "330,140 240,165 180,220"
    );
    expect(roomContour.tagName.toLowerCase()).toBe("polygon");
    expect(bounds.tagName.toLowerCase()).toBe("rect");
    expect(bounds.getAttribute("x")).toBe("120");
    expect(bounds.getAttribute("y")).toBe("80");
    expect(bounds.getAttribute("width")).toBe("240");
    expect(bounds.getAttribute("height")).toBe("180");
    expect(centroid.querySelector("circle")?.getAttribute("cx")).toBe("213.25");
    expect(centroid.querySelector("circle")?.getAttribute("cy")).toBe("139.75");
    expect(bounds.hasAttribute("points")).toBe(false);
    expect(boundsLayer?.getAttribute("data-diagnostic")).toBe("true");
    expect(boundsLayer?.getAttribute("aria-hidden")).toBe("true");
    expect(boundsLayer?.getAttribute("class")).toContain(
      "geometry-diagnostic-layer"
    );
    expect(layers.indexOf(boundsLayer!)).toBeLessThan(
      layers.indexOf(container.querySelector('[data-layer="polygons"]')!)
    );
    expect(
      layers.indexOf(container.querySelector('[data-layer="polygons"]')!)
    ).toBeLessThan(
      layers.indexOf(container.querySelector('[data-layer="room-contours"]')!)
    );
    expect(
      layers.indexOf(container.querySelector('[data-layer="room-contours"]')!)
    ).toBeLessThan(
      layers.indexOf(container.querySelector('[data-layer="boundary-edges"]')!)
    );
    expect(
      screen
        .getAllByTestId("boundary-edge")
        .map((edge) => [
          `${edge.getAttribute("x1")},${edge.getAttribute("y1")}`,
          `${edge.getAttribute("x2")},${edge.getAttribute("y2")}`
        ])
    ).toEqual(
      screenPoints.map((point, index) => {
        const end = screenPoints[(index + 1) % screenPoints.length]!;
        return [`${point.x},${point.y}`, `${end.x},${end.y}`];
      })
    );
  });

  it("uses clean architectural Project defaults without removing physical hit geometry", () => {
    expect(projectGeometryDisplayOptions).toMatchObject({
      architecturalWalls: true,
      openings: true,
      polygons: true,
      roomContours: false,
      boundaryEdges: true,
      vertices: true,
      centroids: true,
      bounds: false,
      entityLabels: false
    });
    expect(defaultGeometryDisplayOptions).not.toBe(
      projectGeometryDisplayOptions
    );
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

    const editableMarkup = renderToStaticMarkup(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: false,
          panEnabled: false,
          drawWallEnabled: true,
          wallEndpointEditingEnabled: false
        }}
        editorOverlay={{ grid: { visible: true, spacing: 100 } }}
      />
    );
    expect(editableMarkup).toContain("<svg");
    expect(editableMarkup).toContain('data-layer="editor-grid"');
  });

  it("normalizes boundary-edge clicks to canonical Walls while retaining Vertex diagnostics", () => {
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
          kind: "WALL",
          geometryId: level.boundaryEdges[0]?.sourceWallId
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

  it("prioritizes a first Opening click and reserves movement semantics for a real drag", () => {
    const level = getPlaygroundLevel();
    const handleSelectionStateChange = vi.fn();
    const handleOpeningPointerDown = vi.fn();
    const handleOpeningDragThresholdCrossed = vi.fn();
    const handleOpeningPointerUp = vi.fn();
    const handleEditorPointerMove = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        architecturalModel={architecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: true,
          panEnabled: true,
          drawWallEnabled: false,
          wallEndpointEditingEnabled: false,
          openingEditingEnabled: true
        }}
        onSelectionStateChange={handleSelectionStateChange}
        onOpeningPointerDown={handleOpeningPointerDown}
        onOpeningDragThresholdCrossed={handleOpeningDragThresholdCrossed}
        onOpeningPointerUp={handleOpeningPointerUp}
        onEditorPointerMove={handleEditorPointerMove}
      />
    );
    const svg = container.querySelector("svg")!;
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
    svg.hasPointerCapture = vi.fn(() => true);

    const door = screen.getByTestId("architectural-door");
    fireEvent.pointerDown(door, { clientX: 120, clientY: 100, pointerId: 41 });
    fireEvent.pointerMove(svg, { clientX: 123, clientY: 100, pointerId: 41 });
    fireEvent.pointerUp(svg, { clientX: 123, clientY: 100, pointerId: 41 });
    fireEvent.click(door);

    expect(handleSelectionStateChange).toHaveBeenLastCalledWith({
      selected: [selectDoor("door")],
      hovered: undefined
    });
    expect(handleOpeningPointerDown).toHaveBeenCalledWith("door", "wall", 41);
    expect(handleOpeningDragThresholdCrossed).not.toHaveBeenCalled();
    expect(handleOpeningPointerUp).toHaveBeenCalledWith(41, false);
    expect(handleEditorPointerMove).not.toHaveBeenCalled();

    fireEvent.pointerDown(door, { clientX: 145, clientY: 100, pointerId: 42 });
    fireEvent.pointerMove(svg, { clientX: 130, clientY: 100, pointerId: 42 });
    fireEvent.pointerMove(svg, { clientX: 145, clientY: 100, pointerId: 42 });
    fireEvent.pointerUp(svg, { clientX: 145, clientY: 100, pointerId: 42 });
    fireEvent.click(door);

    expect(handleOpeningDragThresholdCrossed).toHaveBeenCalledTimes(1);
    expect(handleOpeningPointerUp).toHaveBeenLastCalledWith(42, true);
    expect(handleEditorPointerMove).toHaveBeenCalledTimes(2);
    expect(handleSelectionStateChange.mock.calls.at(-1)?.[0]).toEqual({
      selected: [selectDoor("door")],
      hovered: undefined
    });
    const layers = [...container.querySelectorAll("g[data-layer]")];
    expect(
      layers.indexOf(container.querySelector('[data-layer="boundary-edges"]')!)
    ).toBeLessThan(
      layers.indexOf(
        container.querySelector('[data-layer="architectural-openings"]')!
      )
    );
  });

  it("selects a Window as the canonical Opening entity", () => {
    const level = getPlaygroundLevel();
    const handleSelectionStateChange = vi.fn();
    render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        architecturalModel={architecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: true,
          panEnabled: true,
          drawWallEnabled: false,
          wallEndpointEditingEnabled: false,
          openingEditingEnabled: true
        }}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );
    fireEvent.click(screen.getByTestId("architectural-window"));
    expect(handleSelectionStateChange).toHaveBeenCalledWith({
      selected: [{ kind: "WINDOW", geometryId: "window" }],
      hovered: undefined
    });
  });

  it("renders and selects a clean Wall Opening without leaf, arc, or glazing", () => {
    const handleSelectionStateChange = vi.fn();
    render(
      <GeometrySvgViewer
        {...createViewerProps(getPlaygroundLevel())}
        architecturalModel={architecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );
    const opening = screen.getByTestId("architectural-wall-opening");
    expect(opening.querySelector("path")).toBeNull();
    expect(opening.querySelector(".architectural-window-line")).toBeNull();
    expect(opening.querySelector(".architectural-door-leaf")).toBeNull();
    fireEvent.click(opening);
    expect(handleSelectionStateChange).toHaveBeenCalledWith({
      selected: [{ kind: "OPENING", geometryId: "passage" }],
      hovered: undefined
    });
  });

  it("shows one selected Opening grip and exposes grab and grabbing lifecycle classes", () => {
    const level = getPlaygroundLevel();
    const viewerProps = createViewerProps(level);
    const selectedViewerProps = createViewerProps(
      level,
      createGeometrySelectionState([selectDoor("door")])
    );
    const interaction = {
      selectionEnabled: true,
      panEnabled: true,
      drawWallEnabled: false,
      wallEndpointEditingEnabled: false,
      openingEditingEnabled: true
    };
    const { container, rerender } = render(
      <GeometrySvgViewer
        {...viewerProps}
        architecturalModel={architecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={interaction}
      />
    );

    expect(screen.queryByTestId("selected-opening-drag-handle")).toBeNull();
    expect(screen.getByTestId("architectural-door").classList).toContain(
      "architectural-opening--draggable"
    );

    rerender(
      <GeometrySvgViewer
        {...createViewerProps(
          level,
          createGeometrySelectionState([
            selectDoor("door"),
            selectWindow("window")
          ])
        )}
        architecturalModel={selectedDoorArchitecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={interaction}
      />
    );
    expect(screen.queryByTestId("selected-opening-drag-handle")).toBeNull();

    rerender(
      <GeometrySvgViewer
        {...selectedViewerProps}
        architecturalModel={selectedDoorArchitecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={interaction}
      />
    );
    expect(screen.getByTestId("selected-opening-drag-handle")).toBeTruthy();

    rerender(
      <GeometrySvgViewer
        {...selectedViewerProps}
        architecturalModel={selectedDoorArchitecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={interaction}
        editorOverlay={{ activeOpeningDragId: "door" }}
      />
    );
    expect(container.querySelector("svg")?.classList).toContain(
      "geometry-svg--opening-drag"
    );
    expect(
      screen.getByTestId("architectural-door").getAttribute("data-dragging")
    ).toBe("true");

    rerender(
      <GeometrySvgViewer
        {...selectedViewerProps}
        architecturalModel={selectedDoorArchitecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={interaction}
      />
    );
    expect(container.querySelector("svg")?.classList).not.toContain(
      "geometry-svg--opening-drag"
    );
    expect(screen.getByTestId("architectural-door").classList).toContain(
      "architectural-opening--draggable"
    );
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

  it("supports Cmd/Ctrl-click additive selection and toggling without using Shift", () => {
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

    fireEvent.click(edgeHitTarget, { metaKey: true });

    expect(handleAdditiveSelection).toHaveBeenCalledWith({
      selected: [
        selectPolygon(selectedPolygon.id),
        {
          kind: "WALL",
          geometryId: level.boundaryEdges[0]?.sourceWallId
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

    fireEvent.click(polygon, { ctrlKey: true });

    expect(handleToggleSelection).toHaveBeenCalledWith({
      selected: [],
      hovered: undefined
    });
  });

  it("does not let modifier pointer-down start Furniture manipulation or replace the selection", () => {
    const level = getPlaygroundLevel();
    const selectedPolygon = level.polygons[0]!;
    const item = createFurniturePresentation2D({
      id: "chair",
      roomId: "living",
      definitionId: "generic-chair",
      position: { x: 50, z: 50 },
      rotation: 0,
      width: 45,
      depth: 50,
      height: 85
    });
    const onSelectionStateChange = vi.fn();
    const onFurniturePointerDown = vi.fn();
    render(
      <GeometrySvgViewer
        {...createViewerProps(
          level,
          createGeometrySelectionState([selectPolygon(selectedPolygon.id)])
        )}
        options={defaultGeometryDisplayOptions}
        interaction={getProjectEditorInteraction("select")}
        furnitureModel={{ items: [item], previewValid: true, editing: true }}
        onFurniturePointerDown={onFurniturePointerDown}
        onSelectionStateChange={onSelectionStateChange}
      />
    );

    const furniture = screen.getByTestId("furniture-hit-target");
    fireEvent.pointerDown(furniture, {
      pointerId: 51,
      button: 0,
      metaKey: true
    });
    fireEvent.click(furniture, { metaKey: true });

    expect(onFurniturePointerDown).not.toHaveBeenCalled();
    expect(onSelectionStateChange).toHaveBeenLastCalledWith({
      selected: [
        selectPolygon(selectedPolygon.id),
        { kind: "FURNITURE", geometryId: "chair" }
      ],
      hovered: undefined
    });
  });

  it("clears on a normal empty click and preserves on a modifier empty click", () => {
    const level = getPlaygroundLevel();
    const selectedPolygon = level.polygons[0]!;
    const onSelectionStateChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(
          level,
          createGeometrySelectionState([selectPolygon(selectedPolygon.id)])
        )}
        options={defaultGeometryDisplayOptions}
        interaction={getProjectEditorInteraction("select")}
        editorOverlay={{}}
        onSelectionStateChange={onSelectionStateChange}
      />
    );
    const background = container.querySelector(".geometry-pan-background")!;

    fireEvent.click(background, { ctrlKey: true });
    expect(onSelectionStateChange).not.toHaveBeenCalled();

    fireEvent.click(background);
    expect(onSelectionStateChange).toHaveBeenCalledWith({
      selected: [],
      hovered: undefined
    });
  });

  it("creates a transient directional selection box from empty Select canvas", () => {
    const level = getPlaygroundLevel();
    const onSelectionStateChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level, createGeometrySelectionState(), {
          zoom: 1,
          offsetX: 0,
          offsetY: 0
        })}
        options={defaultGeometryDisplayOptions}
        interaction={getProjectEditorInteraction("select")}
        editorOverlay={{}}
        selectionFootprints={[
          {
            selection: { kind: "FURNITURE", geometryId: "chair" },
            polygons: [
              [
                { x: 10, z: -10 },
                { x: 20, z: -10 },
                { x: 20, z: -20 },
                { x: 10, z: -20 }
              ]
            ]
          }
        ]}
        onSelectionStateChange={onSelectionStateChange}
      />
    );
    const svg = container.querySelector("svg")!;
    const background = container.querySelector(".geometry-pan-background")!;
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
    svg.hasPointerCapture = vi.fn(() => true);
    fireEvent.pointerDown(background, {
      clientX: 5,
      clientY: 5,
      pointerId: 31,
      button: 0
    });
    fireEvent.pointerMove(svg, { clientX: 30, clientY: 30, pointerId: 31 });
    expect(
      screen.getByTestId("geometry-selection-box").getAttribute("data-mode")
    ).toBe("containment");
    fireEvent.pointerUp(svg, { clientX: 30, clientY: 30, pointerId: 31 });
    expect(onSelectionStateChange).toHaveBeenCalledWith({
      selected: [{ kind: "FURNITURE", geometryId: "chair" }],
      hovered: undefined
    });
    expect(screen.queryByTestId("geometry-selection-box")).toBeNull();
  });

  it("keeps an already-selected entity exclusively selected on a plain click", () => {
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
      selected: [selectPolygon(selectedPolygon.id)],
      hovered: undefined
    });
  });

  it("consumes one cancelable wheel event and emits one cursor-centered zoom update", () => {
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

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      clientY: 260,
      deltaY: -120
    });
    expect(svg.dispatchEvent(wheelEvent)).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(true);

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
    expect(handleViewportChange).toHaveBeenCalledTimes(1);
  });

  it("registers one non-passive wheel listener and removes the same listener", () => {
    const level = getPlaygroundLevel();
    const addEventListener = vi.spyOn(
      SVGSVGElement.prototype,
      "addEventListener"
    );
    const removeEventListener = vi.spyOn(
      SVGSVGElement.prototype,
      "removeEventListener"
    );
    const { rerender, unmount } = render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
        onViewportChange={vi.fn()}
      />
    );
    rerender(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
        onViewportChange={vi.fn()}
      />
    );

    const wheelRegistrations = addEventListener.mock.calls.filter(
      ([type]) => type === "wheel"
    );
    expect(wheelRegistrations).toHaveLength(1);
    expect(wheelRegistrations[0]?.[2]).toEqual({
      passive: false,
      capture: false
    });
    unmount();
    const wheelRemovals = removeEventListener.mock.calls.filter(
      ([type]) => type === "wheel"
    );
    expect(wheelRemovals).toHaveLength(1);
    expect(wheelRemovals[0]?.[1]).toBe(wheelRegistrations[0]?.[1]);
    expect(wheelRemovals[0]?.[2]).toEqual({
      passive: false,
      capture: false
    });
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

  it("captures full-viewport pan drags over Rooms, Walls, and Openings without selecting", () => {
    const level = getPlaygroundLevel();
    const handleViewportChange = vi.fn();
    const handleSelectionStateChange = vi.fn();
    const { container } = render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        architecturalModel={architecturalPresentationModel}
        options={defaultGeometryDisplayOptions}
        interaction={{
          selectionEnabled: false,
          panEnabled: true,
          panAnywhere: true,
          drawWallEnabled: false,
          wallEndpointEditingEnabled: false,
          openingEditingEnabled: false
        }}
        onViewportChange={handleViewportChange}
        onSelectionStateChange={handleSelectionStateChange}
      />
    );
    const svg = container.querySelector("svg")!;
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
    svg.hasPointerCapture = vi.fn(() => true);
    const targets = [
      screen.getAllByTestId("geometry-polygon")[0]!,
      container.querySelector(".architectural-wall-hit-target")!,
      screen.getByTestId("architectural-door"),
      screen.getByTestId("architectural-window")
    ];

    targets.forEach((target, index) => {
      const pointerId = index + 20;
      fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId });
      expect(svg.classList).toContain("geometry-svg--panning");
      fireEvent.pointerMove(svg, { clientX: 110, clientY: 105, pointerId });
      fireEvent.pointerUp(svg, { clientX: 110, clientY: 105, pointerId });
      expect(svg.classList).not.toContain("geometry-svg--panning");
    });

    expect(handleViewportChange).toHaveBeenCalledTimes(4);
    expect(handleSelectionStateChange).not.toHaveBeenCalled();
    expect(svg.setPointerCapture).toHaveBeenCalledTimes(4);
    expect(svg.releasePointerCapture).toHaveBeenCalledTimes(4);

    fireEvent.pointerDown(targets[0]!, {
      clientX: 100,
      clientY: 100,
      pointerId: 30
    });
    fireEvent.pointerCancel(svg, { pointerId: 30 });
    expect(svg.releasePointerCapture).toHaveBeenLastCalledWith(30);
    expect(svg.classList).not.toContain("geometry-svg--panning");
  });

  it("renders selectable transient Room faces without changing geometry selection", () => {
    const level = getPlaygroundLevel();
    const handleFaceClick = vi.fn();
    const handleSelectionStateChange = vi.fn();
    render(
      <GeometrySvgViewer
        {...createViewerProps(level)}
        options={defaultGeometryDisplayOptions}
        onSelectionStateChange={handleSelectionStateChange}
        onRoomFaceCandidateClick={handleFaceClick}
        editorOverlay={{
          roomFaceCandidates: [
            {
              faceKey: "face-a",
              vertices: [
                { x: 0, z: 0 },
                { x: 100, z: 0 },
                { x: 100, z: 100 },
                { x: 0, z: 100 }
              ],
              selected: true
            }
          ]
        }}
      />
    );

    const candidate = screen.getByTestId("room-face-candidate");
    expect(candidate.getAttribute("class")).toContain(
      "geometry-room-face-candidate--selected"
    );
    expect(candidate.getAttribute("class")).toContain(
      "geometry-room-face-candidate--focusable"
    );
    expect(candidate.getAttribute("tabindex")).toBe("0");
    fireEvent.click(candidate);
    expect(handleFaceClick).toHaveBeenCalledWith("face-a");
    expect(handleSelectionStateChange).not.toHaveBeenCalled();
    fireEvent.keyDown(candidate, { key: "Enter" });
    fireEvent.keyDown(candidate, { key: " " });
    expect(handleFaceClick).toHaveBeenCalledTimes(3);
  });
});
