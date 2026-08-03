import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Project } from "@casastudio/schema";

import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import { GeometryLayerControls } from "./GeometryLayerControls";
import { GeometryPlaygroundPage } from "./GeometryPlaygroundPage";
import { defaultGeometryDisplayOptions } from "./GeometrySvgViewer";

describe("GeometryPlaygroundPage", () => {
  it("renders accessible layer controls", () => {
    const markup = renderToStaticMarkup(
      <GeometryLayerControls
        options={defaultGeometryDisplayOptions}
        onOptionsChange={() => undefined}
      />
    );

    expect(markup).toContain("Show polygons");
    expect(markup).toContain("Show boundary edges");
    expect(markup).toContain("Show vertices");
    expect(markup).toContain("Show centroids");
    expect(markup).toContain("Show bounds");
    expect(markup).toContain("Show runtime labels");
  });

  it("renders technical geometry build errors without throwing", () => {
    const sourceLevel = geometryPlaygroundProject.building.levels[0];

    if (!sourceLevel) {
      throw new Error("Expected playground fixture to contain a level.");
    }

    const sourceRoom = sourceLevel.rooms[0];

    if (!sourceRoom) {
      throw new Error("Expected playground fixture to contain a room.");
    }

    const invalidProject: Project = {
      ...geometryPlaygroundProject,
      id: "invalid-playground-project",
      building: {
        ...geometryPlaygroundProject.building,
        levels: [
          {
            ...sourceLevel,
            rooms: [
              {
                ...sourceRoom,
                boundary: [
                  { wallId: "left-room-north-wall", direction: "FORWARD" },
                  { wallId: "left-room-east-shared-wall", direction: "FORWARD" }
                ]
              }
            ]
          }
        ]
      }
    };

    const markup = renderToStaticMarkup(<GeometryPlaygroundPage project={invalidProject} />);

    expect(markup).toContain("Geometry build failed");
    expect(markup).toContain("INVALID_PROJECT_GEOMETRY");
    expect(markup).toContain("boundary must contain at least three edges");
    expect(markup).toContain("building.levels[0].rooms[0].boundary");
  });

  it("clears selection with Escape", () => {
    render(<GeometryPlaygroundPage />);

    const polygon = screen.getAllByTestId("geometry-polygon")[0];

    if (!polygon) {
      throw new Error("Expected a polygon hit target.");
    }

    fireEvent.click(polygon);
    expect(polygon.getAttribute("class")).toContain("geometry-entity-selected");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(polygon.getAttribute("class")).not.toContain("geometry-entity-selected");
  });

  it("resets and fits the viewport from keyboard shortcuts", () => {
    render(<GeometryPlaygroundPage />);

    const polygon = screen.getAllByTestId("geometry-polygon")[0];

    if (!polygon) {
      throw new Error("Expected a polygon hit target.");
    }

    const fittedPoints = polygon.getAttribute("points");

    fireEvent.keyDown(window, { key: "r" });
    expect(polygon.getAttribute("points")).not.toBe(fittedPoints);

    fireEvent.keyDown(window, { key: "f" });
    expect(polygon.getAttribute("points")).toBe(fittedPoints);
  });
});
