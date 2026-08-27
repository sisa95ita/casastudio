import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProjectWallPropertiesDetails,
  ProjectWallSelectionDetails
} from "./ProjectWallSelectionDetails";

afterEach(cleanup);

describe("ProjectWallSelectionDetails", () => {
  it("shows canonical read-only Wall values and exposes one delete action", () => {
    const handleDelete = vi.fn();
    render(
      <ProjectWallSelectionDetails
        wall={{
          id: "wall-inspected",
          start: { x: 10, z: 20 },
          end: { x: 40, z: 60 },
          thickness: 20,
          height: 300,
          roomIds: [],
          openings: []
        }}
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: false,
          start: { topology: "standalone", draggable: true },
          end: { topology: "standalone", draggable: true }
        }}
        onDelete={handleDelete}
      />
    );

    expect(screen.getByText("0.50 m")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("10, 20 cm")).toBeTruthy();
    expect(screen.getByText("40, 60 cm")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Wall" }));
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps an empty selection minimal", () => {
    render(
      <ProjectWallSelectionDetails
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: false,
          start: { topology: "standalone", draggable: true },
          end: { topology: "standalone", draggable: true }
        }}
        onDelete={vi.fn()}
      />
    );

    expect(
      screen.getByText("Select a wall in the plan to inspect it.")
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Wall" })).toBeNull();
  });

  it("commits numeric edits only on a boundary and restores rejected values", () => {
    const handleUpdate = vi.fn(() => true);
    render(
      <ProjectWallPropertiesDetails
        wall={{
          id: "wall-inspected",
          start: { x: 0, z: 0 },
          end: { x: 100, z: 0 },
          thickness: 20,
          height: 300,
          roomIds: [],
          openings: []
        }}
        units={{ length: "cm", angle: "deg" }}
        onUpdateProperties={handleUpdate}
      />
    );

    const thickness = screen.getByRole("spinbutton", {
      name: "Thickness (cm)"
    });
    fireEvent.change(thickness, { target: { value: "24.126" } });
    expect(handleUpdate).not.toHaveBeenCalled();
    fireEvent.blur(thickness);
    expect(handleUpdate).toHaveBeenCalledWith({ thickness: 24.13 });
    expect(thickness).toHaveProperty("value", "24.13");

    const height = screen.getByRole("spinbutton", { name: "Height (cm)" });
    fireEvent.change(height, { target: { value: "310.126" } });
    fireEvent.blur(height);
    expect(handleUpdate).toHaveBeenCalledWith({ height: 310.13 });
    expect(height).toHaveProperty("value", "310.13");

    handleUpdate.mockReturnValue(false);
    fireEvent.change(height, { target: { value: "0" } });
    fireEvent.blur(height);
    expect(handleUpdate).toHaveBeenCalledWith({ height: 0 });
    expect(height).toHaveProperty("value", "300");

    handleUpdate.mockReturnValue(true);
    const length = screen.getByRole("spinbutton", { name: "Length (cm)" });
    fireEvent.change(length, { target: { value: "125.5" } });
    fireEvent.keyDown(length, { key: "Enter" });
    expect(handleUpdate).toHaveBeenCalledWith({ length: 125.5, anchoredEndpoint: "START" });

    fireEvent.change(length, { target: { value: "42" } });
    fireEvent.keyDown(length, { key: "Escape" });
    expect(length).toHaveProperty("value", "100");
  });

  it("explains unavailable endpoint editing while retaining property controls", () => {
    render(
      <ProjectWallSelectionDetails
        wall={{
          id: "room-wall",
          start: { x: 0, z: 0 },
          end: { x: 100, z: 0 },
          thickness: 20,
          height: 300,
          roomIds: ["room-one"],
          openings: []
        }}
        units={{ length: "cm", angle: "deg" }}
        endpointAvailability={{
          roomReferenced: true,
          start: { topology: "standalone", draggable: false },
          end: { topology: "standalone", draggable: false }
        }}
        onDelete={vi.fn()}
      />
    );

    expect(
      screen.getByText(/move all connected walls together/i)
    ).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
