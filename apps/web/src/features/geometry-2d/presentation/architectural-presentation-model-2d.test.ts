import { describe, expect, it } from "vitest";
import type { Level, Staircase } from "@casastudio/schema";

import {
  createGeometrySelectionState,
  selectDoor,
  selectStairFlight,
  selectStairLanding,
  selectWall,
  selectWallOpening
} from "../selection/geometry-selection-state";
import {
  architecturalPlanCutHeight,
  createArchitecturalPresentationModel2D,
  createStaircasePresentation2D
} from "./architectural-presentation-model-2d";
import { ViewportTransform2D } from "../viewport/viewport-transform-2d";

describe("architectural presentation model", () => {
  it("preserves physical scaling and exposes stable Wall/Opening metadata", () => {
    const model = createArchitecturalPresentationModel2D(
      level,
      new ViewportTransform2D({ scale: 2, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState([selectDoor("door")])
    );
    expect(model.walls[0]).toMatchObject({
      kind: "WALL",
      geometryId: "wall",
      hitWidth: 40
    });
    expect(model.walls[0]?.bodySvgPoints).toHaveLength(3);
    expect(model.doors[0]).toMatchObject({
      kind: "DOOR",
      geometryId: "door",
      wallId: "wall",
      selected: true
    });
    expect(
      Math.hypot(
        model.doors[0]!.spanEnd.x - model.doors[0]!.spanStart.x,
        model.doors[0]!.spanEnd.y - model.doors[0]!.spanStart.y
      )
    ).toBeCloseTo(180);
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

  it("keeps Wall geometry stable while exposing distinct hover and selected states", () => {
    const transform = new ViewportTransform2D({
      scale: 1,
      offsetX: 0,
      offsetY: 500
    });
    const selected = createArchitecturalPresentationModel2D(
      level,
      transform,
      createGeometrySelectionState([selectWall("wall")])
    );
    const hovered = createArchitecturalPresentationModel2D(
      level,
      transform,
      createGeometrySelectionState([], selectWall("wall"))
    );
    expect(selected.walls[0]).toMatchObject({ selected: true, hovered: false });
    expect(hovered.walls[0]).toMatchObject({ selected: false, hovered: true });
    expect(selected.walls[0]?.bodySvgPoints).toEqual(
      hovered.walls[0]?.bodySvgPoints
    );
  });

  it("presents a selectable generic Wall Opening without type-specific graphics", () => {
    const openingLevel: Level = structuredClone(level);
    openingLevel.walls[0]!.openings.push({
      id: "passage",
      type: "OPENING",
      offsetFromStart: 390,
      width: 80,
      height: 220,
      elevation: 0
    });
    const model = createArchitecturalPresentationModel2D(
      openingLevel,
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState([selectWallOpening("passage")])
    );
    expect(model.openings).toEqual([
      expect.objectContaining({
        kind: "OPENING",
        geometryId: "passage",
        selected: true
      })
    ]);
    expect(model.openings[0]).not.toHaveProperty("glazingLines");
    expect(model.openings[0]).not.toHaveProperty("arcPath");
  });

  it("presents committed Staircases with independently selectable owned parts", () => {
    const stairLevel: Level = structuredClone(level);
    stairLevel.staircases.push({
      id: "stair",
      fromLevelId: "level",
      toLevelId: "level",
      width: 90,
      flights: [
        {
          id: "flight-one",
          start: { x: 0, z: 100 },
          end: { x: 300, z: 100 },
          width: 90,
          stepCount: 8,
          startElevation: 0,
          endElevation: 90
        },
        {
          id: "flight-two",
          start: { x: 300, z: 100 },
          end: { x: 300, z: 340 },
          width: 90,
          stepCount: 8,
          startElevation: 90,
          endElevation: 180
        }
      ],
      landings: [
        {
          id: "landing",
          position: { x: 300, z: 100 },
          width: 90,
          depth: 90,
          elevation: 90
        }
      ]
    });
    const model = createArchitecturalPresentationModel2D(
      stairLevel,
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState([
        selectStairFlight("flight-one"),
        selectStairLanding("landing")
      ])
    );

    expect(model.staircases).toHaveLength(1);
    expect(model.staircases[0]?.flights[0]).toMatchObject({
      geometryId: "flight-one",
      selected: true
    });
    expect(model.staircases[0]?.flights[0]?.treadLines).toHaveLength(8);
    expect(model.staircases[0]?.flights[1]?.directionLine.end.y).toBeLessThan(
      model.staircases[0]!.flights[1]!.directionLine.start.y
    );
    expect(model.staircases[0]?.flights[1]?.directionArrow).toContain("L");
    expect(model.staircases[0]?.landings[0]).toMatchObject({
      geometryId: "landing",
      selected: true
    });
    expect(
      model.staircases[0]?.landings[0]?.bodySvgPoints.split(" ")
    ).toHaveLength(4);

    const unselected = createArchitecturalPresentationModel2D(
      stairLevel,
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState()
    );
    expect(unselected.staircases[0]?.flights[0]?.bodySvgPoints).toBe(
      model.staircases[0]?.flights[0]?.bodySvgPoints
    );
  });

  it("keeps a Stair entirely below the reference plane uncut", () => {
    const model = createStaircasePresentation2D(
      createStraightStaircase({
        endElevation: architecturalPlanCutHeight - 10
      }),
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState(),
      architecturalPlanCutHeight
    );
    expect(model.hasContinuation).toBe(false);
    expect(model.flights[0]?.cut).toBeUndefined();
    expect(
      model.flights[0]?.treadLines.every((tread) => !tread.beyondCut)
    ).toBe(true);
  });

  it("derives a deterministic break and continuation for a cross-Level Stair", () => {
    const staircase = createStraightStaircase({
      toLevelId: "upper",
      endElevation: 300
    });
    const transform = new ViewportTransform2D({
      scale: 1,
      offsetX: 0,
      offsetY: 500
    });
    const first = createStaircasePresentation2D(
      staircase,
      transform,
      createGeometrySelectionState(),
      architecturalPlanCutHeight
    );
    const second = createStaircasePresentation2D(
      staircase,
      transform,
      createGeometrySelectionState(),
      architecturalPlanCutHeight
    );
    expect(first.hasContinuation).toBe(true);
    expect(first.flights[0]?.cut).toMatchObject({
      ratio: 0.4,
      referenceElevation: architecturalPlanCutHeight
    });
    expect(first.flights[0]?.cut?.breakLines).toHaveLength(2);
    expect(
      first.flights[0]?.cut?.continuationSvgPoints.split(" ")
    ).toHaveLength(4);
    expect(first.flights[0]?.treadLines.some((tread) => tread.beyondCut)).toBe(
      true
    );
    expect(second.flights[0]?.cut).toEqual(first.flights[0]?.cut);
    expect(staircase).not.toHaveProperty("cut");
    expect(staircase.flights[0]).not.toHaveProperty("beyondCut");
  });

  it("uses elevation range rather than Level IDs for a same-Level elevated-Room Stair", () => {
    const model = createStaircasePresentation2D(
      createStraightStaircase({
        toLevelId: "level",
        toRoomId: "elevated-room",
        endElevation: 180
      }),
      new ViewportTransform2D({ scale: 1, offsetX: 0, offsetY: 500 }),
      createGeometrySelectionState(),
      architecturalPlanCutHeight
    );
    expect(model.hasContinuation).toBe(true);
    expect(model.flights[0]?.cut?.ratio).toBeCloseTo(2 / 3);
  });
});

function createStraightStaircase({
  toLevelId = "level",
  toRoomId,
  endElevation
}: {
  readonly toLevelId?: string;
  readonly toRoomId?: string;
  readonly endElevation: number;
}): Staircase {
  return {
    id: "straight-stair",
    fromLevelId: "level",
    toLevelId,
    ...(toRoomId ? { toRoomId } : {}),
    width: 90,
    flights: [
      {
        id: "straight-flight",
        start: { x: 0, z: 100 },
        end: { x: 300, z: 100 },
        width: 90,
        stepCount: 12,
        startElevation: 0,
        endElevation
      }
    ],
    landings: []
  };
}

const level: Level = {
  id: "level",
  name: "Level",
  elevation: 0,
  rooms: [],
  staircases: [],
  walls: [
    {
      id: "wall",
      start: { x: 0, z: 0 },
      end: { x: 500, z: 0 },
      height: 280,
      thickness: 20,
      roomIds: [],
      openings: [
        {
          id: "door",
          type: "DOOR",
          offsetFromStart: 50,
          width: 90,
          height: 210,
          elevation: 0,
          hingeSide: "START",
          swingSide: "LEFT"
        },
        {
          id: "window",
          type: "WINDOW",
          offsetFromStart: 250,
          width: 120,
          height: 120,
          elevation: 90
        }
      ]
    },
    {
      id: "return",
      start: { x: 500, z: 0 },
      end: { x: 500, z: 300 },
      height: 280,
      thickness: 20,
      roomIds: [],
      openings: []
    }
  ]
};
