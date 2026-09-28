import { describe, expect, it } from "vitest";
import type { Door, Wall, WallOpening, Window } from "@casastudio/schema";

import {
  createArchitecturalWallBodyShapes,
  createArchitecturalWallEndpointInterfaces,
  createArchitecturalWallShape,
  createDoorPlanGeometry,
  createOpeningPlanSpan,
  createWallOpeningPlanGeometry,
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

  it("derives a Wall Opening with jambs and no Door or Window linework", () => {
    const opening: WallOpening = { id: "passage", type: "OPENING", offsetFromStart: 100, width: 160, height: 220, elevation: 0 };
    const geometry = createWallOpeningPlanGeometry(wall, opening);
    expect(geometry.kind).toBe("OPENING");
    expect(distance(geometry.span.start, geometry.span.end)).toBeCloseTo(160);
    expect(geometry.jambs).toHaveLength(2);
    expect(geometry).not.toHaveProperty("glazingLines");
    expect(geometry).not.toHaveProperty("openLeafEnd");
    expect(geometry).not.toHaveProperty("arcRadius");
  });

  it("resolves both physical faces of a 90-degree corner into shared miters", () => {
    const [east, north] = createArchitecturalWallEndpointInterfaces({
      walls: [ray("east", 100, 0), ray("north", 0, 100)]
    });

    expect(east?.start).toEqual({
      left: { x: 10, z: 10 },
      right: { x: -10, z: -10 },
      kind: "miter"
    });
    expect(north?.start).toEqual({
      left: { x: -10, z: -10 },
      right: { x: 10, z: 10 },
      kind: "miter"
    });
  });

  it("is invariant to canonical Wall direction at an equivalent corner", () => {
    const forward = createArchitecturalWallEndpointInterfaces({
      walls: [ray("east", 100, 0), ray("north", 0, 100)]
    });
    const reversed = createArchitecturalWallEndpointInterfaces({
      walls: [reverseRay("east", 100, 0), reverseRay("north", 0, 100)]
    });
    expect(sortedPoints([reversed[0]!.end.left, reversed[0]!.end.right])).toEqual(
      sortedPoints([forward[0]!.start.left, forward[0]!.start.right])
    );
    expect(sortedPoints([reversed[1]!.end.left, reversed[1]!.end.right])).toEqual(
      sortedPoints([forward[1]!.start.left, forward[1]!.start.right])
    );
  });

  it("keeps collinear continuations capped and trims a T branch to the through-Wall face", () => {
    const west = ray("west", -100, 0);
    const east = ray("east", 100, 0);
    const north = ray("north", 0, 100);
    const continuation = createArchitecturalWallEndpointInterfaces({ walls: [west, east] });
    expect(continuation.map((interfaces) => interfaces.start.kind)).toEqual(["cap", "cap"]);

    const tee = interfaceMap([west, east, north]);
    expect(tee.get("north")?.start).toMatchObject({
      left: { x: -10, z: 10 },
      right: { x: 10, z: 10 },
      kind: "miter"
    });
    expect(tee.get("east")?.start).toMatchObject({
      left: { x: 0, z: 10 },
      right: { x: 0, z: -10 },
      kind: "cap"
    });
    expect(tee.get("west")?.start).toMatchObject({
      left: { x: 0, z: -10 },
      right: { x: 0, z: 10 },
      kind: "cap"
    });
  });

  it("resolves arbitrary angles with finite shared face intersections", () => {
    const radians = 37 * Math.PI / 180;
    const interfaces = interfaceMap([
      ray("east", 100, 0),
      ray("angled", Math.cos(radians) * 100, Math.sin(radians) * 100)
    ]);
    const east = interfaces.get("east")!.start;
    const angled = interfaces.get("angled")!.start;
    expect(east.left).toEqual(angled.right);
    expect(east.right).toEqual(angled.left);
    expect([east.left, east.right].flatMap((point) => [point.x, point.z])
      .every(Number.isFinite)).toBe(true);
    expect(east.kind).toBe("miter");
  });

  it("preserves different face offsets and bounds near-parallel interfaces", () => {
    const differentThickness = interfaceMap([
      ray("east", 100, 0, 20),
      ray("north", 0, 100, 40)
    ]);
    expect(differentThickness.get("east")?.start).toMatchObject({
      left: { x: 20, z: 10 },
      right: { x: -20, z: -10 }
    });
    expect(differentThickness.get("north")?.start).toMatchObject({
      left: { x: -20, z: -10 },
      right: { x: 20, z: 10 }
    });

    const radians = Math.PI / 180;
    const nearParallel = interfaceMap([
      ray("east", 100, 0),
      ray("near", Math.cos(radians) * 100, Math.sin(radians) * 100)
    ]);
    const points = [...nearParallel.values()].flatMap((interfaces) => [
      interfaces.start.left,
      interfaces.start.right
    ]);
    expect([...nearParallel.values()].map((interfaces) => interfaces.start.kind))
      .toEqual(["bounded", "bounded"]);
    expect(Math.max(...points.map((point) => Math.hypot(point.x, point.z))))
      .toBeLessThanOrEqual(40 + 1e-9);
  });

  it("keeps Opening subdivision unchanged near a resolved endpoint", () => {
    const east = ray("east", 200, 0);
    east.openings.push(window("near-corner", 20, 50));
    const interfaces = interfaceMap([east, ray("north", 0, 200)]);
    expect(interfaces.get("east")?.start.kind).toBe("miter");
    expect(createArchitecturalWallBodyShapes(east)
      .map((shape) => [shape.startDistance, shape.endDistance]))
      .toEqual([[0, 20], [70, 200]]);
    expect(east.openings[0]).toMatchObject({ offsetFromStart: 20, width: 50 });
  });
});

function window(id: string, offsetFromStart: number, width: number): Window {
  return { id, type: "WINDOW", offsetFromStart, width, height: 120, elevation: 90 };
}

function distance(first: { x: number; z: number }, second: { x: number; z: number }): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}

function ray(id: string, x: number, z: number, thickness = 20): Wall {
  return {
    id,
    start: { x: 0, z: 0 },
    end: { x, z },
    height: 280,
    thickness,
    roomIds: [],
    openings: []
  };
}

function reverseRay(id: string, x: number, z: number): Wall {
  return { ...ray(id, x, z), start: { x, z }, end: { x: 0, z: 0 } };
}

function sortedPoints(points: readonly { x: number; z: number }[]) {
  return [...points].sort((left, right) => left.x - right.x || left.z - right.z);
}

function interfaceMap(walls: readonly Wall[]) {
  return new Map(
    createArchitecturalWallEndpointInterfaces({ walls }).map((interfaces) => [
      interfaces.wallId,
      interfaces
    ])
  );
}
