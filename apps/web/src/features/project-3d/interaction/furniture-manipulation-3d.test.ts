import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../../../test/demo-project-fixture";
import { rectangleRoom } from "../../../test/vertical-architecture-fixture";
import {
  createFurnitureItemFromDefinition,
  builtinFurnitureDefinitions
} from "@casastudio/schema";
import {
  furnitureDragPlaneY3D,
  furniturePositionFromGrabOffset,
  furnitureRotationFromPointer,
  threePlanPointToProject
} from "./furniture-manipulation-3d";

function fixture() {
  const project = structuredClone(demoProjectFixture);
  project.building.levels = [
    {
      id: "ground",
      name: "Ground",
      elevation: 0,
      walls: [],
      staircases: [],
      rooms: [
        rectangleRoom("ground-room", -500, -500, 500, 500, 0),
        rectangleRoom("raised-room", -500, -500, 500, 500, 270)
      ]
    },
    {
      id: "upper",
      name: "Upper",
      elevation: 300,
      walls: [],
      staircases: [],
      rooms: [rectangleRoom("upper-room", -500, -500, 500, 500, 40)]
    }
  ];
  const definition = builtinFurnitureDefinitions[0]!;
  project.building.furniture = [
    createFurnitureItemFromDefinition(definition, {
      id: "ground-item",
      roomId: "ground-room",
      position: { x: 20, z: 30 }
    }),
    createFurnitureItemFromDefinition(definition, {
      id: "raised-item",
      roomId: "raised-room",
      position: { x: 20, z: 30 }
    }),
    createFurnitureItemFromDefinition(definition, {
      id: "upper-item",
      roomId: "upper-room",
      position: { x: 20, z: 30 }
    })
  ];
  return project;
}

describe("Furniture manipulation 3D math", () => {
  it("uses the owning Room global floor for ordinary, elevated, and upper-Level items", () => {
    const project = fixture();
    expect(furnitureDragPlaneY3D(project, project.building.furniture[0]!)).toBe(
      0
    );
    expect(furnitureDragPlaneY3D(project, project.building.furniture[1]!)).toBe(
      2.7
    );
    expect(furnitureDragPlaneY3D(project, project.building.furniture[2]!)).toBe(
      3.4
    );
  });

  it("reflects non-cardinal Three Z coordinates back into Project coordinates", () => {
    const centimeters = threePlanPointToProject(
      { x: 1.237, z: -4.891 },
      "cm"
    );
    expect(centimeters.x).toBeCloseTo(123.7, 10);
    expect(centimeters.z).toBeCloseTo(489.1, 10);
    expect(threePlanPointToProject({ x: -2.25, z: 3.75 }, "m")).toEqual({
      x: -2.25,
      z: -3.75
    });
  });

  it("preserves the grab offset instead of snapping the center under the pointer", () => {
    expect(
      furniturePositionFromGrabOffset(
        { x: 100, z: 200 },
        { x: 70, z: 215 },
        { x: 120, z: 260 }
      )
    ).toEqual({ x: 150, z: 245 });
  });

  it.each([
    [{ x: 1, z: 0 }, 0],
    [
      {
        x: Math.cos((-37 * Math.PI) / 180),
        z: Math.sin((-37 * Math.PI) / 180)
      },
      37
    ],
    [{ x: 0, z: -1 }, 90],
    [{ x: -1, z: 0 }, -180]
  ] as const)(
    "derives canonical degrees for pointer %o",
    (pointer, expected) => {
      expect(
        furnitureRotationFromPointer(0, { x: 0, z: 0 }, { x: 1, z: 0 }, pointer)
      ).toBeCloseTo(expected, 10);
    }
  );
});
