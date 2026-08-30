import { cleanup, render, screen, within } from "@testing-library/react";
import type { Project } from "@casastudio/schema";
import { afterEach, describe, expect, it } from "vitest";

import { demoProjectFixture } from "../test/demo-project-fixture";
import { createArchitecturalScene3DModel } from "./architectural-scene-3d-model";
import { resolveArchitecturalSelection3D } from "./architectural-selection-3d";
import { Project3DInspector } from "./Project3DInspector";

afterEach(cleanup);

describe("Project3DInspector", () => {
  const model = createArchitecturalScene3DModel(createSelectableProject());

  it("shows Project and visible-Level context when nothing is selected", () => {
    renderInspector();

    expect(screen.getByText("Inspector Project")).toBeTruthy();
    expect(screen.getByText("Nothing selected")).toBeTruthy();
    expect(screen.getByText("Ground Floor")).toBeTruthy();
  });

  it.each([
    ["wall", "left-room-north-wall", "Wall", ["4.00 m", "0.20 m", "3.00 m"]],
    ["door", "inspector-door", "Door", ["0.90 m", "2.10 m", "END", "RIGHT"]],
    ["window", "inspector-window", "Window", ["1.00 m", "1.20 m", "0.90 m"]],
    ["wall-opening", "inspector-opening", "Wall Opening", ["1.00 m", "2.20 m"]],
    ["room", "left-room", "Room", ["Left Room", "Living Room", "12.00 m²"]]
  ] as const)("renders read-only %s metadata", (kind, id, type, values) => {
    const selection = resolveArchitecturalSelection3D(model, {
      kind,
      id,
      levelId: "ground-floor"
    });
    renderInspector(selection);

    const details = screen.getByTestId("project-3d-selection-details");
    expect(within(details).getAllByText(type).length).toBeGreaterThan(0);
    for (const value of values) expect(within(details).getByText(value)).toBeTruthy();
    expect(within(details).queryByRole("textbox")).toBeNull();
    expect(within(details).queryByRole("spinbutton")).toBeNull();
    expect(within(details).queryByRole("button")).toBeNull();
  });

  function renderInspector(
    selection = undefined as ReturnType<typeof resolveArchitecturalSelection3D>
  ) {
    return render(
      <Project3DInspector
        projectName="Inspector Project"
        model={model}
        visibility="all"
        activeLevelId="ground-floor"
        selection={selection}
      />
    );
  }
});

function createSelectableProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const walls = project.building.levels[0]!.walls;
  walls[0]!.openings = [{
    id: "inspector-door",
    type: "DOOR",
    offsetFromStart: 50,
    width: 90,
    height: 210,
    elevation: 0,
    hingeSide: "END",
    swingSide: "RIGHT"
  }];
  walls[1]!.openings = [{
    id: "inspector-window",
    type: "WINDOW",
    offsetFromStart: 50,
    width: 100,
    height: 120,
    elevation: 90
  }];
  walls[2]!.openings = [{
    id: "inspector-opening",
    type: "OPENING",
    offsetFromStart: 50,
    width: 100,
    height: 220,
    elevation: 0
  }];
  return project;
}
