import type { Point2D, Staircase } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { deriveStairPlanGeometry } from "./stair-plan-geometry";

describe("Stair Landing plan geometry", () => {
  it.each([
    ["LEFT" as const, 37],
    ["RIGHT" as const, 37],
    ["LEFT" as const, 135],
    ["RIGHT" as const, 135]
  ])("derives an exact L %s frame and interfaces at %d°", (turn, rotation) => {
    const staircase = createTurnStair(rotation, turn, 4, 13);
    const plan = deriveStairPlanGeometry(staircase);
    const landing = plan.landings[0]!;

    expect(landing.topology).toBe("TURN");
    expect(Math.hypot(landing.forward.x, landing.forward.z)).toBeCloseTo(1, 12);
    expect(Math.hypot(landing.lateral.x, landing.lateral.z)).toBeCloseTo(1, 12);
    expect(dot(landing.forward, landing.lateral)).toBeCloseTo(0, 12);
    expect(landing.width).toBe(100);
    expect(landing.depth).toBe(100);
    expectPoint(plan.flights[0]!.end, landing.entry);
    expectPoint(plan.flights[1]!.start, landing.exit);
    expect(distance(landing.entry, landing.center)).toBeCloseTo(50, 12);
    expect(distance(landing.exit, landing.center)).toBeCloseTo(50, 12);
    expect(distance(plan.flights[0]!.start, plan.flights[0]!.end)).toBeCloseTo(4 * 28, 12);
    expect(distance(plan.flights[1]!.start, plan.flights[1]!.end)).toBeCloseTo(13 * 28, 12);
    expect(plan.flights.map((flight) => flight.stepCount)).toEqual([4, 13]);
    expect(plan.flights.map((flight) => [flight.startElevation, flight.endElevation]))
      .toEqual([[0, 80], [80, 340]]);
  });

  it.each([37, 135])("derives distinct U lanes and a shared return edge at %d°", (rotation) => {
    const staircase = createReturnStair(rotation, 4, 13);
    const plan = deriveStairPlanGeometry(staircase);
    const landing = plan.landings[0]!;

    expect(landing.topology).toBe("RETURN");
    expect(landing.width).toBe(200);
    expect(landing.depth).toBe(100);
    expectPoint(plan.flights[0]!.end, landing.entry);
    expectPoint(plan.flights[1]!.start, landing.exit);
    expect(distance(landing.entry, landing.exit)).toBeCloseTo(100, 12);
    expect(dot(subtract(landing.entry, landing.center), landing.forward)).toBeCloseTo(-50, 12);
    expect(dot(subtract(landing.exit, landing.center), landing.forward)).toBeCloseTo(-50, 12);
    expect(plan.flights.map((flight) => flight.stepCount)).toEqual([4, 13]);
    expect(distance(plan.flights[0]!.start, plan.flights[0]!.end)).toBeCloseTo(4 * 28, 12);
    expect(distance(plan.flights[1]!.start, plan.flights[1]!.end)).toBeCloseTo(13 * 28, 12);
  });

  it("normalizes legacy L center anchors without changing external endpoints", () => {
    const staircase = createTurnStair(0, "LEFT", 4, 13);
    const turn = staircase.flights[0]!.end;
    staircase.flights[1] = { ...staircase.flights[1]!, start: { ...turn } };
    staircase.landings[0] = { ...staircase.landings[0]!, position: { ...turn } };
    const destination = staircase.flights[1]!.end;

    const plan = deriveStairPlanGeometry(staircase);
    expectPoint(plan.landings[0]!.center, turn);
    expect(plan.flights[0]!.end.x).toBeCloseTo(turn.x - 50);
    expect(plan.flights[1]!.start.z).toBeCloseTo(turn.z + 50);
    expectPoint(plan.flights[0]!.start, staircase.flights[0]!.start);
    expectPoint(plan.flights[1]!.end, destination);
  });

  it("normalizes the legacy U lane-midpoint anchor while preserving both Flight spans", () => {
    const staircase = createReturnStair(0, 4, 13);
    const laneMidpoint = midpoint(staircase.flights[0]!.end, staircase.flights[1]!.start);
    staircase.landings[0] = { ...staircase.landings[0]!, position: laneMidpoint };
    const plan = deriveStairPlanGeometry(staircase);

    expect(plan.landings[0]!.center.x).toBeCloseTo(laneMidpoint.x + 50);
    expectPoint(plan.flights[0]!.end, staircase.flights[0]!.end);
    expectPoint(plan.flights[1]!.start, staircase.flights[1]!.start);
  });

  it("leaves a Straight Stair unchanged", () => {
    const staircase = createTurnStair(37, "LEFT", 4, 13);
    staircase.flights = [staircase.flights[0]!];
    staircase.landings = [];
    const plan = deriveStairPlanGeometry(staircase);
    expect(plan.flights).toEqual(staircase.flights);
    expect(plan.landings).toEqual([]);
  });
});

function createTurnStair(
  rotation: number,
  turn: "LEFT" | "RIGHT",
  firstSteps: number,
  secondSteps: number
): Staircase {
  const forward = direction(rotation);
  const lateral = scale({ x: -forward.z, z: forward.x }, turn === "LEFT" ? 1 : -1);
  const start = { x: 20, z: -30 };
  const entry = add(start, scale(forward, firstSteps * 28));
  const center = add(entry, scale(forward, 50));
  const exit = add(center, scale(lateral, 50));
  return staircase(
    { start, end: entry, stepCount: firstSteps, startElevation: 0, endElevation: 80 },
    { start: exit, end: add(exit, scale(lateral, secondSteps * 28)), stepCount: secondSteps,
      startElevation: 80, endElevation: 340 },
    center, 100
  );
}

function createReturnStair(rotation: number, firstSteps: number, secondSteps: number): Staircase {
  const forward = direction(rotation);
  const lateral = { x: -forward.z, z: forward.x };
  const start = { x: 20, z: -30 };
  const entry = add(start, scale(forward, firstSteps * 28));
  const exit = add(entry, scale(lateral, 100));
  const center = add(midpoint(entry, exit), scale(forward, 50));
  return staircase(
    { start, end: entry, stepCount: firstSteps, startElevation: 0, endElevation: 80 },
    { start: exit, end: add(exit, scale(forward, -secondSteps * 28)), stepCount: secondSteps,
      startElevation: 80, endElevation: 340 },
    center, 200
  );
}

function staircase(
  first: Omit<Staircase["flights"][number], "id" | "width">,
  second: Omit<Staircase["flights"][number], "id" | "width">,
  center: Point2D,
  landingWidth: number
): Staircase {
  return {
    id: "stair", fromLevelId: "ground", toLevelId: "upper", width: 100,
    flights: [{ id: "first", width: 100, ...first }, { id: "second", width: 100, ...second }],
    landings: [{ id: "landing", position: center, width: landingWidth, depth: 100, elevation: 80 }]
  };
}

function direction(rotation: number): Point2D {
  const radians = rotation * Math.PI / 180;
  return { x: Math.cos(radians), z: Math.sin(radians) };
}

function expectPoint(actual: Point2D, expected: Point2D) {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

function distance(first: Point2D, second: Point2D): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function dot(first: Point2D, second: Point2D): number {
  return first.x * second.x + first.z * second.z;
}

function add(first: Point2D, second: Point2D): Point2D {
  return { x: first.x + second.x, z: first.z + second.z };
}

function subtract(first: Point2D, second: Point2D): Point2D {
  return { x: first.x - second.x, z: first.z - second.z };
}

function scale(point: Point2D, multiplier: number): Point2D {
  return { x: point.x * multiplier, z: point.z * multiplier };
}

function midpoint(first: Point2D, second: Point2D): Point2D {
  return { x: (first.x + second.x) / 2, z: (first.z + second.z) / 2 };
}
