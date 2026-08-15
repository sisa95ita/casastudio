import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { ProjectSelectionDetails } from "./ProjectSelectionDetails";

afterEach(cleanup);

describe("ProjectSelectionDetails", () => {
  it("shows runtime Vertex coordinates and incident domain Wall IDs read-only", () => {
    render(
      <ProjectSelectionDetails
        model={model}
        selectionState={{
          selected: [{ kind: "VERTEX", geometryId: "vertex-shared" }]
        }}
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: true,
          start: { topology: "standalone", draggable: false },
          end: { topology: "standalone", draggable: false }
        }}
        onDeleteWall={vi.fn()}
        onUpdateWallProperties={vi.fn(() => true)}
      />
    );

    expect(screen.getByText("Vertex")).toBeTruthy();
    expect(screen.getByText("X: 12.5 cm · Z: 44 cm")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("wall-a")).toBeTruthy();
    expect(screen.getByText("wall-b")).toBeTruthy();
    expect(screen.queryByText(/select a wall/i)).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("shows a geometry-neutral empty state", () => {
    render(
      <ProjectSelectionDetails
        model={model}
        selectionState={{ selected: [] }}
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: true,
          start: { topology: "standalone", draggable: false },
          end: { topology: "standalone", draggable: false }
        }}
        onDeleteWall={vi.fn()}
        onUpdateWallProperties={vi.fn(() => true)}
      />
    );
    expect(
      screen.getByText("Select geometry in the plan to inspect its details.")
    ).toBeTruthy();
  });
});

const model = {
  levelId: "runtime-level",
  sourceLevelId: "ground-floor",
  bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
  polygons: [],
  vertices: [
    {
      kind: "VERTEX",
      geometryId: "vertex-shared",
      coordinates: { x: 12.5, z: 44 },
      point: { x: 100, y: 100 },
      selected: true,
      hovered: false
    }
  ],
  boundaryEdges: [
    createEdge("edge-a", "wall-a", "vertex-a", "vertex-shared"),
    createEdge("edge-b", "wall-b", "vertex-shared", "vertex-b")
  ]
} satisfies GeometryPresentationModel2D;

function createEdge(
  geometryId: string,
  sourceWallId: string,
  startVertexId: string,
  endVertexId: string
) {
  return {
    kind: "BOUNDARY_EDGE" as const,
    geometryId,
    sourceWallId,
    startVertexId,
    endVertexId,
    start: { world: { x: 0, z: 0 }, screen: { x: 0, y: 0 } },
    end: { world: { x: 1, z: 1 }, screen: { x: 1, y: 1 } },
    midpoint: { x: 0.5, y: 0.5 },
    sharedUsageCount: 1,
    selected: false,
    hovered: false
  };
}
