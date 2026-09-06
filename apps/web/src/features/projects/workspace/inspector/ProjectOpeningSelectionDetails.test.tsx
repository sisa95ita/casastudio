import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { updateOpening, type Project } from "@casastudio/schema";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProjectNewOpeningPropertiesDetails,
  ProjectOpeningPropertiesDetails,
  ProjectOpeningSelectionDetails
} from "./ProjectOpeningSelectionDetails";

afterEach(cleanup);

describe("ProjectOpeningSelectionDetails", () => {
  it.each([
    ["DOOR", "New Door"],
    ["WINDOW", "New Window"],
    ["OPENING", "New Wall Opening"]
  ] as const)("shows transient %s properties before placement", (openingType, title) => {
    const handleChange = vi.fn();
    render(
      <ProjectNewOpeningPropertiesDetails
        openingType={openingType}
        properties={{ width: 70, height: 200, elevation: openingType === "WINDOW" ? 90 : 0, hingeSide: "START", swingSide: "LEFT" }}
        units={{ length: "cm", angle: "deg" }}
        onChange={handleChange}
      />
    );
    expect(screen.getByText(title)).toBeTruthy();
    const width = screen.getByRole("spinbutton", { name: "Width (cm)" });
    fireEvent.change(width, { target: { value: "65" } });
    fireEvent.blur(width);
    expect(handleChange).toHaveBeenCalledWith({ width: 65 });
  });
  it("edits every individual Door measurement without changing another Door", () => {
    const onProjectChange = vi.fn();
    render(<OpeningInspectorHarness openingId="door-a" onProjectChange={onProjectChange} />);

    commitMeasurement("Width (cm)", "85");
    commitMeasurement("Height (cm)", "215");
    commitMeasurement("Position from wall start (cm)", "10");

    const project = onProjectChange.mock.calls.at(-1)?.[0] as Project;
    expect(opening(project, "door-a")).toMatchObject({
      width: 85,
      height: 215,
      offsetFromStart: 10,
      hingeSide: "START",
      swingSide: "LEFT"
    });
    expect(opening(project, "door-b")).toMatchObject({ width: 95, height: 205 });
    expect(screen.queryByLabelText("Sill height (cm)")).toBeNull();
  });

  it("keeps Door orientation and deletion as contextual Selection actions", () => {
    const onUpdate = vi.fn(() => true);
    const project = createProject();
    const wall = project.building.levels[0]!.walls[0]!;
    render(
      <ProjectOpeningSelectionDetails
        wall={wall}
        opening={opening(project, "door-a")}
        units={project.units}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Flip hinge" }));
    fireEvent.click(screen.getByRole("button", { name: "Flip swing" }));
    expect(onUpdate).toHaveBeenNthCalledWith(1, { hingeSide: "END" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { swingSide: "RIGHT" });
  });

  it("edits every individual Window measurement without changing another Window", () => {
    const onProjectChange = vi.fn();
    render(<OpeningInspectorHarness openingId="window-a" onProjectChange={onProjectChange} />);

    commitMeasurement("Width (cm)", "130");
    commitMeasurement("Height (cm)", "110");
    commitMeasurement("Sill height (cm)", "100");
    commitMeasurement("Position from wall start (cm)", "320");

    const project = onProjectChange.mock.calls.at(-1)?.[0] as Project;
    expect(opening(project, "window-a")).toMatchObject({
      width: 130,
      height: 110,
      elevation: 100,
      offsetFromStart: 320
    });
    expect(opening(project, "window-b")).toMatchObject({
      width: 180,
      height: 140,
      elevation: 80,
      offsetFromStart: 600
    });
  });

  it("restores a rejected individual measurement without changing the Project", () => {
    const onProjectChange = vi.fn();
    render(<OpeningInspectorHarness openingId="door-a" onProjectChange={onProjectChange} />);

    commitMeasurement("Width (cm)", "130");

    expect((screen.getByLabelText("Width (cm)") as HTMLInputElement).value).toBe("80");
    expect(onProjectChange).not.toHaveBeenCalled();
  });

  it("normalizes every Window measurement commit and display to two decimals", () => {
    const onProjectChange = vi.fn();
    render(<OpeningInspectorHarness openingId="window-a" onProjectChange={onProjectChange} />);

    commitMeasurement("Width (cm)", "120.5");
    expect((screen.getByLabelText("Width (cm)") as HTMLInputElement).value).toBe("120.5");
    commitMeasurement("Width (cm)", "120.126");
    commitMeasurementWithEnter("Height (cm)", "110.126");
    commitMeasurement("Sill height (cm)", "95.126");
    commitMeasurement("Position from wall start (cm)", "320.126");

    const project = onProjectChange.mock.calls.at(-1)?.[0] as Project;
    expect(opening(project, "window-a")).toMatchObject({
      width: 120.13,
      height: 110.13,
      elevation: 95.13,
      offsetFromStart: 320.13
    });
    expect((screen.getByLabelText("Width (cm)") as HTMLInputElement).value).toBe("120.13");
    expect((screen.getByLabelText("Height (cm)") as HTMLInputElement).value).toBe("110.13");
    expect((screen.getByLabelText("Sill height (cm)") as HTMLInputElement).value).toBe("95.13");
    expect((screen.getByLabelText("Position from wall start (cm)") as HTMLInputElement).value).toBe("320.13");
  });
});

function OpeningInspectorHarness({
  openingId,
  onProjectChange
}: {
  readonly openingId: string;
  readonly onProjectChange: (project: Project) => void;
}) {
  const [project, setProject] = useState(createProject);
  const wall = project.building.levels[0]!.walls[0]!;
  const selected = opening(project, openingId);
  return (
    <ProjectOpeningPropertiesDetails
      wall={wall}
      opening={selected}
      units={project.units}
      onUpdate={(properties) => {
        const result = updateOpening(project, {
          levelId: "level",
          wallId: wall.id,
          openingId,
          ...properties
        });
        if (!result.ok) return false;
        setProject(result.project);
        onProjectChange(result.project);
        return true;
      }}
    />
  );
}

function commitMeasurement(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

function commitMeasurementWithEnter(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: "Enter" });
}

function opening(project: Project, openingId: string) {
  const result = project.building.levels[0]!.walls[0]!.openings
    .find((candidate) => candidate.id === openingId);
  if (!result) throw new Error(`Opening ${openingId} was not found.`);
  return result;
}

function createProject(): Project {
  return {
    id: "opening-inspector",
    name: "Opening inspector",
    schemaVersion: "4.0.0",
    revision: 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: {
      furniture: [],
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [{
        id: "level",
        name: "Level",
        elevation: 0,
        rooms: [],
        staircases: [],
        walls: [{
          id: "wall",
          start: { x: 0, z: 0 },
          end: { x: 1000, z: 0 },
          height: 300,
          thickness: 20,
          roomIds: [],
          openings: [
            { id: "door-a", type: "DOOR", offsetFromStart: 0, width: 80, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" },
            { id: "door-b", type: "DOOR", offsetFromStart: 120, width: 95, height: 205, elevation: 0, hingeSide: "END", swingSide: "RIGHT" },
            { id: "window-a", type: "WINDOW", offsetFromStart: 300, width: 120, height: 120, elevation: 90 },
            { id: "window-b", type: "WINDOW", offsetFromStart: 600, width: 180, height: 140, elevation: 80 }
          ]
        }]
      }]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  };
}
