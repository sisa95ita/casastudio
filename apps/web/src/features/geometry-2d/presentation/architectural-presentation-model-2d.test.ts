import { describe, expect, it } from "vitest";
import type { Level } from "@casastudio/schema";

import { createGeometrySelectionState, selectDoor, selectWallOpening } from "../selection/geometry-selection-state";
import { createArchitecturalPresentationModel2D } from "./architectural-presentation-model-2d";
import { ViewportTransform2D } from "../viewport/viewport-transform-2d";

describe("architectural presentation model", () => {
  it("preserves physical scaling and exposes stable Wall/Opening metadata", () => {
    const model = createArchitecturalPresentationModel2D(
      level,
      new ViewportTransform2D({ scale: 2, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState([selectDoor("door")])
    );
    expect(model.walls[0]).toMatchObject({ kind: "WALL", geometryId: "wall", hitWidth: 40 });
    expect(model.walls[0]?.bodySvgPoints).toHaveLength(3);
    expect(model.doors[0]).toMatchObject({ kind: "DOOR", geometryId: "door", wallId: "wall", selected: true });
    expect(Math.hypot(
      model.doors[0]!.spanEnd.x - model.doors[0]!.spanStart.x,
      model.doors[0]!.spanEnd.y - model.doors[0]!.spanStart.y
    )).toBeCloseTo(180);
  });

  it("renders Window linework and deterministic shared-junction joins", () => {
    const model = createArchitecturalPresentationModel2D(
      level,
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState()
    );
    expect(model.windows[0]?.glazingLines).toHaveLength(2);
    expect(model.joins).toHaveLength(1);
    expect(model.joins[0]?.radius).toBe(10);
  });

  it("presents a selectable generic Wall Opening without type-specific graphics", () => {
    const openingLevel: Level = structuredClone(level);
    openingLevel.walls[0]!.openings.push({ id: "passage", type: "OPENING", offsetFromStart: 390, width: 80, height: 220, elevation: 0 });
    const model = createArchitecturalPresentationModel2D(
      openingLevel,
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState([selectWallOpening("passage")])
    );
    expect(model.openings).toEqual([
      expect.objectContaining({ kind: "OPENING", geometryId: "passage", selected: true })
    ]);
    expect(model.openings[0]).not.toHaveProperty("glazingLines");
    expect(model.openings[0]).not.toHaveProperty("arcPath");
  });
});

const level: Level = {
  id: "level", name: "Level", elevation: 0, rooms: [], staircases: [],
  walls: [
    {
      id: "wall", start: { x: 0, z: 0 }, end: { x: 500, z: 0 }, height: 280, thickness: 20, roomIds: [],
      openings: [
        { id: "door", type: "DOOR", offsetFromStart: 50, width: 90, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" },
        { id: "window", type: "WINDOW", offsetFromStart: 250, width: 120, height: 120, elevation: 90 }
      ]
    },
    { id: "return", start: { x: 500, z: 0 }, end: { x: 500, z: 300 }, height: 280, thickness: 20, roomIds: [], openings: [] }
  ]
};
