import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectWallSelectionDetails } from "./ProjectWallSelectionDetails";

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
        onUpdateProperties={vi.fn(() => true)}
      />
    );

    expect(screen.getByText("50 cm")).toBeTruthy();
    expect(
      screen.getByRole("spinbutton", { name: "Thickness (cm)" })
    ).toHaveProperty("value", "20");
    expect(
      screen.getByRole("spinbutton", { name: "Height (cm)" })
    ).toHaveProperty("value", "300");
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
        onUpdateProperties={vi.fn(() => true)}
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
      <ProjectWallSelectionDetails
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
        endpointAvailability={{
          roomReferenced: false,
          start: { topology: "standalone", draggable: true },
          end: { topology: "standalone", draggable: true }
        }}
        onDelete={vi.fn()}
        onUpdateProperties={handleUpdate}
      />
    );

    const thickness = screen.getByRole("spinbutton", {
      name: "Thickness (cm)"
    });
    fireEvent.change(thickness, { target: { value: "24" } });
    expect(handleUpdate).not.toHaveBeenCalled();
    fireEvent.blur(thickness);
    expect(handleUpdate).toHaveBeenCalledWith({ thickness: 24 });

    handleUpdate.mockReturnValue(false);
    const height = screen.getByRole("spinbutton", { name: "Height (cm)" });
    fireEvent.change(height, { target: { value: "0" } });
    fireEvent.blur(height);
    expect(handleUpdate).toHaveBeenCalledWith({ height: 0 });
    expect(height).toHaveProperty("value", "300");
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
        onUpdateProperties={vi.fn(() => true)}
      />
    );

    expect(
      screen.getByText(/endpoints cannot be moved independently yet/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("spinbutton", { name: "Height (cm)" })
    ).toBeTruthy();
  });
});
