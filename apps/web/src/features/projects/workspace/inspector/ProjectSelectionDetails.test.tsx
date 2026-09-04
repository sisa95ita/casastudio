import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import { ProjectPropertiesDetails, ProjectSelectionDetails } from "./ProjectSelectionDetails";

afterEach(cleanup);

describe("ProjectSelectionDetails", () => {
  it("shows the canonical Wall inspector for architectural Wall selections", () => {
    render(
      <ProjectSelectionDetails
        model={model}
        selectionState={{ selected: [{ kind: "WALL", geometryId: "wall-a" }] }}
        wall={{
          id: "wall-a",
          name: "Exterior wall",
          start: { x: 0, z: 0 },
          end: { x: 100, z: 0 },
          height: 280,
          thickness: 20,
          roomIds: [],
          openings: []
        }}
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: false,
          start: { topology: "standalone", draggable: true },
          end: { topology: "standalone", draggable: true }
        }}
        onDeleteWall={vi.fn()}
      />
    );

    expect(screen.getByText("Wall")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

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
      />
    );
    expect(
      screen.getByText("Select geometry in the plan to inspect its details.")
    ).toBeTruthy();
  });

  it("summarizes heterogeneous multi-selection by product entity type", () => {
    render(
      <ProjectSelectionDetails
        model={model}
        selectionState={{
          selected: [
            { kind: "WALL", geometryId: "wall-a" },
            { kind: "BOUNDARY_EDGE", geometryId: "edge-b" },
            { kind: "DOOR", geometryId: "door-a" }
          ]
        }}
        units={{ length: "cm", angle: "deg" }}
        onDeleteWall={vi.fn()}
      />
    );

    expect(screen.getByText("3 objects selected")).toBeTruthy();
    expect(screen.getByText("2 Walls, 1 Door")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("separates Room metrics and deletion from canonical metadata properties", () => {
    const onDeleteRoom = vi.fn();
    const onUpdateRoomProperties = vi.fn(() => true);
    const room = {
      id: "room-a",
      name: "Kitchen",
      type: "KITCHEN" as const,
      boundary: [
        { wallId: "wall-a", direction: "FORWARD" as const },
        { wallId: "wall-b", direction: "FORWARD" as const },
        { wallId: "wall-c", direction: "FORWARD" as const }
      ]
    };
    const selectionState = { selected: [{ kind: "POLYGON" as const, geometryId: "polygon-a" }] };
    const { rerender } = render(
      <ProjectSelectionDetails
        model={model}
        selectionState={selectionState}
        room={room}
        roomMeasurement={{
          roomId: room.id,
          area: 98_000,
          perimeter: 1_300,
          boundaryPoints: []
        }}
        units={{ length: "cm", angle: "deg" }}
        onDeleteWall={vi.fn()}
        onDeleteRoom={onDeleteRoom}
      />
    );

    expect(screen.getAllByText("Kitchen")).toHaveLength(2);
    expect(screen.getByText("9.80 m²")).toBeTruthy();
    expect(screen.getByText("13.00 m")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Room" }));
    expect(onDeleteRoom).toHaveBeenCalledOnce();

    rerender(
      <ProjectPropertiesDetails
        selectionState={selectionState}
        room={room}
        roomLevelElevation={20}
        units={{ length: "cm", angle: "deg" }}
        onUpdateWallProperties={vi.fn(() => true)}
        onUpdateRoomProperties={onUpdateRoomProperties}
      />
    );
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Dining Room" } });
    fireEvent.blur(name);
    expect(onUpdateRoomProperties).toHaveBeenCalledWith({ name: "Dining Room" });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Living room" }));
    expect(onUpdateRoomProperties).toHaveBeenCalledWith({ type: "LIVING_ROOM" });
    const elevation = screen.getByRole("spinbutton", { name: "Elevation above Level" });
    fireEvent.change(elevation, { target: { value: "175" } });
    fireEvent.blur(elevation);
    expect(onUpdateRoomProperties).toHaveBeenCalledWith({ elevation: 175 });
    const globalElevation = screen.getByDisplayValue("20");
    expect(globalElevation.hasAttribute("readonly")).toBe(true);
    expect(globalElevation.parentElement?.textContent).toContain("cm");
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
