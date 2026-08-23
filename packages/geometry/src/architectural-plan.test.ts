import { describe, expect, it } from "vitest";
import type { Door, Wall, Window } from "@casastudio/schema";

import {
  createArchitecturalWallBodyShapes,
  createArchitecturalWallShape,
  createDoorPlanGeometry,
  createOpeningPlanSpan,
  createWindowPlanGeometry,
  projectPointOntoWall
} from "./architectural-plan.js";

const wall: Wall = {
  id: "angled-wall",
  start: { x: 10, z: 20 },
  end: { x: 310, z: 420 },
  height: 280,
  thickness: 20,
  roomIds: [],
  openings: []
};

describe("architectural plan geometry", () => {
  it("projects points onto angled Walls with clamped and signed local values", () => {
    const projection = projectPointOntoWall({ x: 190, z: 220 }, wall);
    expect(projection.t).toBeCloseTo(0.536, 3);
    expect(projection.projected.x).toBeCloseTo(170.8, 1);
    expect(projection.perpendicularDistance).toBeLessThan(0);
    expect(projectPointOntoWall({ x: -100, z: -100 }, wall).clamped).toBe(true);
  });

  it("derives true project-unit Wall thickness for angled geometry", () => {
    const shape = createArchitecturalWallShape(wall);
    expect(distance(shape.points[0], shape.points[1])).toBeCloseTo(20);
    expect(distance(shape.points[1], shape.points[2])).toBeCloseTo(500);
  });

  it("cuts Wall bodies around true-width Opening intervals", () => {
    const withOpenings: Wall = {
      ...wall,
      openings: [window("first", 50, 100), window("second", 250, 80)]
    };
    expect(createArchitecturalWallBodyShapes(withOpenings).map((shape) => [shape.startDistance, shape.endDistance]))
      .toEqual([[0, 50], [150, 250], [330, 500]]);
  });

  it("derives Door hinge and swing on the same angled basis", () => {
    const door: Door = { id: "door", type: "DOOR", offsetFromStart: 50, width: 90, height: 210, elevation: 0, hingeSide: "END", swingSide: "RIGHT" };
    const geometry = createDoorPlanGeometry(wall, door);
    expect(geometry.hinge).toEqual(geometry.span.end);
    expect(distance(geometry.hinge, geometry.openLeafEnd)).toBeCloseTo(90);
    expect(distance(geometry.arcStart, geometry.hinge)).toBeCloseTo(90);
  });

  it("derives Window symbol lines at physical Wall-relative offsets", () => {
    const opening = window("window", 70, 120);
    const span = createOpeningPlanSpan(wall, opening);
    const geometry = createWindowPlanGeometry(wall, opening);
    expect(distance(span.start, span.end)).toBeCloseTo(120);
    expect(distance(geometry.glazingLines[0][0], geometry.glazingLines[1][0])).toBeCloseTo(8);
  });
});

function window(id: string, offsetFromStart: number, width: number): Window {
  return { id, type: "WINDOW", offsetFromStart, width, height: 120, elevation: 90 };
}

function distance(first: { x: number; z: number }, second: { x: number; z: number }): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}
